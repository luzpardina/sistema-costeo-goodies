const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const costeoController = require('../controllers/costeoController');
const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios, ConsolidadoProveedor, CatalogoArticulo, Revaluacion, RevaluacionArticulo } = require('../models');
const CalculosService = require('../services/calculosService');
const { requireRole, noVisualizador } = require('../middleware/roles');
const { registrarAuditoria } = require('../utils/auditoria');
const { cacheMiddleware, invalidateCache } = require('../utils/cache');

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

// Buscador rápido global
router.get('/buscar', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.json({ articulos: [], costeos: [] });

        const qLike = '%' + q + '%';

        // Buscar artículos en catálogo
        const catalogoResults = await CatalogoArticulo.findAll({
            where: {
                [Op.or]: [
                    { codigo_goodies: { [Op.iLike]: qLike } },
                    { nombre: { [Op.iLike]: qLike } },
                    { proveedor: { [Op.iLike]: qLike } },
                    { empresa_fabrica: { [Op.iLike]: qLike } },
                    { marca: { [Op.iLike]: qLike } }
                ]
            },
            limit: 15,
            order: [['codigo_goodies', 'ASC']]
        });

        // Para cada artículo encontrado, buscar en qué costeos aparece
        const articulosConCosteos = [];
        for (const cat of catalogoResults) {
            const artEnCosteos = await ArticuloCosteo.findAll({
                where: { codigo_goodies: cat.codigo_goodies },
                include: [{
                    model: Costeo, as: 'costeo',
                    attributes: ['id', 'nombre_costeo', 'estado', 'fecha_despacho', 'proveedor']
                }],
                order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']],
                limit: 5
            });

            const ultimoCosteo = artEnCosteos.find(a => a.costeo && a.costeo.estado === 'calculado' && a.costeo.fecha_despacho);
            
            articulosConCosteos.push({
                codigo_goodies: cat.codigo_goodies,
                nombre: cat.nombre,
                proveedor: cat.proveedor || '',
                empresa_fabrica: cat.empresa_fabrica || '',
                marca: cat.marca || '',
                rubro: cat.rubro || '',
                activo: cat.habilitado !== false && cat.proveedor_activo !== false,
                ultimo_costo: ultimoCosteo ? parseFloat(ultimoCosteo.costo_unitario_neto_ars) || 0 : null,
                ultimo_costeo_nombre: ultimoCosteo && ultimoCosteo.costeo ? ultimoCosteo.costeo.nombre_costeo : null,
                ultimo_costeo_fecha: ultimoCosteo && ultimoCosteo.costeo ? ultimoCosteo.costeo.fecha_despacho : null,
                cantidad_costeos: artEnCosteos.length,
                costeos: artEnCosteos.filter(a => a.costeo).map(a => ({
                    id: a.costeo.id,
                    nombre: a.costeo.nombre_costeo,
                    estado: a.costeo.estado,
                    fecha_despacho: a.costeo.fecha_despacho,
                    costo_neto: parseFloat(a.costo_unitario_neto_ars) || 0
                }))
            });
        }

        // Buscar costeos por nombre
        const costeoResults = await Costeo.findAll({
            where: {
                [Op.or]: [
                    { nombre_costeo: { [Op.iLike]: qLike } },
                    { proveedor: { [Op.iLike]: qLike } },
                    { nro_despacho: { [Op.iLike]: qLike } }
                ]
            },
            attributes: ['id', 'nombre_costeo', 'proveedor', 'estado', 'fecha_despacho', 'moneda_principal'],
            limit: 10,
            order: [['fecha_despacho', 'DESC NULLS LAST']]
        });

        res.json({
            articulos: articulosConCosteos,
            costeos: costeoResults
        });
    } catch (error) {
        console.error('Error en búsqueda global:', error);
        res.status(500).json({ error: error.message });
    }
});

// Historial de costos de un artículo
router.get('/historial/:codigo', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const codigo = req.params.codigo;

        const articulos = await ArticuloCosteo.findAll({
            where: { codigo_goodies: { [Op.iLike]: codigo } },
            include: [{
                model: Costeo, as: 'costeo',
                attributes: ['id', 'nombre_costeo', 'estado', 'fecha_despacho', 'proveedor', 'tc_usd', 'tc_eur', 'tc_gbp', 'moneda_principal']
            }],
            order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'ASC']]
        });

        const historial = articulos.filter(a => a.costeo && a.costeo.fecha_despacho).map(a => ({
            costeo_id: a.costeo.id,
            costeo_nombre: a.costeo.nombre_costeo,
            estado: a.costeo.estado,
            fecha_despacho: a.costeo.fecha_despacho,
            proveedor: a.costeo.proveedor,
            moneda: a.costeo.moneda_principal,
            tc_usd: parseFloat(a.costeo.tc_usd) || 0,
            fob_unitario: parseFloat(a.valor_proveedor_origen) || parseFloat(a.valor_unitario_origen) || 0,
            costo_neto: parseFloat(a.costo_unitario_neto_ars) || 0,
            unidades: parseInt(a.unidades_totales) || 0
        }));

        // Datos del catálogo
        const catalogo = await CatalogoArticulo.findOne({ where: { codigo_goodies: { [Op.iLike]: codigo } } });

        res.json({
            codigo_goodies: codigo,
            nombre: catalogo ? catalogo.nombre : (articulos[0] ? articulos[0].nombre : codigo),
            proveedor: catalogo ? catalogo.proveedor : '',
            marca: catalogo ? catalogo.marca : '',
            historial
        });
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ error: error.message });
    }
});

// Listar costeos
router.get('/listar', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const sortBy = req.query.sort || 'fecha_despacho';
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 0; // 0 = all (backwards compatible)
        const offset = page > 0 && limit > 0 ? (page - 1) * limit : 0;

        const orderClause = sortBy === 'actualizado'
            ? [['updated_at', 'DESC']]
            : [['fecha_despacho', 'DESC NULLS LAST'], ['created_at', 'DESC']];
        
        const queryOpts = {
            order: orderClause,
            include: [
                { model: ArticuloCosteo, as: 'articulos', attributes: ['id', 'codigo_goodies', 'nombre', 'unidades_totales'] }
            ]
        };
        if (limit > 0) {
            queryOpts.limit = limit;
            queryOpts.offset = offset;
        }

        const costeos = await Costeo.findAll(queryOpts);
        const total = limit > 0 ? await Costeo.count() : costeos.length;

        // Buscar marcas del catálogo para todos los códigos de artículos
        const todosCodigos = [...new Set(costeos.flatMap(c => (c.articulos || []).map(a => a.codigo_goodies).filter(Boolean)))];
        const catalogoItems = todosCodigos.length > 0 ? await CatalogoArticulo.findAll({
            where: { codigo_goodies: { [Op.in]: todosCodigos } },
            attributes: ['codigo_goodies', 'marca', 'empresa_fabrica'],
            raw: true
        }) : [];
        const marcaPorCodigo = {};
        const fabricaPorCodigo = {};
        catalogoItems.forEach(ci => { 
            if (ci.marca) marcaPorCodigo[ci.codigo_goodies] = ci.marca;
            if (ci.empresa_fabrica) fabricaPorCodigo[ci.codigo_goodies] = ci.empresa_fabrica;
        });

        const lista = costeos.map(c => {
            const marcasSet = new Set();
            const fabricasSet = new Set();
            (c.articulos || []).forEach(a => { 
                if (marcaPorCodigo[a.codigo_goodies]) marcasSet.add(marcaPorCodigo[a.codigo_goodies]);
                if (fabricaPorCodigo[a.codigo_goodies]) fabricasSet.add(fabricaPorCodigo[a.codigo_goodies]);
            });
            return {
                id: c.id,
                nombre_costeo: c.nombre_costeo,
                proveedor: c.proveedor,
                empresa_fabrica: [...fabricasSet].join(', ') || c.empresa_intermediaria || '',
                marcas: [...marcasSet].join(', '),
                moneda_principal: c.moneda_principal,
                fecha_factura: c.fecha_factura,
                fecha_despacho: c.fecha_despacho,
                nro_despacho: c.nro_despacho,
                estado: c.estado,
                unidades_totales: c.unidades_totales,
                costo_total_ars: c.costo_total_ars,
                fob_total_divisa: c.fob_total_usd,
                es_consolidado: c.es_consolidado,
                cant_articulos: c.articulos ? c.articulos.length : 0,
                articulos_nombres: c.articulos ? c.articulos.map(a => (a.codigo_goodies || '') + '|' + (a.nombre || '') + '|' + (a.unidades_totales || 0)).join(';;') : ''
            };
        });

        if (limit > 0) {
            res.json({ data: lista, total, page, limit, pages: Math.ceil(total / limit) });
        } else {
            res.json(lista); // Backwards compatible: array for no pagination
        }
    } catch (error) {
        console.error('Error al listar costeos:', error);
        res.status(500).json({ error: 'Error al listar costeos' });
    }
});

router.get('/ultimos-costos', auth, cacheMiddleware(600), async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const revaluacionId = req.query.revaluacion_id;
        
        // Si se pidió una revaluación específica, usar esos costos
        if (revaluacionId) {
            let rev = await Revaluacion.findByPk(revaluacionId, {
                include: [{ model: RevaluacionArticulo, as: 'articulos' }]
            });
            
            if (!rev) {
                return res.status(404).json({ error: 'Revaluación no encontrada. Puede que haya sido eliminada. Seleccioná otra fuente de costos.' });
            }
            
            const codigos = rev.articulos.map(a => a.codigo_goodies).filter(Boolean);
            const catItems = codigos.length > 0 ? await CatalogoArticulo.findAll({
                where: { codigo_goodies: { [Op.in]: codigos } },
                attributes: ['codigo_goodies', 'proveedor', 'empresa_fabrica', 'marca', 'rubro', 'iva_porcentaje', 'imp_interno_porcentaje', 'proveedor_activo', 'empresa_fabrica_activa', 'habilitado'],
                raw: true
            }) : [];
            const catMap = {};
            catItems.forEach(ci => { catMap[ci.codigo_goodies] = ci; });
            
            const resultado = rev.articulos
                .filter(a => a.costo_neto_revaluado && parseFloat(a.costo_neto_revaluado) > 0)
                .map(a => {
                    const cat = catMap[a.codigo_goodies] || {};
                    return {
                        codigo_goodies: a.codigo_goodies,
                        nombre: a.nombre,
                        proveedor: cat.proveedor || a.proveedor || '',
                        empresa_fabrica: cat.empresa_fabrica || '',
                        marca: cat.marca || '',
                        rubro: cat.rubro || '',
                        moneda_fob: '',
                        valor_fob: a.fob_intermediaria || a.fob_proveedor_origen,
                        costo_neto: a.costo_neto_revaluado,
                        costo_con_impuestos: null,
                        costo_anterior: a.costo_neto_original,
                        diferencia_pct: a.diferencia_costo_pct,
                        fecha_despacho: a.fecha_despacho,
                        nombre_costeo: a.nombre_costeo_origen,
                        fuente: 'Revaluación: ' + rev.motivo,
                        iva_porcentaje: cat.iva_porcentaje,
                        imp_interno_porcentaje: cat.imp_interno_porcentaje
                    };
                });
            
            return res.json(resultado);
        }
        
        // Default: último costo por despacho
        const costeos = await Costeo.findAll({
            where: { 
                estado: 'calculado',
                [Op.or]: [
                    { fecha_despacho: { [Op.ne]: null } },
                    { nro_despacho: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } }
                ]
            },
            include: [{ model: ArticuloCosteo, as: 'articulos' }],
            order: [['fecha_despacho', 'DESC']]
        });

        const ultimosCostos = {};
        const ultimoCosteoId = {};
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
                    ultimoCosteoId[codigo] = costeo.id;
                } else if (!anteriores[codigo] && costeo.id !== ultimoCosteoId[codigo]) {
                    anteriores[codigo] = {
                        costo_neto: art.costo_unitario_neto_ars,
                        costo_con_impuestos: art.costo_unitario_ars,
                        valor_fob: art.fob_unitario_usd,
                        proveedor: costeo.proveedor,
                        nombre_costeo: costeo.nombre_costeo,
                        fecha_despacho: costeo.fecha_despacho
                    };
                }
            }
        }

        const resultado = Object.values(ultimosCostos)
            .filter(art => art.costo_neto && parseFloat(art.costo_neto) > 0)
            .map(art => {
            const anterior = anteriores[art.codigo_goodies] || null;
            let diferenciaPct = null;
            if (anterior && anterior.costo_neto && art.costo_neto) {
                diferenciaPct = ((art.costo_neto - anterior.costo_neto) / anterior.costo_neto) * 100;
            }
            return {
                ...art,
                costo_anterior: anterior ? anterior.costo_neto : null,
                costo_anterior_con_impuestos: anterior ? anterior.costo_con_impuestos : null,
                anterior_proveedor: anterior ? anterior.proveedor : null,
                anterior_nombre_costeo: anterior ? anterior.nombre_costeo : null,
                anterior_fecha_despacho: anterior ? anterior.fecha_despacho : null,
                diferencia_pct: diferenciaPct
            };
        });

        // Enriquecer con datos del catálogo y filtrar inactivos
        const codigos = resultado.map(r => r.codigo_goodies);
        const catItems = codigos.length > 0 ? await CatalogoArticulo.findAll({
            where: { codigo_goodies: { [Op.in]: codigos } },
            attributes: ['codigo_goodies', 'proveedor', 'empresa_fabrica', 'marca', 'rubro', 'iva_porcentaje', 'imp_interno_porcentaje', 'proveedor_activo', 'empresa_fabrica_activa', 'habilitado'],
            raw: true
        }) : [];
        const catMap = {};
        catItems.forEach(ci => { catMap[ci.codigo_goodies] = ci; });
        resultado.forEach(r => {
            const cat = catMap[r.codigo_goodies];
            if (cat) {
                r.proveedor = cat.proveedor || r.proveedor || '';
                r.empresa_fabrica = cat.empresa_fabrica || '';
                r.marca = cat.marca || '';
                r.rubro = cat.rubro || '';
                r.iva_porcentaje = parseFloat(cat.iva_porcentaje) || 0.21;
                r.imp_interno_porcentaje = parseFloat(cat.imp_interno_porcentaje) || 0;
                r.proveedor_activo = cat.proveedor_activo !== false;
                r.empresa_fabrica_activa = cat.empresa_fabrica_activa !== false;
                r.articulo_activo = cat.habilitado !== false;
            } else {
                r.marca = '';
                r.empresa_fabrica = '';
                r.rubro = '';
                r.iva_porcentaje = 0.21;
                r.imp_interno_porcentaje = 0;
                r.proveedor_activo = true;
                r.empresa_fabrica_activa = true;
                r.articulo_activo = true;
            }
        });

        // Filtrar: solo artículos con proveedor activo, fábrica activa y artículo activo
        const resultadoFiltrado = resultado.filter(r => r.proveedor_activo && r.empresa_fabrica_activa && r.articulo_activo);

        res.json(resultadoFiltrado);
    } catch (error) {
        console.error('Error al obtener ultimos costos:', error);
        res.status(500).json({ error: 'Error al obtener ultimos costos' });
    }
});

// Detalle de articulo (ultimo y anterior) con gastos
router.get('/detalle-articulo/:codigo', auth, async (req, res) => {
    try {
        const { codigo } = req.params;

        const { Op } = require('sequelize');
        const costeos = await Costeo.findAll({
            where: { 
                estado: 'calculado',
                [Op.or]: [
                    { fecha_despacho: { [Op.ne]: null } },
                    { nro_despacho: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } }
                ]
            },
            include: [
                {
                    model: ArticuloCosteo,
                    as: 'articulos',
                    where: { codigo_goodies: codigo }
                },
                {
                    model: GastosVarios,
                    as: 'gastos_varios'
                },
                {
                    model: GastosAduana,
                    as: 'gastos_aduana'
                }
            ],
            order: [['fecha_despacho', 'DESC']]
        });

        if (costeos.length === 0) {
            return res.status(404).json({ error: 'Articulo no encontrado' });
        }

        const ultimo = costeos[0];
        let anterior = null;
        for (let i = 1; i < costeos.length; i++) {
            if (costeos[i].id !== ultimo.id) {
                anterior = costeos[i];
                break;
            }
        }

        const armarGastos = (costeo) => {
            if (!costeo) return [];
            const gastos = [];
            // Gastos aduana
            if (costeo.gastos_aduana) {
                const ga = costeo.gastos_aduana;
                if (ga.derechos_impo && parseFloat(ga.derechos_impo) > 0) gastos.push({ descripcion: 'Derechos Importación', monto_ars: parseFloat(ga.derechos_impo) });
                if (ga.tasa_estadistica && parseFloat(ga.tasa_estadistica) > 0) gastos.push({ descripcion: 'Tasa Estadística', monto_ars: parseFloat(ga.tasa_estadistica) });
            }
            // Gastos varios
            if (costeo.gastos_varios && costeo.gastos_varios.length > 0) {
                costeo.gastos_varios.forEach(g => {
                    gastos.push({ descripcion: g.descripcion, monto_ars: parseFloat(g.monto_ars) || 0, moneda: g.moneda, monto_orig: parseFloat(g.monto) || 0 });
                });
            }
            return gastos;
        };

        // Calcular total gastos por unidad
        const calcGastosPorUnidad = (costeo, gastos) => {
            const totalUnidades = costeo.articulos.reduce((sum, a) => sum + (parseFloat(a.unidades_totales) || 0), 0);
            const totalGastos = gastos.reduce((sum, g) => sum + (g.monto_ars || 0), 0);
            return totalUnidades > 0 ? totalGastos / totalUnidades : 0;
        };

        const gastosUltimo = armarGastos(ultimo);
        const gastosAnterior = anterior ? armarGastos(anterior) : [];

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
                nombre: ultimo.articulos[0].nombre,
                gastos: gastosUltimo,
                total_gastos_ars: gastosUltimo.reduce((s, g) => s + (g.monto_ars || 0), 0),
                gastos_por_unidad: calcGastosPorUnidad(ultimo, gastosUltimo)
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
                nombre: anterior.articulos[0].nombre,
                gastos: gastosAnterior,
                total_gastos_ars: gastosAnterior.reduce((s, g) => s + (g.monto_ars || 0), 0),
                gastos_por_unidad: calcGastosPorUnidad(anterior, gastosAnterior)
            };
        }

        res.json(resultado);
    } catch (error) {
        console.error('Error al obtener detalle:', error);
        res.status(500).json({ error: 'Error al obtener detalle del articulo' });
    }
});

// Exportar comparativo de 2 costeos a Excel
// Body: { ids: [id1, id2], secciones: { tc, baseAduana, gastosVarios, gastosAduana, articulosFOB, articulosCostoNeto } }
// El orden de ids define la base del cálculo: pctDif = (c2 - c1) / c1
// IMPORTANTE: declarada antes de '/:id' para evitar que Express la trate como :id='comparativo-export'
router.post('/comparativo-export', auth, async (req, res) => {
    try {
        const { ids, secciones } = req.body || {};
        if (!Array.isArray(ids) || ids.length !== 2) {
            return res.status(400).json({ error: 'Se requieren exactamente 2 ids de costeos' });
        }
        const seccionesNormalizadas = secciones || {
            tc: true, baseAduana: true, gastosVarios: true,
            gastosAduana: true, articulosFOB: true, articulosCostoNeto: true
        };
        const ComparativoExportService = require('../services/comparativoExportService');
        const resultado = await ComparativoExportService.exportarComparativo(ids, seccionesNormalizadas);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${resultado.filename}"`);
        res.send(resultado.buffer);
    } catch (error) {
        console.error('Error al exportar comparativo:', error);
        res.status(500).json({ error: 'Error al exportar comparativo', detalles: error.message });
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
        invalidateCache('/api/costeos/ultimos-costos');
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
        const { Op } = require('sequelize');

        const costeo = await Costeo.findByPk(id);
        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }

        // Si estaba calculado, resetear estado porque los datos cambiaron
        if (costeo.estado === 'calculado') {
            await costeo.update({ estado: 'borrador' });
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
            peso_kg: datos.peso_kg || null,
            metodo_prorrateo: datos.metodo_prorrateo || null,
            estado: 'borrador'
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
        const catalogoSyncInfo = {};
        if (datos.articulos && datos.articulos.length > 0) {
            for (const art of datos.articulos) {
                const unidadesTotales = (parseFloat(art.cantidad_cajas) || 0) * (parseFloat(art.unidades_por_caja) || 0);
                const valorOrigen = parseFloat(art.valor_unitario_origen) || 0;
                const importeTotal = unidadesTotales * valorOrigen;

                await ArticuloCosteo.create({
                    costeo_id: id,
                    codigo_goodies: art.codigo_goodies || 'S/COD',
                    codigo_proveedor: art.codigo_proveedor || '',
                    nombre: art.nombre,
                    cantidad_cajas: parseFloat(art.cantidad_cajas) || 0,
                    unidades_por_caja: parseFloat(art.unidades_por_caja) || 0,
                    unidades_totales: unidadesTotales,
                    moneda_origen: datos.moneda_principal || 'USD',
                    valor_unitario_origen: valorOrigen,
                    importe_total_origen: importeTotal,
                    valor_proveedor_origen: art.valor_fabrica ? parseFloat(art.valor_fabrica) : 0,
                    derechos_porcentaje: parseFloat(art.derechos_porcentaje) || 0,
                    impuesto_interno_porcentaje: parseFloat(art.impuesto_interno_porcentaje) || 0,
                    aplica_anmat: art.aplica_anmat !== false,
                    grupo: art.grupo || ''
                });

                // Detectar diferencias proveedor/empresa_fabrica vs catálogo (NO aplica, solo informa)
                if (art.codigo_goodies && art.codigo_goodies !== 'S/COD') {
                    const catArt = await CatalogoArticulo.findOne({ where: { codigo_goodies: { [Op.iLike]: art.codigo_goodies } } });
                    if (catArt) {
                        if (datos.proveedor && datos.proveedor.trim() !== '' && datos.proveedor !== catArt.proveedor) {
                            if (!catalogoSyncInfo.proveedor_cambios) catalogoSyncInfo.proveedor_cambios = [];
                            if (!catalogoSyncInfo.proveedor_cambios.find(c => c.codigo === art.codigo_goodies)) {
                                catalogoSyncInfo.proveedor_cambios.push({ codigo: art.codigo_goodies, antes: catArt.proveedor || '(vacío)', despues: datos.proveedor });
                            }
                        }
                        if (datos.empresa_intermediaria && datos.empresa_intermediaria.trim() !== '' && datos.empresa_intermediaria !== catArt.empresa_fabrica) {
                            if (!catalogoSyncInfo.fabrica_cambios) catalogoSyncInfo.fabrica_cambios = [];
                            if (!catalogoSyncInfo.fabrica_cambios.find(c => c.codigo === art.codigo_goodies)) {
                                catalogoSyncInfo.fabrica_cambios.push({ codigo: art.codigo_goodies, antes: catArt.empresa_fabrica || '(vacío)', despues: datos.empresa_intermediaria });
                            }
                        }
                    }
                }
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
                        observaciones: g.observaciones || '',
                        no_contable: g.no_contable || false
                    });
                }
            }
        }

        res.json({ mensaje: 'Costeo actualizado exitosamente', id: id, catalogo_sync: catalogoSyncInfo });
    } catch (error) {
        console.error('Error al actualizar costeo:', error);
        res.status(500).json({ error: 'Error al actualizar costeo', detalles: error.message });
    }
});

// Aplicar sincronización de proveedor/fábrica al catálogo (después de confirmar)
router.post('/sync-catalogo', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { proveedor_cambios, fabrica_cambios } = req.body;
        let actualizados = 0;

        if (proveedor_cambios && proveedor_cambios.length > 0) {
            for (const c of proveedor_cambios) {
                const art = await CatalogoArticulo.findOne({ where: { codigo_goodies: { [Op.iLike]: c.codigo } } });
                if (art) { await art.update({ proveedor: c.despues }); actualizados++; }
            }
        }
        if (fabrica_cambios && fabrica_cambios.length > 0) {
            for (const c of fabrica_cambios) {
                const art = await CatalogoArticulo.findOne({ where: { codigo_goodies: { [Op.iLike]: c.codigo } } });
                if (art) { await art.update({ empresa_fabrica: c.despues }); actualizados++; }
            }
        }
        res.json({ ok: true, actualizados });
    } catch (error) {
        console.error('Error sincronizando catálogo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar costeo
router.delete('/:id', auth, noVisualizador, async (req, res) => {
    try {
        const { id } = req.params;
        const costeo = await Costeo.findByPk(id);

        if (!costeo) {
            return res.status(404).json({ error: 'Costeo no encontrado' });
        }

        await costeo.destroy(); // soft-delete (paranoid mode)
        await registrarAuditoria(req, 'eliminar', 'costeo', id, 'Eliminado: ' + (costeo.nombre_costeo || id));
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
            metodo_prorrateo: costeoOriginal.metodo_prorrateo,
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
                    observaciones: gasto.observaciones,
                    no_contable: gasto.no_contable || false
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

// Reporte Importe Despacho — presupuesto de impuestos aduana
router.get('/reporte-despacho/:id', auth, async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const costeo = await Costeo.findByPk(req.params.id, {
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosVarios, as: 'gastos_varios' }
            ]
        });
        if (!costeo) return res.status(404).json({ error: 'Costeo no encontrado' });

        const monedaPrincipal = (costeo.moneda_principal || 'USD').toUpperCase();
        let tcPrincipal = parseFloat(costeo.tc_usd) || 0;
        if (monedaPrincipal === 'EUR') tcPrincipal = parseFloat(costeo.tc_eur) || 0;
        if (monedaPrincipal === 'GBP') tcPrincipal = parseFloat(costeo.tc_gbp) || 0;

        // FOB total en divisa y pesos
        let fobTotalDivisa = 0;
        for (const art of costeo.articulos) {
            fobTotalDivisa += parseFloat(art.importe_total_origen) || 0;
        }
        const fobTotalPesos = fobTotalDivisa * tcPrincipal;

        // Flete y seguro en pesos
        const fleteMonto = parseFloat(costeo.flete_monto) || 0;
        const seguroMonto = parseFloat(costeo.seguro_monto) || 0;
        const fleteMoneda = (costeo.flete_moneda || 'USD').toUpperCase();
        const seguroMoneda = (costeo.seguro_moneda || 'USD').toUpperCase();
        let tcFlete = parseFloat(costeo.tc_usd) || 0;
        if (fleteMoneda === 'EUR') tcFlete = parseFloat(costeo.tc_eur) || 0;
        if (fleteMoneda === 'GBP') tcFlete = parseFloat(costeo.tc_gbp) || 0;
        let tcSeguro = parseFloat(costeo.tc_usd) || 0;
        if (seguroMoneda === 'EUR') tcSeguro = parseFloat(costeo.tc_eur) || 0;
        if (seguroMoneda === 'GBP') tcSeguro = parseFloat(costeo.tc_gbp) || 0;
        const fletePesos = fleteMonto * tcFlete;
        const seguroPesos = seguroMonto * tcSeguro;

        // CIF = FOB + Flete + Seguro
        const cifPesos = fobTotalPesos + fletePesos + seguroPesos;

        // Calcular impuestos por artículo
        let totalDerechos = 0;
        let totalEstadistica = 0;
        let totalIVA = 0;
        let totalIVAAdicional = 0;
        let totalImpInterno = 0;
        let totalANMAT = 0;
        const detalleArticulos = [];

        for (const art of costeo.articulos) {
            const importeOrigenDivisa = parseFloat(art.importe_total_origen) || 0;
            const participacion = fobTotalDivisa > 0 ? importeOrigenDivisa / fobTotalDivisa : 0;
            const fobArtPesos = importeOrigenDivisa * tcPrincipal;
            const fleteArt = fletePesos * participacion;
            const seguroArt = seguroPesos * participacion;
            const baseImponible = fobArtPesos + fleteArt + seguroArt;

            const derechosPctRaw = parseFloat(art.derechos_porcentaje) || 0;
            const derechosPct = derechosPctRaw > 1 ? derechosPctRaw / 100 : derechosPctRaw;
            const impInternosPctRaw = parseFloat(art.impuesto_interno_porcentaje) || 0;
            const impInternosPct = impInternosPctRaw > 1 ? impInternosPctRaw / 100 : impInternosPctRaw;

            const derechos = derechosPct > 0 ? baseImponible * derechosPct : 0;
            const estadistica = derechosPct > 0 ? baseImponible * 0.03 : 0;
            const baseIVA = baseImponible + derechos + estadistica;
            const iva = baseIVA * 0.21;
            const ivaAdicional = baseIVA * 0.20;
            const impInterno = impInternosPct > 0 ? baseIVA * impInternosPct : 0;
            const anmat = art.anmat !== false ? fobArtPesos * 0.005 : 0;

            totalDerechos += derechos;
            totalEstadistica += estadistica;
            totalIVA += iva;
            totalIVAAdicional += ivaAdicional;
            totalImpInterno += impInterno;
            totalANMAT += anmat;

            detalleArticulos.push({
                codigo_goodies: art.codigo_goodies,
                nombre: art.nombre,
                unidades: parseInt(art.unidades_totales) || 0,
                fob_divisa: Math.round(importeOrigenDivisa * 100) / 100,
                fob_pesos: Math.round(fobArtPesos * 100) / 100,
                base_imponible: Math.round(baseImponible * 100) / 100,
                derechos_pct: derechosPct * 100,
                derechos: Math.round(derechos * 100) / 100,
                estadistica: Math.round(estadistica * 100) / 100,
                iva: Math.round(iva * 100) / 100,
                iva_adicional: Math.round(ivaAdicional * 100) / 100,
                imp_interno_pct: impInternosPct * 100,
                imp_interno: Math.round(impInterno * 100) / 100,
                anmat: Math.round(anmat * 100) / 100,
                total_impuestos: Math.round((derechos + estadistica + iva + ivaAdicional + impInterno + anmat) * 100) / 100
            });
        }

        const totalImporteTributario = totalDerechos + totalEstadistica + totalIVA + totalIVAAdicional + totalImpInterno + totalANMAT;

        res.json({
            costeo_id: costeo.id,
            nombre_costeo: costeo.nombre_costeo,
            proveedor: costeo.proveedor,
            moneda: monedaPrincipal,
            tc_principal: tcPrincipal,
            fecha_despacho: costeo.fecha_despacho,
            nro_despacho: costeo.nro_despacho,
            fob_divisa: Math.round(fobTotalDivisa * 100) / 100,
            fob_pesos: Math.round(fobTotalPesos * 100) / 100,
            flete_pesos: Math.round(fletePesos * 100) / 100,
            seguro_pesos: Math.round(seguroPesos * 100) / 100,
            cif_pesos: Math.round(cifPesos * 100) / 100,
            resumen: {
                derechos: Math.round(totalDerechos * 100) / 100,
                estadistica: Math.round(totalEstadistica * 100) / 100,
                iva: Math.round(totalIVA * 100) / 100,
                iva_adicional: Math.round(totalIVAAdicional * 100) / 100,
                imp_interno: Math.round(totalImpInterno * 100) / 100,
                anmat: Math.round(totalANMAT * 100) / 100,
                total: Math.round(totalImporteTributario * 100) / 100
            },
            articulos: detalleArticulos
        });
    } catch (error) {
        console.error('Error generando reporte despacho:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
