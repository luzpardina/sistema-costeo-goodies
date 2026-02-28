const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer');
const XLSX = require('xlsx');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

const ValuacionInventario = require('../models/ValuacionInventario');
const ValuacionDetalle = require('../models/ValuacionDetalle');
const { ArticuloCosteo, Costeo, Revaluacion, RevaluacionArticulo } = require('../models');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Listar valuaciones
router.get('/valuaciones', auth, async (req, res) => {
    try {
        const valuaciones = await ValuacionInventario.findAll({ order: [['created_at', 'DESC']] });
        res.json(valuaciones);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Detalle de una valuación (lee desde DB con todos los campos)
router.get('/valuaciones/:id', auth, async (req, res) => {
    try {
        const valuacion = await ValuacionInventario.findByPk(req.params.id);
        if (!valuacion) return res.status(404).json({ error: 'No encontrada' });
        const detalle = await ValuacionDetalle.findAll({
            where: { valuacion_id: req.params.id }, order: [['codigo_goodies', 'ASC']]
        });
        res.json({ valuacion, detalle });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Parsear Excel de Centum
router.post('/parsear-excel', auth, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        let sheetName = workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        let colCodigo = -1, colNombre = -1, colCantidad = -1, colValorizado = -1;

        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
            const row = rawData[i];
            for (let j = 0; j < row.length; j++) {
                const val = String(row[j] || '').toLowerCase().trim();
                if (val === 'código' || val === 'codigo') colCodigo = j;
                if (val === 'articulo' || val === 'artículo') colNombre = j;
                if (val.includes('total existencias')) colCantidad = j;
            }
        }

        if (colCodigo === -1) colCodigo = 5;
        if (colNombre === -1) colNombre = 6;
        if (colCantidad === -1) colCantidad = 23;
        colValorizado = colCantidad + 1;

        const articulos = [];

        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            const codigo = String(row[colCodigo] || '').trim();
            const nombre = String(row[colNombre] || '').trim();
            const cantidad = parseFloat(row[colCantidad]) || 0;
            const valorizado = parseFloat(row[colValorizado]) || 0;

            if (codigo && codigo.length > 3 && cantidad > 0) {
                const costoUnit = cantidad > 0 ? valorizado / cantidad : 0;
                articulos.push({
                    codigo_goodies: codigo,
                    descripcion: nombre,
                    cantidad: cantidad,
                    costo_unit_contable: Math.round(costoUnit * 100) / 100,
                    costo_total_contable: Math.round(valorizado * 100) / 100
                });
            }
        }

        res.json({ ok: true, articulos, hoja: sheetName, total_articulos: articulos.length });
    } catch (error) {
        console.error('Error parseando Excel:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// Buscar último costo definitivo por código y/o nombre
// Solo costeos calculados con fecha_despacho
// =============================================
async function buscarUltimoCostoDefinitivo(codigo, descripcion) {
    // 1) Buscar por código exacto
    let ultimoArt = await ArticuloCosteo.findOne({
        where: { codigo_goodies: codigo },
        include: [{
            model: Costeo, as: 'costeo',
            where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } }
        }],
        order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
    });

    let matchPor = 'codigo';

    // 2) Si no encontró por código, buscar por nombre
    if (!ultimoArt && descripcion && descripcion.length > 5) {
        ultimoArt = await ArticuloCosteo.findOne({
            where: { nombre: { [Op.iLike]: '%' + descripcion.toUpperCase().trim() + '%' } },
            include: [{
                model: Costeo, as: 'costeo',
                where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } }
            }],
            order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
        });
        if (ultimoArt) matchPor = 'nombre';
    }

    if (ultimoArt) {
        return {
            encontrado: true,
            match_por: matchPor,
            codigo_sistema: ultimoArt.codigo_goodies,
            nombre_sistema: ultimoArt.nombre,
            costo_unitario_neto: parseFloat(ultimoArt.costo_unitario_neto_ars) || 0,
            nombre_costeo: ultimoArt.costeo.nombre_costeo || '',
            fecha_despacho: ultimoArt.costeo.fecha_despacho,
            nro_despacho: ultimoArt.costeo.nro_despacho || '',
            proveedor: ultimoArt.costeo.proveedor || ''
        };
    }

    return { encontrado: false };
}

// Buscar en revaluación específica
async function buscarEnRevaluacion(revaluacionId, codigo, descripcion) {
    let artRev = await RevaluacionArticulo.findOne({
        where: { revaluacion_id: revaluacionId, codigo_goodies: codigo }
    });
    let matchPor = 'codigo';

    if (!artRev && descripcion && descripcion.length > 5) {
        artRev = await RevaluacionArticulo.findOne({
            where: {
                revaluacion_id: revaluacionId,
                nombre: { [Op.iLike]: '%' + descripcion.toUpperCase().trim() + '%' }
            }
        });
        if (artRev) matchPor = 'nombre';
    }

    if (artRev) {
        return {
            encontrado: true,
            match_por: matchPor,
            codigo_sistema: artRev.codigo_goodies,
            nombre_sistema: artRev.nombre,
            costo_unitario_neto: parseFloat(artRev.costo_neto_revaluado) || 0,
            nombre_costeo: 'Revaluación',
            fecha_despacho: null,
            nro_despacho: '',
            proveedor: ''
        };
    }

    return { encontrado: false };
}

// =============================================
// Crear valuación con 3 estados claros
// =============================================
router.post('/valuaciones', auth, async (req, res) => {
    try {
        const { nombre, revaluacion_id, articulos_centum } = req.body;
        let totalContable = 0, totalRevaluado = 0;
        let artDifPositiva = 0, artDifNegativa = 0;
        let artNoEncontrado = 0, artSinCostoSistema = 0, artSinCostoContable = 0;
        const detalles = [];

        for (const artCentum of articulos_centum) {
            const codigo = artCentum.codigo_goodies;
            const descripcion = artCentum.descripcion || '';
            const cantidad = parseFloat(artCentum.cantidad) || 0;
            const costoUnitContable = parseFloat(artCentum.costo_unit_contable) || 0;
            const costoTotalContable = parseFloat(artCentum.costo_total_contable) || (costoUnitContable * cantidad);

            // Buscar costo en sistema
            let resultado;
            if (revaluacion_id) {
                resultado = await buscarEnRevaluacion(revaluacion_id, codigo, descripcion);
            } else {
                resultado = await buscarUltimoCostoDefinitivo(codigo, descripcion);
            }

            const costoUnitRevaluado = resultado.encontrado ? resultado.costo_unitario_neto : 0;
            const costoTotalRevaluado = costoUnitRevaluado * cantidad;
            const difUnit = costoUnitRevaluado - costoUnitContable;
            const difTotal = costoTotalRevaluado - costoTotalContable;
            const difPct = costoUnitContable > 0 ? ((costoUnitRevaluado - costoUnitContable) / costoUnitContable) * 100 : 0;

            totalContable += costoTotalContable;
            totalRevaluado += costoTotalRevaluado;

            // Determinar estado
            let estado = 'OK';

            if (!resultado.encontrado) {
                // Artículo está en inventario pero NO se encontró en el sistema de costos
                estado = 'NO ENCONTRADO';
                artNoEncontrado++;
            } else if (costoUnitRevaluado === 0) {
                // Se encontró pero el costo en sistema es $0
                estado = 'SIN COSTO SISTEMA';
                artSinCostoSistema++;
            } else if (costoUnitContable === 0 || costoTotalContable === 0) {
                // Tiene costo en sistema pero el contable (Centum) es $0
                estado = 'SIN COSTO CONTABLE';
                artSinCostoContable++;
            } else {
                // Ambos costos presentes
                if (resultado.match_por === 'nombre') estado = 'OK (MATCH NOMBRE)';
                if (difTotal > 0) artDifPositiva++;
                if (difTotal < 0) artDifNegativa++;
            }

            detalles.push({
                codigo_goodies: codigo,
                descripcion: descripcion,
                cantidad,
                costo_unit_contable: Math.round(costoUnitContable * 100) / 100,
                costo_total_contable: Math.round(costoTotalContable * 100) / 100,
                costo_unit_revaluado: Math.round(costoUnitRevaluado * 100) / 100,
                costo_total_revaluado: Math.round(costoTotalRevaluado * 100) / 100,
                diferencia_unit: Math.round(difUnit * 100) / 100,
                diferencia_total: Math.round(difTotal * 100) / 100,
                diferencia_pct: Math.round(difPct * 100) / 100,
                estado: estado,
                nombre_costeo_origen: resultado.encontrado ? resultado.nombre_costeo : '',
                fecha_despacho_origen: resultado.encontrado ? resultado.fecha_despacho : null,
                nro_despacho_origen: resultado.encontrado ? resultado.nro_despacho : '',
                proveedor_origen: resultado.encontrado ? resultado.proveedor : '',
                codigo_sistema: resultado.encontrado ? resultado.codigo_sistema : '',
                nombre_sistema: resultado.encontrado ? resultado.nombre_sistema : ''
            });
        }

        const valuacion = await ValuacionInventario.create({
            nombre, fecha_carga: new Date(), revaluacion_id: revaluacion_id || null,
            total_contable: Math.round(totalContable * 100) / 100,
            total_revaluado: Math.round(totalRevaluado * 100) / 100,
            diferencia: Math.round((totalRevaluado - totalContable) * 100) / 100,
            cantidad_articulos: detalles.length, art_dif_positiva: artDifPositiva,
            art_dif_negativa: artDifNegativa, usuario_id: req.user?.id || null
        });

        // Guardar detalles con TODOS los campos
        for (const det of detalles) {
            await ValuacionDetalle.create({
                valuacion_id: valuacion.id,
                ...det
            });
        }

        res.json({
            valuacion, detalle: detalles,
            resumen: {
                total_contable: Math.round(totalContable * 100) / 100,
                total_revaluado: Math.round(totalRevaluado * 100) / 100,
                diferencia: Math.round((totalRevaluado - totalContable) * 100) / 100,
                art_dif_positiva: artDifPositiva,
                art_dif_negativa: artDifNegativa,
                art_no_encontrado: artNoEncontrado,
                art_sin_costo_sistema: artSinCostoSistema,
                art_sin_costo_contable: artSinCostoContable
            }
        });
    } catch (error) {
        console.error('Error creando valuación:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar valuación
router.delete('/valuaciones/:id', auth, async (req, res) => {
    try {
        await ValuacionDetalle.destroy({ where: { valuacion_id: req.params.id } });
        await ValuacionInventario.destroy({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Listar revaluaciones disponibles
router.get('/revaluaciones-disponibles', auth, async (req, res) => {
    try {
        const revs = await Revaluacion.findAll({
            order: [['fecha_revaluacion', 'DESC']],
            attributes: ['id', 'motivo', 'fecha_revaluacion', 'tc_usd_nuevo', 'tc_eur_nuevo', 'tc_gbp_nuevo', 'cantidad_articulos']
        });
        res.json(revs);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
