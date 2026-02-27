const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

// Modelos
const ListaPrecio = require('../models/ListaPrecio');
const AcuerdoComercial = require('../models/AcuerdoComercial');
const PrecioPVP = require('../models/PrecioPVP');
const PrecioActual = require('../models/PrecioActual');
const { ArticuloCosteo, Costeo, CatalogoArticulo } = require('../models');

// =============================================
// LISTAS DE PRECIOS
// =============================================

// Listar todas
router.get('/listas', auth, async (req, res) => {
    try {
        const listas = await ListaPrecio.findAll({ order: [['nombre', 'ASC']] });
        res.json(listas);
    } catch (error) {
        console.error('Error listando listas:', error);
        res.status(500).json({ error: error.message });
    }
});

// Crear lista
router.post('/listas', auth, async (req, res) => {
    try {
        const lista = await ListaPrecio.create(req.body);
        res.json(lista);
    } catch (error) {
        console.error('Error creando lista:', error);
        res.status(500).json({ error: error.message });
    }
});

// Actualizar lista
router.put('/listas/:id', auth, async (req, res) => {
    try {
        const lista = await ListaPrecio.findByPk(req.params.id);
        if (!lista) return res.status(404).json({ error: 'Lista no encontrada' });
        await lista.update(req.body);
        res.json(lista);
    } catch (error) {
        console.error('Error actualizando lista:', error);
        res.status(500).json({ error: error.message });
    }
});

// Eliminar lista
router.delete('/listas/:id', auth, async (req, res) => {
    try {
        await ListaPrecio.destroy({ where: { id: req.params.id } });
        await AcuerdoComercial.destroy({ where: { lista_id: req.params.id } });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seed listas por defecto
router.post('/listas/seed', auth, async (req, res) => {
    try {
        const count = await ListaPrecio.count();
        if (count > 0) return res.json({ message: 'Listas ya existen', count });

        const defaults = [
            { nombre: 'Tradicional', pct_logistico: 5, pct_iibb: 3.5, pct_financiero: 3, pct_comision: 0, pct_margen_cliente: 30 },
            { nombre: 'Distribuidor', pct_logistico: 0, pct_iibb: 3.5, pct_financiero: 3, pct_comision: 0, pct_margen_cliente: 25 },
            { nombre: 'Jumbo', pct_logistico: 5, pct_iibb: 3.5, pct_financiero: 5, pct_comision: 0, pct_margen_cliente: 35 },
            { nombre: 'Coto', pct_logistico: 5, pct_iibb: 3.5, pct_financiero: 5, pct_comision: 0, pct_margen_cliente: 35 },
            { nombre: 'Carrefour', pct_logistico: 5, pct_iibb: 3.5, pct_financiero: 5, pct_comision: 0, pct_margen_cliente: 35 },
            { nombre: 'MercadoLibre', pct_logistico: 0, pct_iibb: 3.5, pct_financiero: 0, pct_comision: 20, pct_margen_cliente: 0 },
            { nombre: 'Tienda Goodies', pct_logistico: 3, pct_iibb: 3.5, pct_financiero: 3, pct_comision: 0, pct_margen_cliente: 0 }
        ];

        await ListaPrecio.bulkCreate(defaults);
        res.json({ message: 'Listas creadas', count: defaults.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// ACUERDOS COMERCIALES
// =============================================

// Listar acuerdos de una lista
router.get('/acuerdos/:listaId', auth, async (req, res) => {
    try {
        const acuerdos = await AcuerdoComercial.findAll({
            where: { lista_id: req.params.listaId },
            order: [['categoria', 'ASC']]
        });
        res.json(acuerdos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Listar todos los acuerdos
router.get('/acuerdos', auth, async (req, res) => {
    try {
        const acuerdos = await AcuerdoComercial.findAll({ order: [['lista_id', 'ASC'], ['categoria', 'ASC']] });
        res.json(acuerdos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear acuerdo
router.post('/acuerdos', auth, async (req, res) => {
    try {
        const acuerdo = await AcuerdoComercial.create(req.body);
        res.json(acuerdo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar acuerdo
router.delete('/acuerdos/:id', auth, async (req, res) => {
    try {
        await AcuerdoComercial.destroy({ where: { id: req.params.id } });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// CÁLCULO DE MÁRGENES (para todas las listas)
// =============================================

router.post('/calcular-margenes', auth, async (req, res) => {
    try {
        const { articulos_pvp } = req.body;
        // articulos_pvp = [{ codigo_goodies, pvp }, ...]

        const listas = await ListaPrecio.findAll({ where: { activa: true } });
        const acuerdos = await AcuerdoComercial.findAll();

        const resultados = [];

        for (const artPvp of articulos_pvp) {
            const { codigo_goodies, pvp } = artPvp;

            // Buscar último costo neto del artículo
            const ultimoArticulo = await ArticuloCosteo.findOne({
                where: { codigo_goodies },
                include: [{ model: Costeo, as: 'costeo', where: { estado: { [Op.ne]: 'borrador' } } }],
                order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
            });

            const costoNeto = ultimoArticulo ? parseFloat(ultimoArticulo.costo_unitario_neto_ars) || 0 : 0;

            // Buscar categoría del artículo en catálogo
            const catalogo = await CatalogoArticulo.findOne({ where: { codigo_goodies } });
            const categoria = catalogo ? (catalogo.rubro || 'Otros') : 'Otros';

            const margenesListas = [];

            for (const lista of listas) {
                const pctMargenCliente = parseFloat(lista.pct_margen_cliente) || 0;
                const pctLogistico = parseFloat(lista.pct_logistico) || 0;
                const pctIIBB = parseFloat(lista.pct_iibb) || 0;
                const pctFinanciero = parseFloat(lista.pct_financiero) || 0;
                const pctComision = parseFloat(lista.pct_comision) || 0;

                // Buscar acuerdo para esta lista + categoría
                const acuerdo = acuerdos.find(a =>
                    a.lista_id === lista.id && a.categoria === categoria
                );
                const pctAcuerdo = acuerdo ? parseFloat(acuerdo.pct_acuerdo) || 0 : 0;

                // Precio facturado = PVP / (1 + % Margen Cliente / 100)
                const precioFacturado = pctMargenCliente > 0 ? pvp / (1 + pctMargenCliente / 100) : pvp;

                // Deducciones sobre precio facturado
                const totalPctDeducciones = pctLogistico + pctIIBB + pctFinanciero + pctComision + pctAcuerdo;
                const deducciones = precioFacturado * (totalPctDeducciones / 100);

                // Ingreso neto Goodies
                const ingresoNeto = precioFacturado - deducciones;

                // Margen Goodies = (Ingreso Neto - Costo Neto) / Costo Neto × 100
                const margenPct = costoNeto > 0 ? ((ingresoNeto - costoNeto) / costoNeto) * 100 : 0;

                margenesListas.push({
                    lista_id: lista.id,
                    lista_nombre: lista.nombre,
                    pvp,
                    precio_facturado: Math.round(precioFacturado * 100) / 100,
                    pct_logistico: pctLogistico,
                    pct_iibb: pctIIBB,
                    pct_financiero: pctFinanciero,
                    pct_comision: pctComision,
                    pct_acuerdo: pctAcuerdo,
                    total_deducciones: Math.round(deducciones * 100) / 100,
                    ingreso_neto: Math.round(ingresoNeto * 100) / 100,
                    costo_neto: Math.round(costoNeto * 100) / 100,
                    margen_pct: Math.round(margenPct * 100) / 100
                });
            }

            resultados.push({
                codigo_goodies,
                nombre: ultimoArticulo ? ultimoArticulo.nombre : (catalogo ? catalogo.nombre : codigo_goodies),
                categoria,
                costo_neto: costoNeto,
                pvp,
                margenes: margenesListas
            });
        }

        res.json(resultados);
    } catch (error) {
        console.error('Error calculando márgenes:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// GUARDAR PVPs
// =============================================

router.post('/pvp', auth, async (req, res) => {
    try {
        const { precios } = req.body;
        // precios = [{ codigo_goodies, pvp_sugerido }]
        for (const p of precios) {
            await PrecioPVP.upsert({
                codigo_goodies: p.codigo_goodies,
                pvp_sugerido: p.pvp_sugerido,
                fecha_vigencia: new Date()
            });
        }
        res.json({ ok: true, count: precios.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Obtener PVPs guardados
router.get('/pvp', auth, async (req, res) => {
    try {
        const pvps = await PrecioPVP.findAll({ order: [['codigo_goodies', 'ASC']] });
        res.json(pvps);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// PRECIOS ACTUALES (carga desde Excel)
// =============================================

router.post('/precios-actuales', auth, async (req, res) => {
    try {
        const { precios } = req.body;
        // precios = [{ codigo_goodies, lista_id, precio_actual }]
        let insertados = 0;
        for (const p of precios) {
            await PrecioActual.create({
                codigo_goodies: p.codigo_goodies,
                lista_id: p.lista_id,
                precio_actual: p.precio_actual,
                fecha_carga: new Date()
            });
            insertados++;
        }
        res.json({ ok: true, count: insertados });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// SIMULADOR DE DESCUENTO
// =============================================

router.post('/simular-descuento', auth, async (req, res) => {
    try {
        const { codigo_goodies, lista_id, precio_actual, cantidad_actual } = req.body;

        // Buscar costo neto
        const ultimoArticulo = await ArticuloCosteo.findOne({
            where: { codigo_goodies },
            include: [{ model: Costeo, as: 'costeo', where: { estado: { [Op.ne]: 'borrador' } } }],
            order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
        });

        const costoNeto = ultimoArticulo ? parseFloat(ultimoArticulo.costo_unitario_neto_ars) || 0 : 0;

        // Buscar lista y sus parámetros
        const lista = await ListaPrecio.findByPk(lista_id);
        if (!lista) return res.status(404).json({ error: 'Lista no encontrada' });

        // Buscar categoría
        const catalogo = await CatalogoArticulo.findOne({ where: { codigo_goodies } });
        const categoria = catalogo ? (catalogo.rubro || 'Otros') : 'Otros';

        const acuerdo = await AcuerdoComercial.findOne({
            where: { lista_id, categoria }
        });
        const pctAcuerdo = acuerdo ? parseFloat(acuerdo.pct_acuerdo) || 0 : 0;

        const pctMargenCliente = parseFloat(lista.pct_margen_cliente) || 0;
        const pctTotal = (parseFloat(lista.pct_logistico) || 0) +
            (parseFloat(lista.pct_iibb) || 0) +
            (parseFloat(lista.pct_financiero) || 0) +
            (parseFloat(lista.pct_comision) || 0) +
            pctAcuerdo;

        // Función para calcular ingreso neto dado un precio de venta
        function calcularIngresoNeto(precioVta) {
            const precioFact = pctMargenCliente > 0 ? precioVta / (1 + pctMargenCliente / 100) : precioVta;
            return precioFact - precioFact * (pctTotal / 100);
        }

        // Ganancia actual
        const ingresoNetoActual = calcularIngresoNeto(precio_actual);
        const gananciaUnitActual = ingresoNetoActual - costoNeto;
        const gananciaTotalActual = gananciaUnitActual * cantidad_actual;

        // Simular 3 escenarios de volumen
        const escenarios = [10, 20, 30].map(aumento => {
            const nuevaCantidad = Math.round(cantidad_actual * (1 + aumento / 100));

            // Precio mínimo para mantener ganancia total = ganancia actual
            // (ingresoNeto(precio) - costoNeto) * nuevaCantidad >= gananciaTotalActual
            // ingresoNeto(precio) >= costoNeto + gananciaTotalActual / nuevaCantidad
            const ingresoNetoMinimo = costoNeto + gananciaTotalActual / nuevaCantidad;

            // Despejar precio de venta desde ingreso neto mínimo
            // ingresoNeto = precioFact * (1 - pctTotal/100)
            // precioFact = ingresoNeto / (1 - pctTotal/100)
            // precioVta = precioFact * (1 + pctMargenCliente/100)
            const precioFactMin = ingresoNetoMinimo / (1 - pctTotal / 100);
            const precioVtaMin = pctMargenCliente > 0 ? precioFactMin * (1 + pctMargenCliente / 100) : precioFactMin;

            const descuentoMaxPct = precio_actual > 0 ? ((precio_actual - precioVtaMin) / precio_actual) * 100 : 0;

            return {
                aumento_volumen_pct: aumento,
                nueva_cantidad: nuevaCantidad,
                precio_minimo: Math.round(precioVtaMin * 100) / 100,
                descuento_max_pct: Math.round(Math.max(0, descuentoMaxPct) * 100) / 100,
                ganancia_total_nueva: Math.round((calcularIngresoNeto(precioVtaMin) - costoNeto) * nuevaCantidad * 100) / 100
            };
        });

        res.json({
            codigo_goodies,
            nombre: ultimoArticulo ? ultimoArticulo.nombre : codigo_goodies,
            lista_nombre: lista.nombre,
            costo_neto: costoNeto,
            precio_actual,
            cantidad_actual,
            ingreso_neto_actual: Math.round(ingresoNetoActual * 100) / 100,
            ganancia_unit_actual: Math.round(gananciaUnitActual * 100) / 100,
            ganancia_total_actual: Math.round(gananciaTotalActual * 100) / 100,
            escenarios
        });
    } catch (error) {
        console.error('Error simulando descuento:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
