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

router.put('/acuerdos/:id', auth, async (req, res) => {
    try {
        const acuerdo = await AcuerdoComercial.findByPk(req.params.id);
        if (!acuerdo) return res.status(404).json({ error: 'Acuerdo no encontrado' });
        await acuerdo.update(req.body);
        res.json(acuerdo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// CÁLCULO DE MÁRGENES (para todas las listas)
// =============================================

// =============================================
// CÁLCULO DE PRECIOS (Costo → Precio Neto → PVP)
// Fórmula: Precio Neto Goodies = Costo / (1 - Σ%)
// Σ% = margen_goodies + logístico + IIBB + financiero + comisión + otro_costo
// =============================================

router.post('/calcular-precios', auth, async (req, res) => {
    try {
        const { codigos } = req.body;
        // codigos = array de codigo_goodies

        const listas = await ListaPrecio.findAll({ order: [['nombre', 'ASC']] });
        const acuerdos = await AcuerdoComercial.findAll();
        const resultados = [];

        for (const codigo_goodies of codigos) {
            // Buscar último costo neto del artículo (solo definitivos)
            const ultimoArticulo = await ArticuloCosteo.findOne({
                where: { codigo_goodies },
                include: [{
                    model: Costeo, as: 'costeo',
                    where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } }
                }],
                order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
            });

            const costoNeto = ultimoArticulo ? parseFloat(ultimoArticulo.costo_unitario_neto_ars) || 0 : 0;
            if (costoNeto === 0) continue;

            // Buscar datos del catálogo (IVA, imp interno, rubro)
            const catalogo = await CatalogoArticulo.findOne({ where: { codigo_goodies } });
            const ivaPct = catalogo ? (parseFloat(catalogo.iva_porcentaje) || 0.21) : 0.21;
            const impInternoPct = catalogo ? (parseFloat(catalogo.imp_interno_porcentaje) || 0) : 0;
            const rubro = catalogo ? (catalogo.rubro || 'Otros') : 'Otros';

            const preciosPorLista = [];

            for (const lista of listas) {
                const pctMargenGoodies = parseFloat(lista.pct_margen_goodies) || 0;
                const pctLogistico = parseFloat(lista.pct_logistico) || 0;
                const pctIIBB = parseFloat(lista.pct_iibb) || 0;
                const pctFinanciero = parseFloat(lista.pct_financiero) || 0;
                const pctComision = parseFloat(lista.pct_comision) || 0;
                const pctOtroCosto = parseFloat(lista.pct_otro) || 0;
                const pctMargenCliente = parseFloat(lista.pct_margen_cliente) || 0;
                const pctMarkupTrad = parseFloat(lista.pct_markup_tradicional) || 0;

                // Buscar acuerdo para esta lista + rubro
                const acuerdo = acuerdos.find(a => a.lista_id === lista.id && a.categoria === rubro);
                const pctAcuerdo = acuerdo ? parseFloat(acuerdo.pct_acuerdo) || 0 : 0;

                // === PASO 1: Precio Neto Goodies (gross-up) ===
                const sumaPctGoodies = pctMargenGoodies + pctLogistico + pctIIBB + pctFinanciero + pctComision + pctOtroCosto + pctAcuerdo;
                const precioNetoGoodies = sumaPctGoodies < 100 ? costoNeto / (1 - sumaPctGoodies / 100) : costoNeto;

                // Desglose para verificación
                const montoMargenGoodies = precioNetoGoodies * (pctMargenGoodies / 100);
                const montoLogistico = precioNetoGoodies * (pctLogistico / 100);
                const montoIIBB = precioNetoGoodies * (pctIIBB / 100);
                const montoFinanciero = precioNetoGoodies * (pctFinanciero / 100);
                const montoComision = precioNetoGoodies * (pctComision / 100);
                const montoOtroCosto = precioNetoGoodies * (pctOtroCosto / 100);
                const montoAcuerdo = precioNetoGoodies * (pctAcuerdo / 100);

                // === PASO 2: Factura Goodies ===
                const montoIVA = precioNetoGoodies * ivaPct;
                const montoImpInterno = precioNetoGoodies * impInternoPct;
                const facturaGoodies = precioNetoGoodies + montoIVA + montoImpInterno;

                // === PASO 3: Precio del cliente de Goodies ===
                // Costo del cliente = Precio Neto Goodies + Internos (pass-through)
                let costoCliente = precioNetoGoodies + (impInternoPct > 0 ? precioNetoGoodies * impInternoPct : 0);
                let precioNetoCliente = null;
                let facturaCliente = null;

                if (pctMargenCliente > 0) {
                    // El cliente aplica margen gross-up sobre su costo
                    precioNetoCliente = costoCliente / (1 - pctMargenCliente / 100);
                    facturaCliente = precioNetoCliente + (precioNetoCliente * ivaPct);
                    // IVA sobre su neto, sin internos (ya están en el costo)
                }

                // === PASO 4: PVP estimado (si hay markup tradicional) ===
                let pvpEstimado = null;
                if (pctMarkupTrad > 0) {
                    // El tradicional toma como costo el precio neto del eslabón anterior + internos
                    const costoTrad = precioNetoCliente ? precioNetoCliente : costoCliente;
                    const precioNetoTrad = costoTrad * (1 + pctMarkupTrad / 100);
                    pvpEstimado = precioNetoTrad + (precioNetoTrad * ivaPct);
                } else if (precioNetoCliente) {
                    // Si no hay markup trad, el PVP es la factura del cliente
                    pvpEstimado = facturaCliente;
                } else {
                    // Venta directa: PVP = factura Goodies
                    pvpEstimado = facturaGoodies;
                }

                preciosPorLista.push({
                    lista_id: lista.id,
                    lista_nombre: lista.nombre,
                    // Paso 1
                    suma_pct: Math.round(sumaPctGoodies * 100) / 100,
                    precio_neto_goodies: Math.round(precioNetoGoodies * 100) / 100,
                    margen_goodies_monto: Math.round(montoMargenGoodies * 100) / 100,
                    logistico_monto: Math.round(montoLogistico * 100) / 100,
                    iibb_monto: Math.round(montoIIBB * 100) / 100,
                    financiero_monto: Math.round(montoFinanciero * 100) / 100,
                    comision_monto: Math.round(montoComision * 100) / 100,
                    otro_costo_monto: Math.round(montoOtroCosto * 100) / 100,
                    acuerdo_monto: Math.round(montoAcuerdo * 100) / 100,
                    // Paso 2
                    iva_pct: ivaPct * 100,
                    imp_interno_pct: impInternoPct * 100,
                    factura_goodies: Math.round(facturaGoodies * 100) / 100,
                    // Paso 3
                    costo_cliente: Math.round(costoCliente * 100) / 100,
                    pct_margen_cliente: pctMargenCliente,
                    precio_neto_cliente: precioNetoCliente ? Math.round(precioNetoCliente * 100) / 100 : null,
                    factura_cliente: facturaCliente ? Math.round(facturaCliente * 100) / 100 : null,
                    // Paso 4
                    pct_markup_trad: pctMarkupTrad,
                    pvp_estimado: pvpEstimado ? Math.round(pvpEstimado * 100) / 100 : null,
                    // Percentages used
                    pcts: { margen_goodies: pctMargenGoodies, logistico: pctLogistico, iibb: pctIIBB, financiero: pctFinanciero, comision: pctComision, otro_costo: pctOtroCosto, acuerdo: pctAcuerdo }
                });
            }

            resultados.push({
                codigo_goodies,
                nombre: ultimoArticulo ? ultimoArticulo.nombre : (catalogo ? catalogo.nombre : codigo_goodies),
                proveedor: catalogo ? (catalogo.proveedor || '') : '',
                rubro,
                costo_neto: Math.round(costoNeto * 100) / 100,
                iva_pct: ivaPct * 100,
                imp_interno_pct: impInternoPct * 100,
                precios: preciosPorLista
            });
        }

        res.json(resultados);
    } catch (error) {
        console.error('Error calculando precios:', error);
        res.status(500).json({ error: error.message });
    }
});

// =============================================
// CÁLCULO DE MÁRGENES (PVP o Precio actual → Margen Goodies)
// Dirección inversa: dado un precio de venta, calcular margen real
// =============================================

router.post('/calcular-margenes', auth, async (req, res) => {
    try {
        const { articulos_pvp } = req.body;
        // articulos_pvp = [{ codigo_goodies, pvp }, ...]

        const listas = await ListaPrecio.findAll({ order: [['nombre', 'ASC']] });
        const acuerdos = await AcuerdoComercial.findAll();

        const resultados = [];

        for (const artPvp of articulos_pvp) {
            const { codigo_goodies, pvp } = artPvp;

            // Buscar último costo neto del artículo
            const ultimoArticulo = await ArticuloCosteo.findOne({
                where: { codigo_goodies },
                include: [{ model: Costeo, as: 'costeo', where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } } }],
                order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
            });

            const costoNeto = ultimoArticulo ? parseFloat(ultimoArticulo.costo_unitario_neto_ars) || 0 : 0;

            // Buscar datos del catálogo
            const catalogo = await CatalogoArticulo.findOne({ where: { codigo_goodies } });
            const ivaPct = catalogo ? (parseFloat(catalogo.iva_porcentaje) || 0.21) : 0.21;
            const impInternoPct = catalogo ? (parseFloat(catalogo.imp_interno_porcentaje) || 0) : 0;
            const rubro = catalogo ? (catalogo.rubro || 'Otros') : 'Otros';

            const margenesListas = [];

            for (const lista of listas) {
                const pctMargenCliente = parseFloat(lista.pct_margen_cliente) || 0;
                const pctMarkupTrad = parseFloat(lista.pct_markup_tradicional) || 0;
                const pctLogistico = parseFloat(lista.pct_logistico) || 0;
                const pctIIBB = parseFloat(lista.pct_iibb) || 0;
                const pctFinanciero = parseFloat(lista.pct_financiero) || 0;
                const pctComision = parseFloat(lista.pct_comision) || 0;
                const pctOtroCosto = parseFloat(lista.pct_otro) || 0;

                const acuerdo = acuerdos.find(a => a.lista_id === lista.id && a.categoria === rubro);
                const pctAcuerdo = acuerdo ? parseFloat(acuerdo.pct_acuerdo) || 0 : 0;

                // === DESANDAR LA CADENA DESDE PVP HACIA ATRÁS ===
                // PVP incluye IVA → sacar IVA
                let precioNetoFinal = pvp / (1 + ivaPct);

                // Si hay markup tradicional → desandar el markup
                let precioNetoEslabonAnterior = precioNetoFinal;
                if (pctMarkupTrad > 0) {
                    precioNetoEslabonAnterior = precioNetoFinal / (1 + pctMarkupTrad / 100);
                }

                // Si hay margen cliente (distribuidor/super) → desandar el gross-up
                let precioNetoGoodiesMasInternos = precioNetoEslabonAnterior;
                if (pctMargenCliente > 0) {
                    precioNetoGoodiesMasInternos = precioNetoEslabonAnterior * (1 - pctMargenCliente / 100);
                }

                // Sacar imp. internos para obtener Precio Neto Goodies puro
                let precioNetoGoodies = precioNetoGoodiesMasInternos;
                if (impInternoPct > 0) {
                    precioNetoGoodies = precioNetoGoodiesMasInternos / (1 + impInternoPct);
                }

                // Deducciones sobre Precio Neto Goodies (son % que Goodies paga de su precio)
                const totalPctDeducciones = pctLogistico + pctIIBB + pctFinanciero + pctComision + pctOtroCosto + pctAcuerdo;
                const deducciones = precioNetoGoodies * (totalPctDeducciones / 100);

                // Ingreso Neto Goodies = Precio Neto - todas las deducciones
                const ingresoNeto = precioNetoGoodies - deducciones;

                // Margen Goodies real = (Ingreso Neto - Costo Neto) / Costo Neto × 100
                const margenPct = costoNeto > 0 ? ((ingresoNeto - costoNeto) / costoNeto) * 100 : 0;

                // Margen sobre precio (para referencia)
                const margenSobrePrecio = precioNetoGoodies > 0 ? ((ingresoNeto - costoNeto) / precioNetoGoodies) * 100 : 0;

                margenesListas.push({
                    lista_id: lista.id,
                    lista_nombre: lista.nombre,
                    pvp,
                    precio_neto_goodies: Math.round(precioNetoGoodies * 100) / 100,
                    total_deducciones: Math.round(deducciones * 100) / 100,
                    ingreso_neto: Math.round(ingresoNeto * 100) / 100,
                    costo_neto: Math.round(costoNeto * 100) / 100,
                    margen_pct: Math.round(margenPct * 100) / 100,
                    margen_sobre_precio: Math.round(margenSobrePrecio * 100) / 100,
                    pcts_usados: { logistico: pctLogistico, iibb: pctIIBB, financiero: pctFinanciero, comision: pctComision, otro_costo: pctOtroCosto, acuerdo: pctAcuerdo, margen_cliente: pctMargenCliente, markup_trad: pctMarkupTrad }
                });
            }

            resultados.push({
                codigo_goodies,
                nombre: ultimoArticulo ? ultimoArticulo.nombre : (catalogo ? catalogo.nombre : codigo_goodies),
                rubro,
                costo_neto: Math.round(costoNeto * 100) / 100,
                iva_pct: ivaPct * 100,
                imp_interno_pct: impInternoPct * 100,
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
