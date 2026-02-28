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

// =============================================
// HELPER: Buscar último costo definitivo de un artículo
// Busca por código primero, si no encuentra busca por nombre
// Solo toma costeos con estado 'calculado' y fecha_despacho (= definitivos)
// =============================================
async function buscarUltimoCosto(codigo, nombre) {
    // 1) Buscar por código exacto
    if (codigo) {
        const porCodigo = await ArticuloCosteo.findOne({
            where: { codigo_goodies: codigo },
            include: [{
                model: Costeo, as: 'costeo',
                where: {
                    estado: 'calculado',
                    [Op.or]: [
                        { fecha_despacho: { [Op.ne]: null } },
                        { nro_despacho: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } }
                    ]
                }
            }],
            order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
        });
        if (porCodigo) {
            return {
                encontrado: true,
                match_tipo: 'codigo',
                costo_unitario_neto: parseFloat(porCodigo.costo_unitario_neto_ars) || 0,
                nombre_costeo: porCodigo.costeo.nombre_costeo,
                fecha_despacho: porCodigo.costeo.fecha_despacho,
                proveedor: porCodigo.costeo.proveedor,
                codigo_encontrado: porCodigo.codigo_goodies,
                nombre_encontrado: porCodigo.nombre
            };
        }
    }

    // 2) Si no encontró por código, buscar por nombre (coincidencia parcial)
    if (nombre && nombre.length > 3) {
        const nombreLimpio = nombre.trim();
        const porNombre = await ArticuloCosteo.findOne({
            where: {
                nombre: { [Op.iLike]: '%' + nombreLimpio + '%' }
            },
            include: [{
                model: Costeo, as: 'costeo',
                where: {
                    estado: 'calculado',
                    [Op.or]: [
                        { fecha_despacho: { [Op.ne]: null } },
                        { nro_despacho: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } }
                    ]
                }
            }],
            order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
        });
        if (porNombre) {
            return {
                encontrado: true,
                match_tipo: 'nombre',
                costo_unitario_neto: parseFloat(porNombre.costo_unitario_neto_ars) || 0,
                nombre_costeo: porNombre.costeo.nombre_costeo,
                fecha_despacho: porNombre.costeo.fecha_despacho,
                proveedor: porNombre.costeo.proveedor,
                codigo_encontrado: porNombre.codigo_goodies,
                nombre_encontrado: porNombre.nombre
            };
        }
    }

    // 3) No encontrado
    return { encontrado: false, match_tipo: 'sin_costeo', costo_unitario_neto: 0 };
}

// =============================================
// HELPER: Buscar en revaluación
// =============================================
async function buscarEnRevaluacion(revaluacion_id, codigo, nombre) {
    if (codigo) {
        const porCodigo = await RevaluacionArticulo.findOne({
            where: { revaluacion_id, codigo_goodies: codigo }
        });
        if (porCodigo) {
            return {
                encontrado: true,
                match_tipo: 'codigo',
                costo_unitario_neto: parseFloat(porCodigo.costo_neto_revaluado) || 0,
                nombre_costeo: porCodigo.nombre_costeo_origen || 'Revaluación',
                fecha_despacho: porCodigo.fecha_despacho,
                proveedor: porCodigo.proveedor || '',
                codigo_encontrado: porCodigo.codigo_goodies,
                nombre_encontrado: porCodigo.nombre
            };
        }
    }
    if (nombre && nombre.length > 3) {
        const porNombre = await RevaluacionArticulo.findOne({
            where: { revaluacion_id, nombre: { [Op.iLike]: '%' + nombre.trim() + '%' } }
        });
        if (porNombre) {
            return {
                encontrado: true,
                match_tipo: 'nombre',
                costo_unitario_neto: parseFloat(porNombre.costo_neto_revaluado) || 0,
                nombre_costeo: porNombre.nombre_costeo_origen || 'Revaluación',
                fecha_despacho: porNombre.fecha_despacho,
                proveedor: porNombre.proveedor || '',
                codigo_encontrado: porNombre.codigo_goodies,
                nombre_encontrado: porNombre.nombre
            };
        }
    }
    return { encontrado: false, match_tipo: 'sin_costeo', costo_unitario_neto: 0 };
}

// =============================================
// Listar valuaciones
// =============================================
router.get('/valuaciones', auth, async (req, res) => {
    try {
        const valuaciones = await ValuacionInventario.findAll({ order: [['created_at', 'DESC']] });
        res.json(valuaciones);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// Detalle de una valuación
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

// =============================================
// Parsear Excel de Centum
// =============================================
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
// Crear valuación (mejorada)
// =============================================
router.post('/valuaciones', auth, async (req, res) => {
    try {
        const { nombre, revaluacion_id, articulos_centum } = req.body;
        let totalContable = 0, totalRevaluado = 0, artDifPositiva = 0, artDifNegativa = 0;
        let artSinCosteo = 0;
        const detalles = [];

        for (const artCentum of articulos_centum) {
            const codigo = artCentum.codigo_goodies;
            const descripcion = artCentum.descripcion || '';
            const cantidad = parseFloat(artCentum.cantidad) || 0;
            const costoUnitContable = parseFloat(artCentum.costo_unit_contable) || 0;
            const costoTotalContable = parseFloat(artCentum.costo_total_contable) || (costoUnitContable * cantidad);

            // Buscar costo según fuente seleccionada
            let resultado;
            if (revaluacion_id) {
                resultado = await buscarEnRevaluacion(revaluacion_id, codigo, descripcion);
            } else {
                resultado = await buscarUltimoCosto(codigo, descripcion);
            }

            const costoUnitRevaluado = resultado.costo_unitario_neto;
            const costoTotalRevaluado = costoUnitRevaluado * cantidad;
            const difUnit = costoUnitRevaluado - costoUnitContable;
            const difTotal = costoTotalRevaluado - costoTotalContable;
            const difPct = costoUnitContable > 0 ? ((costoUnitRevaluado - costoUnitContable) / costoUnitContable) * 100 : 0;

            totalContable += costoTotalContable;
            totalRevaluado += costoTotalRevaluado;
            if (resultado.encontrado) {
                if (difTotal > 0) artDifPositiva++;
                if (difTotal < 0) artDifNegativa++;
            } else {
                artSinCosteo++;
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
                // Campos nuevos
                match_tipo: resultado.match_tipo,
                nombre_costeo_origen: resultado.nombre_costeo || '',
                fecha_despacho_origen: resultado.fecha_despacho || null,
                proveedor_origen: resultado.proveedor || '',
                codigo_encontrado: resultado.codigo_encontrado || '',
                nombre_encontrado: resultado.nombre_encontrado || ''
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

        // Guardar detalles (sin los campos extra que no están en el modelo)
        for (const det of detalles) {
            await ValuacionDetalle.create({
                valuacion_id: valuacion.id,
                codigo_goodies: det.codigo_goodies,
                descripcion: det.descripcion,
                cantidad: det.cantidad,
                costo_unit_contable: det.costo_unit_contable,
                costo_total_contable: det.costo_total_contable,
                costo_unit_revaluado: det.costo_unit_revaluado,
                costo_total_revaluado: det.costo_total_revaluado,
                diferencia_unit: det.diferencia_unit,
                diferencia_total: det.diferencia_total,
                diferencia_pct: det.diferencia_pct
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
                art_sin_costeo: artSinCosteo
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
