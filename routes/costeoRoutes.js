const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const costeoController = require('../controllers/costeoController');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios, ConsolidadoProveedor } = require('../models');
const CalculosService = require('../services/calculosService');

// Configurar multer para subida de archivos
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

// Importar Excel
router.post('/importar', auth, upload.single('archivo'), costeoController.importarExcel);

// Precargar Excel sin guardar
router.post('/precargar', auth, upload.single('archivo'), costeoController.precargarExcel);

// Carga manual
router.post('/manual', auth, costeoController.cargaManual);

// Listar costeos
router.get('/listar', auth, async (req, res) => {
    try {
        const costeos = await Costeo.findAll({
            order: [['created_at', 'DESC']],
            include: [
                { model: ArticuloCosteo, as: 'articulos', attributes: ['id'] }
            ]
        });

        const lista = costeos.map(c => ({
            id: c.id,
            nombre_costeo: c.nombre_costeo,
            proveedor: c.proveedor,
            moneda_principal: c.moneda_principal,
            fecha_factura: c.fecha_factura,
            fecha_despacho: c.fecha_despacho,
            nro_despacho: c.nro_despacho,
            estado: c.estado,
            unidades_totales: c.unidades_totales,
            costo_total_ars: c.costo_total_ars,
            es_consolidado: c.es_consolidado,
            cant_articulos: c.articulos ? c.articulos.length : 0
        }));

        res.json(lista);
    } catch (error) {
        console.error('Error al listar costeos:', error);
        res.status(500).json({ error: 'Error al listar costeos' });
    }
});

router.get('/ultimos-costos', auth, async (req, res) => {
    try {
        const costeos = await Costeo.findAll({
            where: { estado: 'calculado' },
            include: [{ model: ArticuloCosteo, as: 'articulos' }],
            order: [['fecha_despacho', 'DESC']]
        });

        const ultimosCostos = {};
        const anteriores = {};

        for (const costeo of costeos) {
            for (const art of costeo.articulos) {
                const codigo = art.codigo_goodies;
                if (!ultimosCostos[codigo]) {
                    ultimosCostos[codigo] = {
                        codigo_goodies: codigo,
                        nombre: art.nombre,
                        proveedor: costeo.proveedor,
                        moneda_fob: costeo.moneda_principal,
                        valor_fob: art.fob_unitario_usd,
                        costo_neto: art.costo_unitario_neto_ars,
                        costo_con_impuestos: art.costo_unitario_ars,
                        fecha_despacho: costeo.fecha_despacho,
                        nombre_costeo: costeo.nombre_costeo,
                        tc_usd: costeo.tc_usd,
                        tc_eur: costeo.tc_eur,
                        tc_gbp: costeo.tc_gbp
                    };
                } else if (!anteriores[codigo]) {
                    anteriores[codigo] = art.costo_unitario_neto_ars;
                }
            }
        }

        const resultado = Object.values(ultimosCostos).map(art => {
            const costoAnterior = anteriores[art.codigo_goodies] || null;
            let diferenciaPct = null;
            if (costoAnterior && art.costo_neto) {
                diferenciaPct = ((art.costo_neto - costoAnterior) / costoAnterior) * 100;
            }
            return {
                ...art,
                costo_anterior: costoAnterior,
                diferencia_pct: diferenciaPct
            };
        });

        res.json(resultado);
    } catch (error) {
        console.error('Error al obtener ultimos costos:', error);
        res.status(500).json({ error: 'Error al obtener ultimos costos' });
    }
});

// Detalle de articulo (ultimo y anterior)
router.get('/detalle-articulo/:codigo', auth, async (req, res) => {
    try {
        const { codigo } = req.params;

        const costeos = await Costeo.findAll({
            where: { estado: 'calculado' },
            include: [{
                model: ArticuloCosteo,
                as: 'articulos',
                where: { codigo_goodies: codigo }
            }],
            order: [['fecha_despacho', 'DESC']],
            limit: 2
        });

        if (costeos.length === 0) {
            return res.status(404).json({ error: 'Articulo no encontrado' });
        }

        const ultimo = costeos[0];
        const anterior = costeos.length > 1 ? costeos[1] : null;

        const resultado = {
            ultimo: {
                nombre_costeo: ultimo.nombre_costeo,
                proveedor: ultimo.proveedor,
                fecha_despacho: ultimo.fecha_despacho,
                tc_usd: ultimo.tc_usd,
                tc_eur: ultimo.tc_eur,
                tc_gbp: ultimo.tc_gbp,
                moneda: ultimo.moneda_principal,
                fob_origen: ultimo.articulos[0].valor_unitario_origen,
                fob_interm: ultimo.articulos[0].valor_proveedor_origen,
                costo_neto: ultimo.articulos[0].costo_unitario_neto_ars,
                costo_con_impuestos: ultimo.articulos[0].costo_unitario_ars,
                nombre: ultimo.articulos[0].nombre
            }
        };

        if (anterior) {
            resultado.anterior = {
                nombre_costeo: anterior.nombre_costeo,
                proveedor: anterior.proveedor,
                fecha_despacho: anterior.fecha_despacho,
                tc_usd: anterior.tc_usd,
                tc_eur: anterior.tc_eur,
                tc_gbp: anterior.tc_gbp,
                moneda: anterior.moneda_principal,
                fob_origen: anterior.articulos[0].valor_unitario_origen,
                fob_interm: anterior.articulos[0].valor_proveedor_origen,
                costo_neto: anterior.articulos[0].costo_unitario_neto_ars,
                costo_con_impuestos: anterior.articulos[0].costo_unitario_ars,
                nombre: anterior.articulos[0].nombre
            };
        }

        res.json(resultado);
    } catch (error) {
        console.error('Error al obtener detalle:', error);
        res.status(500).json({ error: 'Error al obtener detalle del articulo' });
    }
});

// Obtener un costeo por ID
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const costeo = await Costeo.findByPk(id, {
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosAduana, as: 'gastos_aduana' },
                { model: GastosVarios, as: 'gastos_varios' },
                { model: ConsolidadoProveedor, as: 'proveedores_consolidado' }
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

// Calcular costeo
router.post('/:id/calcular', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await CalculosService.calcularCosteo(id);
        res.json(resultado);
    } catch (error) {
        console.error('Error al calcular:', error);
        res.status(500).json({ error: 'Error al calcular costeo', detalles: error.message });
    }
});

// Preview de participaciones para consolidados
router.get('/:id/preview-consolidado', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const resultado = await CalculosService.previewConsolidado(id);
        res.json(resultado);
    } catch (error) {
        console.error('Error en preview consolidado:', error);
        res.status(500).json({ error: 'Error al obtener preview', detalles: error.message });
    }
});

// Exportar costeo a Excel
router.get('/:id/exportar', auth, costeoController.exportar);

// Actualizar costeo
router.put('/:id/actualizar', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const datos = req.body;

        const costeo = await Costeo.findByPk(id);
        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }

        await costeo.update({
            nombre_costeo: datos.nombre_costeo,
            proveedor: datos.proveedor,
            empresa_intermediaria: datos.empresa_intermediaria || null,
            factura_nro: datos.factura_nro || null,
            factura_intermediaria: datos.factura_intermediaria || null,
            fecha_factura_intermediaria: datos.fecha_factura_intermediaria || null,
            fecha_vencimiento_intermediaria: datos.fecha_vencimiento_intermediaria || null,
            moneda_principal: datos.moneda_principal || 'USD',
            monto_factura: datos.monto_factura || 0,
            fecha_factura: datos.fecha_factura || null,
            fecha_vencimiento_factura: datos.fecha_vencimiento_factura || null,
            fecha_despacho: datos.fecha_despacho || null,
            nro_despacho: datos.nro_despacho || null,
            tc_usd: datos.tc_usd || null,
            tc_eur: datos.tc_eur || null,
            tc_gbp: datos.tc_gbp || null,
            flete_moneda: datos.flete_moneda || 'USD',
            flete_monto: datos.flete_monto || 0,
            seguro_moneda: datos.seguro_moneda || 'USD',
            seguro_monto: datos.seguro_monto || 0,
            fob_moneda: datos.fob_moneda || 'USD',
            fob_monto: datos.fob_monto || 0,
            fob_parte: datos.fob_parte || 0,
            flete_parte: datos.flete_parte || 0,
            seguro_parte: datos.seguro_parte || 0,
            es_consolidado: datos.es_consolidado || false,
            volumen_m3: datos.volumen_m3 || null,
            peso_kg: datos.peso_kg || null
        });

        await ConsolidadoProveedor.destroy({ where: { costeo_id: id } });
        if (datos.es_consolidado && datos.proveedores_consolidado && datos.proveedores_consolidado.length > 0) {
            for (const p of datos.proveedores_consolidado) {
                if (p.nombre) {
                    await ConsolidadoProveedor.create({
                        costeo_id: id,
                        nombre_proveedor: p.nombre,
                        fob_total: parseFloat(p.fob_total) || 0,
                        moneda: p.moneda || 'USD',
                        volumen_m3: parseFloat(p.volumen_m3) || null,
                        peso_kg: parseFloat(p.peso_kg) || null
                    });
                }
            }
        }

        await ArticuloCosteo.destroy({ where: { costeo_id: id } });
        if (datos.articulos && datos.articulos.length > 0) {
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
                    impuesto_interno_porcentaje: parseFloat(art.impuesto_interno_porcentaje) || 0,
                    aplica_anmat: art.aplica_anmat !== false,
                    grupo: art.grupo || ''
                });
            }
        }

        await GastosVarios.destroy({ where: { costeo_id: id } });
        if (datos.gastos && datos.gastos.length > 0) {
            for (const g of datos.gastos) {
                if (g.descripcion) {
                    const monedaGasto = (g.moneda || 'USD').toUpperCase();
                    const montoOriginal = parseFloat(g.monto) || 0;
                    const recargo = parseFloat(g.recargo) || 0;

                    let tcGasto = 1;
                    if (monedaGasto === 'USD') {
                        tcGasto = parseFloat(datos.tc_usd) || 1;
                    } else if (monedaGasto === 'EUR') {
                        tcGasto = parseFloat(datos.tc_eur) || parseFloat(datos.tc_usd) || 1;
                    } else if (monedaGasto === 'GBP') {
                        tcGasto = parseFloat(datos.tc_gbp) || parseFloat(datos.tc_usd) || 1;
                    }

                    let montoARS = montoOriginal * tcGasto;
                    if (recargo > 0) {
                        montoARS = montoARS * (1 + recargo / 100);
                    }

                    await GastosVarios.create({
                        costeo_id: id,
                        descripcion: g.descripcion,
                        proveedor_gasto: g.proveedor_gasto || '',
                        nro_comprobante: g.nro_comprobante || 'ESTIMADO',
                        moneda: monedaGasto,
                        monto: montoOriginal,
                        recargo: recargo,
                        monto_ars: montoARS,
                        grupo: g.grupo || '',
                        prorratear_consolidado: g.prorratear_consolidado || false,
                        metodo_prorrateo: g.metodo_prorrateo || 'no_prorratear',
                        observaciones: g.observaciones || ''
                    });
                }
            }
        }

        res.json({ mensaje: 'Costeo actualizado exitosamente', id: id });
    } catch (error) {
        console.error('Error al actualizar costeo:', error);
        res.status(500).json({ error: 'Error al actualizar costeo', detalles: error.message });
    }
});

// Eliminar costeo
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const costeo = await Costeo.findByPk(id);

        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }

        await costeo.destroy();
        res.json({ mensaje: 'Costeo eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar costeo:', error);
        res.status(500).json({ error: 'Error al eliminar costeo' });
    }
});

// Duplicar costeo
router.post('/:id/duplicar', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevo_nombre } = req.body;

        const costeoOriginal = await Costeo.findByPk(id, {
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosAduana, as: 'gastos_aduana' },
                { model: GastosVarios, as: 'gastos_varios' },
                { model: ConsolidadoProveedor, as: 'proveedores_consolidado' }
            ]
        });

        if (!costeoOriginal) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }

        const nuevoCosteo = await Costeo.create({
            nombre_costeo: nuevo_nombre || `${costeoOriginal.nombre_costeo} (copia)`,
            proveedor: costeoOriginal.proveedor,
            empresa_intermediaria: costeoOriginal.empresa_intermediaria,
            factura_nro: costeoOriginal.factura_nro,
            factura_intermediaria: costeoOriginal.factura_intermediaria,
            fecha_factura_intermediaria: costeoOriginal.fecha_factura_intermediaria,
            fecha_vencimiento_intermediaria: costeoOriginal.fecha_vencimiento_intermediaria,
            moneda_principal: costeoOriginal.moneda_principal,
            monto_factura: costeoOriginal.monto_factura,
            fecha_factura: costeoOriginal.fecha_factura,
            fecha_vencimiento_factura: costeoOriginal.fecha_vencimiento_factura,
            fecha_despacho: null,
            nro_despacho: null,
            tc_usd: costeoOriginal.tc_usd,
            tc_eur: costeoOriginal.tc_eur,
            tc_gbp: costeoOriginal.tc_gbp,
            flete_moneda: costeoOriginal.flete_moneda,
            flete_monto: costeoOriginal.flete_monto,
            seguro_moneda: costeoOriginal.seguro_moneda,
            seguro_monto: costeoOriginal.seguro_monto,
            fob_moneda: costeoOriginal.fob_moneda,
            fob_monto: costeoOriginal.fob_monto,
            fob_parte: costeoOriginal.fob_parte,
            flete_parte: costeoOriginal.flete_parte,
            seguro_parte: costeoOriginal.seguro_parte,
            es_consolidado: costeoOriginal.es_consolidado,
            volumen_m3: costeoOriginal.volumen_m3,
            peso_kg: costeoOriginal.peso_kg,
            usuario_id: req.usuario.id,
            empresa_id: costeoOriginal.empresa_id,
            estado: 'borrador'
        });

        if (costeoOriginal.proveedores_consolidado && costeoOriginal.proveedores_consolidado.length > 0) {
            for (const prov of costeoOriginal.proveedores_consolidado) {
                await ConsolidadoProveedor.create({
                    costeo_id: nuevoCosteo.id,
                    nombre_proveedor: prov.nombre_proveedor,
                    fob_total: prov.fob_total,
                    moneda: prov.moneda,
                    volumen_m3: prov.volumen_m3,
                    peso_kg: prov.peso_kg
                });
            }
        }

        if (costeoOriginal.articulos && costeoOriginal.articulos.length > 0) {
            for (const art of costeoOriginal.articulos) {
                await ArticuloCosteo.create({
                    costeo_id: nuevoCosteo.id,
                    codigo_goodies: art.codigo_goodies,
                    codigo_proveedor: art.codigo_proveedor,
                    nombre: art.nombre,
                    cantidad_cajas: art.cantidad_cajas,
                    unidades_por_caja: art.unidades_por_caja,
                    unidades_totales: art.unidades_totales,
                    moneda_origen: art.moneda_origen,
                    valor_unitario_origen: art.valor_unitario_origen,
                    importe_total_origen: art.importe_total_origen,
                    valor_proveedor_origen: art.valor_proveedor_origen,
                    derechos_porcentaje: art.derechos_porcentaje,
                    impuesto_interno_porcentaje: art.impuesto_interno_porcentaje,
                    aplica_anmat: art.aplica_anmat,
                    grupo: art.grupo
                });
            }
        }

        if (costeoOriginal.gastos_varios && costeoOriginal.gastos_varios.length > 0) {
            for (const gasto of costeoOriginal.gastos_varios) {
                await GastosVarios.create({
                    costeo_id: nuevoCosteo.id,
                    descripcion: gasto.descripcion,
                    proveedor_gasto: gasto.proveedor_gasto,
                    nro_comprobante: gasto.nro_comprobante,
                    moneda: gasto.moneda,
                    monto: gasto.monto,
                    recargo: gasto.recargo,
                    monto_ars: gasto.monto_ars,
                    grupo: gasto.grupo,
                    prorratear_consolidado: gasto.prorratear_consolidado,
                    metodo_prorrateo: gasto.metodo_prorrateo,
                    observaciones: gasto.observaciones
                });
            }
        }

        res.json({
            mensaje: 'Costeo duplicado exitosamente',
            id: nuevoCosteo.id,
            nombre: nuevoCosteo.nombre_costeo
        });
    } catch (error) {
        console.error('Error al duplicar costeo:', error);
        res.status(500).json({ error: 'Error al duplicar costeo', detalles: error.message });
    }
});

module.exports = router;