const express = require('express');
const router = express.Router();
const multer = require('multer');
const costeoController = require('../controllers/costeoController');
const auth = require('../middleware/auth');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios } = require('../models');
const CalculosService = require('../services/calculosService');
const ExportarService = require('../services/exportarService');

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
        }
    }
});

router.post('/importar', auth, upload.single('archivo'), costeoController.importarExcel);
router.post('/precargar', auth, upload.single('archivo'), costeoController.precargarExcel);

router.get('/detalle-articulo/:codigo', auth, async (req, res) => {
    try {
        const codigo = req.params.codigo;
        
        // Obtener todos los costeos de este artículo
        const articulos = await ArticuloCosteo.findAll({
            where: { codigo_goodies: codigo },
            include: [{
                model: Costeo,
                as: 'costeo',
               
                attributes: ['id', 'nombre_costeo', 'proveedor', 'moneda_principal', 'fecha_despacho', 'tc_usd', 'tc_eur', 'tc_gbp']
            }],
            order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
        });
        
        if (articulos.length === 0) {
            return res.status(404).json({ error: 'Artículo no encontrado' });
        }
        
        // Ordenar por fecha de despacho (más reciente primero)
        articulos.sort((a, b) => {
            const fechaA = a.costeo?.fecha_despacho ? new Date(a.costeo.fecha_despacho) : new Date(0);
            const fechaB = b.costeo?.fecha_despacho ? new Date(b.costeo.fecha_despacho) : new Date(0);
            return fechaB - fechaA;
        });
        
        const ultimo = articulos[0];
        const anterior = articulos[1] || null;
        
        const formatearArticulo = (art) => {
            if (!art) return null;
            return {
                nombre_costeo: art.costeo?.nombre_costeo,
                fecha_despacho: art.costeo?.fecha_despacho,
                tc_usd: art.costeo?.tc_usd,
                tc_eur: art.costeo?.tc_eur,
                tc_gbp: art.costeo?.tc_gbp,
                moneda: art.costeo?.moneda_principal,
                nombre: art.nombre,
                fob_origen: art.valor_proveedor_origen || art.valor_unitario_origen,
                fob_interm: art.valor_unitario_origen,
                costo_neto: art.costo_unitario_neto_ars,
                costo_con_impuestos: art.costo_unitario_ars
            };
        };
        
        res.json({
            ultimo: formatearArticulo(ultimo),
            anterior: formatearArticulo(anterior)
        });
        
    } catch (error) {
        console.error('Error al obtener detalle artículo:', error);
        res.status(500).json({ error: 'Error al obtener detalle del artículo' });
    }
});
router.get('/ultimos-costos', auth, async (req, res) => {
    try {
        // Obtener todos los artículos con datos del costeo
        const articulos = await ArticuloCosteo.findAll({
            include: [{
                model: Costeo,
                as: 'costeo',
                
                attributes: ['id', 'nombre_costeo', 'proveedor', 'moneda_principal', 'fecha_despacho', 'tc_usd', 'tc_eur', 'tc_gbp']
            }],
            order: [['created_at', 'DESC']]
        });
        
        // Agrupar por codigo_goodies y quedarse con los 2 más recientes
        const costosPorCodigo = {};
        
        articulos.forEach(art => {
            const codigo = art.codigo_goodies || 'SIN_CODIGO';
            const fechaDespacho = art.costeo?.fecha_despacho ? new Date(art.costeo.fecha_despacho) : new Date(0);
            
            if (!costosPorCodigo[codigo]) {
                costosPorCodigo[codigo] = [];
            }
            
            costosPorCodigo[codigo].push({
                fecha: fechaDespacho,
                articulo: art
            });
        });
        
        // Ordenar cada grupo por fecha y quedarse con los 2 más recientes
        Object.keys(costosPorCodigo).forEach(codigo => {
            costosPorCodigo[codigo].sort((a, b) => b.fecha - a.fecha);
            costosPorCodigo[codigo] = costosPorCodigo[codigo].slice(0, 2);
        });
        
        // Formatear respuesta
        const resultado = Object.keys(costosPorCodigo).map(codigo => {
            const items = costosPorCodigo[codigo];
            const ultimo = items[0];
            const anteultimo = items[1] || null;
            
            const art = ultimo.articulo;
            const costeo = art.costeo;
            
            const costoActual = parseFloat(art.costo_unitario_ars) || 0;
            const costoAnterior = anteultimo ? (parseFloat(anteultimo.articulo.costo_unitario_ars) || 0) : null;
            
            let diferenciaPct = null;
            if (costoAnterior && costoAnterior > 0) {
                diferenciaPct = ((costoActual - costoAnterior) / costoAnterior) * 100;
            }
            
            // FOB del proveedor origen (actual y anterior)
            const fobOrigenActual = parseFloat(art.valor_proveedor_origen) || parseFloat(art.valor_unitario_origen) || 0;
            const fobOrigenAnterior = anteultimo ? (parseFloat(anteultimo.articulo.valor_proveedor_origen) || parseFloat(anteultimo.articulo.valor_unitario_origen) || 0) : null;
            let varFobOrigenPct = null;
            if (fobOrigenAnterior && fobOrigenAnterior > 0) {
                varFobOrigenPct = ((fobOrigenActual - fobOrigenAnterior) / fobOrigenAnterior) * 100;
            }
            
            // FOB de intermediaria (actual y anterior)
            const fobIntermActual = parseFloat(art.valor_unitario_origen) || 0;
            const fobIntermAnterior = anteultimo ? (parseFloat(anteultimo.articulo.valor_unitario_origen) || 0) : null;
            let varFobIntermPct = null;
            if (fobIntermAnterior && fobIntermAnterior > 0 && fobIntermActual !== fobOrigenActual) {
                varFobIntermPct = ((fobIntermActual - fobIntermAnterior) / fobIntermAnterior) * 100;
            }
            
            return {
                codigo_goodies: art.codigo_goodies,
                proveedor: costeo?.proveedor || '',
                nombre: art.nombre,
                moneda_fob: costeo?.moneda_principal || 'USD',
                valor_fob: art.valor_unitario_origen || art.fob_unitario_usd || 0,
                fob_origen_actual: fobOrigenActual,
                fob_origen_anterior: fobOrigenAnterior,
                var_fob_origen_pct: varFobOrigenPct,
                fob_interm_actual: fobIntermActual,
                fob_interm_anterior: fobIntermAnterior,
                var_fob_interm_pct: varFobIntermPct,
                costo_neto: art.costo_unitario_neto_ars || 0,
                costo_con_impuestos: costoActual,
                costo_anterior: costoAnterior,
                diferencia_pct: diferenciaPct,
                fecha_despacho: costeo?.fecha_despacho,
                nombre_costeo: costeo?.nombre_costeo || '',
                tc_usd: costeo?.tc_usd,
                tc_eur: costeo?.tc_eur,
                tc_gbp: costeo?.tc_gbp
            };
        });
        
        // Ordenar por código
        resultado.sort((a, b) => (a.codigo_goodies || '').localeCompare(b.codigo_goodies || ''));
        
        res.json(resultado);
    } catch (error) {
        console.error('Error al obtener últimos costos:', error);
        res.status(500).json({ error: 'Error al obtener últimos costos' });
    }
});
router.get('/listar', auth, async (req, res) => {
    try {
        const costeos = await Costeo.findAll({
           
            order: [['created_at', 'DESC']],
            attributes: ['id', 'nombre_costeo', 'proveedor', 'moneda_principal', 'unidades_totales', 'costo_total_ars', 'estado', 'fecha_factura', 'fecha_despacho', 'created_at']
        });
        res.json(costeos);
    } catch (error) {
        console.error('Error al listar costeos:', error);
        res.status(500).json({ error: 'Error al listar costeos' });
    }
});

router.get('/:id', auth, async (req, res) => {
    try {
        const costeo = await Costeo.findByPk(req.params.id, {
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosAduana, as: 'gastos_aduana' },
                { model: GastosVarios, as: 'gastos_varios' }
            ]
        });
        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }
        res.json(costeo);
    } catch (error) {
        console.error('Error al obtener costeo:', error);
        res.status(500).json({ error: 'Error al obtener costeo' });
    }
});

router.post('/:id/calcular', auth, async (req, res) => {
    try {
        const resultado = await CalculosService.calcularCosteo(req.params.id);
        res.json(resultado);
    } catch (error) {
        console.error('Error al calcular costeo:', error);
        res.status(500).json({ error: 'Error al calcular costeo', detalles: error.message });
    }
});

router.get('/:id/exportar', auth, async (req, res) => {
    try {
        const resultado = await ExportarService.exportarCosteo(req.params.id);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="' + resultado.filename + '"');
        res.send(resultado.buffer);
    } catch (error) {
        console.error('Error al exportar costeo:', error);
        res.status(500).json({ error: 'Error al exportar costeo', detalles: error.message });
    }
});

// Ruta para carga manual
router.post('/manual', auth, costeoController.cargaManual);
router.delete('/:id', auth, async (req, res) => {
    try {
        const costeo = await Costeo.findByPk(req.params.id);
        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }
        await costeo.destroy();
        res.json({ mensaje: 'Costeo eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar costeo:', error);
        res.status(500).json({ error: 'Error al eliminar costeo' });
    }
});

// Ruta para actualizar costeo
router.put('/:id/actualizar', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;
        
        const costeo = await Costeo.findByPk(id);
        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }
        
        // Actualizar datos del costeo
        await costeo.update({
            nombre_costeo: datos.nombre_costeo,
            proveedor: datos.proveedor,
            empresa_intermediaria: datos.empresa_intermediaria || null,
            factura_intermediaria: datos.factura_intermediaria || null,
            fecha_factura_intermediaria: datos.fecha_factura_intermediaria || null,
            factura_nro: datos.factura_nro || null,
            moneda_principal: datos.moneda_principal || 'USD',
            monto_factura: datos.monto_factura || 0,
            fecha_factura: datos.fecha_factura || null,
            fecha_vencimiento_factura: datos.fecha_vencimiento_factura || null,
            fecha_despacho: datos.fecha_despacho || null,
            tc_usd: datos.tc_usd || null,
            tc_eur: datos.tc_eur || null,
            tc_gbp: datos.tc_gbp || null,
            fob_moneda: datos.fob_moneda || 'USD',
            fob_monto: datos.fob_monto || 0,
            flete_moneda: datos.flete_moneda || 'USD',
            flete_monto: datos.flete_monto || 0,
            seguro_moneda: datos.seguro_moneda || 'USD',
            seguro_monto: datos.seguro_monto || 0
        });
        
        // Eliminar artículos anteriores
        await ArticuloCosteo.destroy({ where: { costeo_id: id } });
        
        // Crear nuevos artículos
        for (const art of datos.articulos) {
            const unidadesTotales = (parseFloat(art.cantidad_cajas) || 0) * (parseFloat(art.unidades_por_caja) || 0);
            const valorUnitario = parseFloat(art.valor_unitario_intermediaria) || parseFloat(art.valor_unitario_origen) || 0;
            const importeTotal = unidadesTotales * valorUnitario;
            
            await ArticuloCosteo.create({
                costeo_id: id,
                codigo_goodies: art.codigo_goodies || 'S/COD',
                codigo_proveedor: art.codigo_proveedor || '',
                nombre: art.nombre,
                cantidad_cajas: parseFloat(art.cantidad_cajas) || 0,
                unidades_por_caja: parseFloat(art.unidades_por_caja) || 0,
                unidades_totales: unidadesTotales,
                moneda_origen: datos.moneda_principal || 'USD',
                valor_unitario_origen: valorUnitario,
                importe_total_origen: importeTotal,
                valor_proveedor_origen: parseFloat(art.valor_unitario_origen) || 0,
                derechos_porcentaje: parseFloat(art.derechos_porcentaje) || 0,
                impuesto_interno_porcentaje: parseFloat(art.impuesto_interno_porcentaje) || 0
            });
        }
        
        // Eliminar gastos anteriores
        await GastosVarios.destroy({ where: { costeo_id: id } });
        
        // Crear nuevos gastos
        if (datos.gastos && datos.gastos.length > 0) {
            for (const g of datos.gastos) {
                if (g.descripcion) {
                    await GastosVarios.create({
                        costeo_id: id,
                        descripcion: g.descripcion,
                        proveedor_gasto: g.proveedor_gasto || '',
                        nro_comprobante: g.nro_comprobante || 'ESTIMADO',
                        moneda: g.moneda || 'USD',
                        monto: parseFloat(g.monto) || 0,
                        recargo: parseFloat(g.recargo) || 0,
                        observaciones: g.observaciones || ''
                    });
                }
            }
        }
        
        res.json({
            mensaje: 'Costeo actualizado exitosamente',
            costeo: {
                id: costeo.id,
                nombre: costeo.nombre_costeo
            }
        });
        
    } catch (error) {
        console.error('Error al actualizar costeo:', error);
        res.status(500).json({ error: 'Error al actualizar costeo', detalles: error.message });
    }
});
module.exports = router;