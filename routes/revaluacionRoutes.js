const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const RevaluacionService = require('../services/revaluacionService');
const ExcelJS = require('exceljs');
const { Revaluacion, RevaluacionArticulo } = require('../models');

// Generar nueva revaluación
router.post('/generar', auth, async (req, res) => {
    try {
        const { costeo_ids, tc_usd, tc_eur, tc_gbp, motivo } = req.body;
        
        if (!tc_usd) {
            return res.status(400).json({ error: 'Debe ingresar el TC USD' });
        }
        if (!motivo) {
            return res.status(400).json({ error: 'Debe seleccionar un motivo' });
        }
        
        const resultado = await RevaluacionService.generarRevaluacion(
            req.usuario.id,
            costeo_ids || [],
            parseFloat(tc_usd),
            tc_eur ? parseFloat(tc_eur) : null,
            tc_gbp ? parseFloat(tc_gbp) : null,
            motivo
        );
        
        res.json(resultado);
    } catch (error) {
        console.error('Error al generar revaluación:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener historial de revaluaciones
router.get('/historial', auth, async (req, res) => {
    try {
        const historial = await RevaluacionService.obtenerHistorial(req.usuario.id);
        res.json(historial);
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener detalle de una revaluación
router.get('/detalle/:id', auth, async (req, res) => {
    try {
        const detalle = await RevaluacionService.obtenerDetalle(req.params.id);
        if (!detalle) {
            return res.status(404).json({ error: 'Revaluación no encontrada' });
        }
        res.json(detalle);
    } catch (error) {
        console.error('Error al obtener detalle:', error);
        res.status(500).json({ error: error.message });
    }
});

// Exportar revaluación a Excel
router.get('/exportar/:id', auth, async (req, res) => {
    try {
        const revaluacion = await Revaluacion.findByPk(req.params.id, {
            include: [{ model: RevaluacionArticulo, as: 'articulos' }]
        });
        
        if (!revaluacion) {
            return res.status(404).json({ error: 'Revaluación no encontrada' });
        }
        
        const workbook = new ExcelJS.Workbook();
        const hoja = workbook.addWorksheet('Revaluación');
        
        // Encabezados
        hoja.columns = [
            { header: 'Código Artículo', key: 'codigo', width: 18 },
            { header: 'Nombre', key: 'nombre', width: 40 },
            { header: 'Proveedor', key: 'proveedor', width: 20 },
            { header: 'Costo Neto Original', key: 'costo_orig', width: 18 },
            { header: 'TC USD Orig', key: 'tc_usd_orig', width: 12 },
            { header: 'TC EUR Orig', key: 'tc_eur_orig', width: 12 },
            { header: 'TC GBP Orig', key: 'tc_gbp_orig', width: 12 },
            { header: 'Costo Neto Revaluado', key: 'costo_rev', width: 20 },
            { header: 'TC USD Nuevo', key: 'tc_usd_nuevo', width: 12 },
            { header: 'TC EUR Nuevo', key: 'tc_eur_nuevo', width: 12 },
            { header: 'TC GBP Nuevo', key: 'tc_gbp_nuevo', width: 12 },
            { header: 'Diferencia %', key: 'dif_pct', width: 12 },
            { header: 'Costeo Origen', key: 'costeo_origen', width: 25 },
            { header: 'FOB Proveedor', key: 'fob_prov', width: 14 },
            { header: 'FOB Intermediaria', key: 'fob_interm', width: 16 },
            { header: 'Dif FOB %', key: 'dif_fob_pct', width: 12 },
            { header: 'Fecha Despacho', key: 'fecha_desp', width: 14 },
            { header: 'Fecha Revaluación', key: 'fecha_rev', width: 16 },
            { header: 'Motivo', key: 'motivo', width: 25 }
        ];
        
        // Estilo encabezado
        hoja.getRow(1).font = { bold: true };
        hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        
        // Datos
        for (const art of revaluacion.articulos) {
            hoja.addRow({
                codigo: art.codigo_goodies,
                nombre: art.nombre,
                proveedor: art.proveedor,
                costo_orig: parseFloat(art.costo_neto_original) || 0,
                tc_usd_orig: parseFloat(art.tc_usd_original) || 0,
                tc_eur_orig: parseFloat(art.tc_eur_original) || 0,
                tc_gbp_orig: parseFloat(art.tc_gbp_original) || 0,
                costo_rev: parseFloat(art.costo_neto_revaluado) || 0,
                tc_usd_nuevo: parseFloat(art.tc_usd_nuevo) || 0,
                tc_eur_nuevo: parseFloat(art.tc_eur_nuevo) || 0,
                tc_gbp_nuevo: parseFloat(art.tc_gbp_nuevo) || 0,
                dif_pct: parseFloat(art.diferencia_costo_pct) || 0,
                costeo_origen: art.nombre_costeo_origen,
                fob_prov: parseFloat(art.fob_proveedor_origen) || 0,
                fob_interm: parseFloat(art.fob_intermediaria) || 0,
                dif_fob_pct: parseFloat(art.diferencia_fob_pct) || 0,
                fecha_desp: art.fecha_despacho ? new Date(art.fecha_despacho).toLocaleDateString('es-AR') : '',
                fecha_rev: revaluacion.fecha_revaluacion ? new Date(revaluacion.fecha_revaluacion).toLocaleDateString('es-AR') : '',
                motivo: revaluacion.motivo
            });
        }
        
        // Formato numérico y negrita para costos
        for (let i = 2; i <= hoja.rowCount; i++) {
            hoja.getRow(i).getCell(4).numFmt = '#,##0.00';
            hoja.getRow(i).getCell(4).font = { bold: true };
            hoja.getRow(i).getCell(8).numFmt = '#,##0.00';
            hoja.getRow(i).getCell(8).font = { bold: true };
            hoja.getRow(i).getCell(12).numFmt = '0.00';
            hoja.getRow(i).getCell(14).numFmt = '#,##0.0000';
            hoja.getRow(i).getCell(15).numFmt = '#,##0.0000';
            hoja.getRow(i).getCell(16).numFmt = '0.00';
        }
        
        const buffer = await workbook.xlsx.writeBuffer();
        
        const fechaStr = new Date(revaluacion.fecha_revaluacion).toISOString().split('T')[0];
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Revaluacion_${fechaStr}_${revaluacion.motivo.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
        res.send(buffer);
        
    } catch (error) {
        console.error('Error al exportar revaluación:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar revaluación
router.delete('/:id', auth, async (req, res) => {
    try {
        const revaluacion = await Revaluacion.findByPk(req.params.id);
        if (!revaluacion) {
            return res.status(404).json({ error: 'Revaluación no encontrada' });
        }
        await RevaluacionArticulo.destroy({ where: { revaluacion_id: req.params.id } });
        await revaluacion.destroy();
        res.json({ mensaje: 'Revaluación eliminada' });
    } catch (error) {
        console.error('Error al eliminar revaluación:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;