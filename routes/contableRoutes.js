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

// Parsear Excel de Centum (devuelve datos sin guardar)
router.post('/parsear-excel', auth, upload.single('archivo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        let sheetName = workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        // Buscar columnas por headers
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

        // Posiciones fijas del formato Centum si no encontró headers
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

// Crear valuación
router.post('/valuaciones', auth, async (req, res) => {
    try {
        const { nombre, revaluacion_id, articulos_centum } = req.body;
        let totalContable = 0, totalRevaluado = 0, artDifPositiva = 0, artDifNegativa = 0;
        const detalles = [];

        for (const artCentum of articulos_centum) {
            const codigo = artCentum.codigo_goodies;
            const cantidad = parseFloat(artCentum.cantidad) || 0;
            const costoUnitContable = parseFloat(artCentum.costo_unit_contable) || 0;
            const costoTotalContable = parseFloat(artCentum.costo_total_contable) || (costoUnitContable * cantidad);
            let costoUnitRevaluado = 0;

            if (revaluacion_id) {
                const artRev = await RevaluacionArticulo.findOne({ where: { revaluacion_id, codigo_goodies: codigo } });
                if (artRev) costoUnitRevaluado = parseFloat(artRev.costo_neto_revaluado) || 0;
            } else {
                const ultimoArt = await ArticuloCosteo.findOne({
                    where: { codigo_goodies: codigo },
                    include: [{ model: Costeo, as: 'costeo', where: { estado: { [Op.ne]: 'borrador' } } }],
                    order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
                });
                if (ultimoArt) costoUnitRevaluado = parseFloat(ultimoArt.costo_unitario_neto_ars) || 0;
            }

            const costoTotalRevaluado = costoUnitRevaluado * cantidad;
            const difUnit = costoUnitRevaluado - costoUnitContable;
            const difTotal = costoTotalRevaluado - costoTotalContable;
            const difPct = costoUnitContable > 0 ? ((costoUnitRevaluado - costoUnitContable) / costoUnitContable) * 100 : 0;

            totalContable += costoTotalContable;
            totalRevaluado += costoTotalRevaluado;
            if (difTotal > 0) artDifPositiva++;
            if (difTotal < 0) artDifNegativa++;

            detalles.push({
                codigo_goodies: codigo, descripcion: artCentum.descripcion || '', cantidad,
                costo_unit_contable: Math.round(costoUnitContable * 100) / 100,
                costo_total_contable: Math.round(costoTotalContable * 100) / 100,
                costo_unit_revaluado: Math.round(costoUnitRevaluado * 100) / 100,
                costo_total_revaluado: Math.round(costoTotalRevaluado * 100) / 100,
                diferencia_unit: Math.round(difUnit * 100) / 100,
                diferencia_total: Math.round(difTotal * 100) / 100,
                diferencia_pct: Math.round(difPct * 100) / 100
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

        for (const det of detalles) {
            await ValuacionDetalle.create({ valuacion_id: valuacion.id, ...det });
        }

        res.json({
            valuacion, detalle: detalles,
            resumen: {
                total_contable: Math.round(totalContable * 100) / 100,
                total_revaluado: Math.round(totalRevaluado * 100) / 100,
                diferencia: Math.round((totalRevaluado - totalContable) * 100) / 100,
                art_dif_positiva: artDifPositiva, art_dif_negativa: artDifNegativa
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
