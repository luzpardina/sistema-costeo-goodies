const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole, noVisualizador } = require('../middleware/roles');
const { registrarAuditoria } = require('../utils/auditoria');
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
router.delete('/listas/:id', auth, noVisualizador, async (req, res) => {
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
        const acuerdos = await AcuerdoComercial.findAll({ order: [['lista_id', 'ASC'], ['orden', 'ASC'], ['categoria', 'ASC']] });
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
router.delete('/acuerdos/:id', auth, noVisualizador, async (req, res) => {
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
        const { codigos, lista_ids } = req.body;

        let whereListas = {};
        if (lista_ids && lista_ids.length > 0) {
            whereListas = { id: { [Op.in]: lista_ids } };
        }
        const listas = await ListaPrecio.findAll({ where: whereListas, order: [['nombre', 'ASC']] });
        const todosAcuerdos = await AcuerdoComercial.findAll({ order: [['orden', 'ASC']] });
        const resultados = [];

        for (const codigo_goodies of codigos) {
            const ultimoArticulo = await ArticuloCosteo.findOne({
                where: { codigo_goodies },
                include: [{ model: Costeo, as: 'costeo', where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } } }],
                order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
            });

            const costoNeto = ultimoArticulo ? parseFloat(ultimoArticulo.costo_unitario_neto_ars) || 0 : 0;
            if (costoNeto === 0) continue;

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

                // Buscar TODOS los acuerdos para esta lista que apliquen a este rubro
                const acuerdosLista = todosAcuerdos.filter(a => {
                    if (a.lista_id !== lista.id) return false;
                    const rubrosAcuerdo = (a.rubros || '').split(',').filter(r => r.trim());
                    if (rubrosAcuerdo.length === 0) return true;
                    return rubrosAcuerdo.includes(rubro);
                });

                // Separar acuerdos flat vs cadena
                const acuerdosFlat = acuerdosLista.filter(a => a.tipo_acuerdo === 'flat');
                const acuerdosCadena = acuerdosLista.filter(a => a.tipo_acuerdo !== 'flat').sort((x, y) => (x.orden || 1) - (y.orden || 1));
                const pctAcuerdoFlat = acuerdosFlat.reduce((sum, a) => sum + (parseFloat(a.pct_acuerdo) || 0), 0);

                // Para OC con escalones, calcular tasa efectiva compuesta
                // effective = 1 - (1-p1)(1-p2)(1-p3) en vez de sumar
                let pctAcuerdoCadenaTotal = 0;
                for (const ac of acuerdosCadena) {
                    if (ac.tipo_acuerdo === 'desc_oc') {
                        const p1 = (parseFloat(ac.pct_acuerdo) || 0) / 100;
                        const p2 = (parseFloat(ac.pct_acuerdo_2) || 0) / 100;
                        const p3 = (parseFloat(ac.pct_acuerdo_3) || 0) / 100;
                        let factor = (1 - p1);
                        if (p2 > 0) factor *= (1 - p2);
                        if (p3 > 0) factor *= (1 - p3);
                        const effectiveOC = (1 - factor) * 100;
                        pctAcuerdoCadenaTotal += effectiveOC;
                    } else {
                        pctAcuerdoCadenaTotal += parseFloat(ac.pct_acuerdo) || 0;
                    }
                }

                // === PASO 1: Precio Neto Goodies (gross-up costos + acuerdos flat) ===
                const sumaPctGoodies = pctMargenGoodies + pctLogistico + pctIIBB + pctFinanciero + pctComision + pctOtroCosto + pctAcuerdoFlat;
                const precioNetoGoodies = sumaPctGoodies < 100 ? costoNeto / (1 - sumaPctGoodies / 100) : costoNeto;

                const montoMargenGoodies = precioNetoGoodies * (pctMargenGoodies / 100);
                const montoLogistico = precioNetoGoodies * (pctLogistico / 100);
                const montoIIBB = precioNetoGoodies * (pctIIBB / 100);
                const montoFinanciero = precioNetoGoodies * (pctFinanciero / 100);
                const montoComision = precioNetoGoodies * (pctComision / 100);
                const montoOtroCosto = precioNetoGoodies * (pctOtroCosto / 100);
                const montoAcuerdoFlat = precioNetoGoodies * (pctAcuerdoFlat / 100);

                // === PASO 1b: Gross-up acuerdos en cadena (segunda capa) ===
                let precioBrutoAcordado = precioNetoGoodies;
                let detalleAcuerdosCadena = [];
                if (acuerdosCadena.length > 0) {
                    precioBrutoAcordado = pctAcuerdoCadenaTotal < 100
                        ? precioNetoGoodies / (1 - pctAcuerdoCadenaTotal / 100)
                        : precioNetoGoodies;

                    // Calcular netos intermedios segun base de cada acuerdo
                    const netos = { bruto: precioBrutoAcordado };
                    for (const ac of acuerdosCadena) {
                        if (ac.tipo_acuerdo === 'desc_oc') {
                            // OC con escalones: aplicar en cascada
                            const pcts = [parseFloat(ac.pct_acuerdo) || 0];
                            if (parseFloat(ac.pct_acuerdo_2) > 0) pcts.push(parseFloat(ac.pct_acuerdo_2));
                            if (parseFloat(ac.pct_acuerdo_3) > 0) pcts.push(parseFloat(ac.pct_acuerdo_3));
                            
                            let baseOC = netos[ac.base_calculo] || precioBrutoAcordado;
                            let totalDescOC = 0;
                            const subpasos = [];
                            for (let i = 0; i < pcts.length; i++) {
                                const montoStep = baseOC * (pcts[i] / 100);
                                const netoStep = baseOC - montoStep;
                                subpasos.push({ step: i + 1, pct: pcts[i], base: Math.round(baseOC * 100) / 100, monto: Math.round(montoStep * 100) / 100, neto: Math.round(netoStep * 100) / 100 });
                                totalDescOC += montoStep;
                                baseOC = netoStep;
                            }
                            netos['neto_post_desc_oc'] = baseOC;
                            detalleAcuerdosCadena.push({
                                tipo: 'desc_oc',
                                pct: pcts[0],
                                pct_2: pcts[1] || 0,
                                pct_3: pcts[2] || 0,
                                base_calculo: ac.base_calculo,
                                base_valor: Math.round((netos[ac.base_calculo] || precioBrutoAcordado) * 100) / 100,
                                monto: Math.round(totalDescOC * 100) / 100,
                                neto_post: Math.round(baseOC * 100) / 100,
                                orden: ac.orden || 1,
                                categoria: ac.categoria,
                                subpasos
                            });
                        } else {
                            const pctAc = parseFloat(ac.pct_acuerdo) || 0;
                            const base = netos[ac.base_calculo] || precioBrutoAcordado;
                            const montoDesc = base * (pctAc / 100);
                            const neto = base - montoDesc;
                            netos['neto_post_' + ac.tipo_acuerdo] = neto;
                            detalleAcuerdosCadena.push({
                                tipo: ac.tipo_acuerdo,
                                pct: pctAc,
                                base_calculo: ac.base_calculo,
                                base_valor: Math.round(base * 100) / 100,
                                monto: Math.round(montoDesc * 100) / 100,
                                neto_post: Math.round(neto * 100) / 100,
                                orden: ac.orden || 1,
                                categoria: ac.categoria
                            });
                        }
                    }
                }

                // Precio que Goodies factura = Bruto - desc OC
                const descOC = detalleAcuerdosCadena.filter(d => d.tipo === 'desc_oc').reduce((s, d) => s + d.monto, 0);
                const precioFacturadoGoodies = acuerdosCadena.length > 0 ? precioBrutoAcordado - descOC : precioNetoGoodies;

                // === PASO 2: Factura Goodies ===
                const montoIVA = precioFacturadoGoodies * ivaPct;
                const montoImpInterno = precioFacturadoGoodies * impInternoPct;
                const facturaGoodies = precioFacturadoGoodies + montoIVA + montoImpInterno;

                // === PASO 3: Precio del cliente (super/distribuidor) ===
                let costoCliente, baseClienteLabel;
                if (acuerdosCadena.length > 0) {
                    costoCliente = precioBrutoAcordado + (impInternoPct > 0 ? precioBrutoAcordado * impInternoPct : 0);
                    baseClienteLabel = 'bruto_acordado';
                } else {
                    costoCliente = precioNetoGoodies + (impInternoPct > 0 ? precioNetoGoodies * impInternoPct : 0);
                    baseClienteLabel = 'neto_goodies';
                }
                let precioNetoCliente = null;
                let facturaCliente = null;

                if (pctMargenCliente > 0) {
                    if (pctMargenCliente < 100) {
                        precioNetoCliente = costoCliente / (1 - pctMargenCliente / 100);
                    } else {
                        precioNetoCliente = costoCliente * (1 + pctMargenCliente / 100);
                    }
                    facturaCliente = precioNetoCliente + (precioNetoCliente * ivaPct);
                }

                // === PASO 4: PVP estimado ===
                let pvpEstimado = null;
                let costoTrad = null;
                let precioNetoTrad = null;
                if (pctMarkupTrad > 0) {
                    costoTrad = precioNetoCliente ? precioNetoCliente : costoCliente;
                    precioNetoTrad = costoTrad * (1 + pctMarkupTrad / 100);
                    pvpEstimado = precioNetoTrad + (precioNetoTrad * ivaPct);
                } else if (precioNetoCliente) {
                    pvpEstimado = facturaCliente;
                } else {
                    pvpEstimado = facturaGoodies;
                }

                // Neto real Goodies
                const totalNC = detalleAcuerdosCadena.filter(d => d.tipo === 'nota_credito').reduce((s, d) => s + d.monto, 0);
                const totalFactCli = detalleAcuerdosCadena.filter(d => d.tipo === 'factura_cliente').reduce((s, d) => s + d.monto, 0);
                const netoRealGoodies = precioFacturadoGoodies - totalNC - totalFactCli;

                preciosPorLista.push({
                    lista_id: lista.id,
                    lista_nombre: lista.nombre,
                    suma_pct: Math.round(sumaPctGoodies * 100) / 100,
                    precio_neto_goodies: Math.round(precioNetoGoodies * 100) / 100,
                    margen_goodies_monto: Math.round(montoMargenGoodies * 100) / 100,
                    logistico_monto: Math.round(montoLogistico * 100) / 100,
                    iibb_monto: Math.round(montoIIBB * 100) / 100,
                    financiero_monto: Math.round(montoFinanciero * 100) / 100,
                    comision_monto: Math.round(montoComision * 100) / 100,
                    otro_costo_monto: Math.round(montoOtroCosto * 100) / 100,
                    acuerdo_flat_monto: Math.round(montoAcuerdoFlat * 100) / 100,
                    pct_acuerdo_flat: pctAcuerdoFlat,
                    tiene_acuerdos_cadena: acuerdosCadena.length > 0,
                    precio_bruto_acordado: Math.round(precioBrutoAcordado * 100) / 100,
                    pct_acuerdo_cadena_total: pctAcuerdoCadenaTotal,
                    detalle_acuerdos_cadena: detalleAcuerdosCadena,
                    precio_facturado_goodies: Math.round(precioFacturadoGoodies * 100) / 100,
                    neto_real_goodies: Math.round(netoRealGoodies * 100) / 100,
                    total_nc: Math.round(totalNC * 100) / 100,
                    total_fact_cli: Math.round(totalFactCli * 100) / 100,
                    iva_pct: ivaPct * 100,
                    imp_interno_pct: impInternoPct * 100,
                    factura_goodies: Math.round(facturaGoodies * 100) / 100,
                    costo_cliente: Math.round(costoCliente * 100) / 100,
                    base_cliente_label: baseClienteLabel,
                    pct_margen_cliente: pctMargenCliente,
                    precio_neto_cliente: precioNetoCliente ? Math.round(precioNetoCliente * 100) / 100 : null,
                    factura_cliente: facturaCliente ? Math.round(facturaCliente * 100) / 100 : null,
                    pct_markup_trad: pctMarkupTrad,
                    costo_trad: costoTrad ? Math.round(costoTrad * 100) / 100 : null,
                    precio_neto_trad: precioNetoTrad ? Math.round(precioNetoTrad * 100) / 100 : null,
                    pvp_estimado: pvpEstimado ? Math.round(pvpEstimado * 100) / 100 : null,
                    pcts: { margen_goodies: pctMargenGoodies, logistico: pctLogistico, iibb: pctIIBB, financiero: pctFinanciero, comision: pctComision, otro_costo: pctOtroCosto, acuerdo_flat: pctAcuerdoFlat }
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
        const { articulos_pvp, lista_ids } = req.body;

        let whereListas = {};
        if (lista_ids && lista_ids.length > 0) {
            whereListas = { id: { [Op.in]: lista_ids } };
        }
        const listas = await ListaPrecio.findAll({ where: whereListas, order: [['nombre', 'ASC']] });
        const todosAcuerdos = await AcuerdoComercial.findAll({ order: [['orden', 'ASC']] });

        const resultados = [];

        for (const artPvp of articulos_pvp) {
            const { codigo_goodies, pvp } = artPvp;

            const ultimoArticulo = await ArticuloCosteo.findOne({
                where: { codigo_goodies },
                include: [{ model: Costeo, as: 'costeo', where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } } }],
                order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
            });

            const costoNeto = ultimoArticulo ? parseFloat(ultimoArticulo.costo_unitario_neto_ars) || 0 : 0;

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

                // Buscar acuerdos para esta lista + rubro
                const acuerdosLista = todosAcuerdos.filter(a => {
                    if (a.lista_id !== lista.id) return false;
                    const rubrosAcuerdo = (a.rubros || '').split(',').filter(r => r.trim());
                    if (rubrosAcuerdo.length === 0) return true;
                    return rubrosAcuerdo.includes(rubro);
                });
                const acuerdosFlat = acuerdosLista.filter(a => a.tipo_acuerdo === 'flat');
                const acuerdosCadena = acuerdosLista.filter(a => a.tipo_acuerdo !== 'flat');
                const pctAcuerdoFlat = acuerdosFlat.reduce((sum, a) => sum + (parseFloat(a.pct_acuerdo) || 0), 0);
                // Compound rate for OC escalones
                let pctAcuerdoCadenaTotal = 0;
                for (const ac of acuerdosCadena) {
                    if (ac.tipo_acuerdo === 'desc_oc') {
                        const p1 = (parseFloat(ac.pct_acuerdo) || 0) / 100;
                        const p2 = (parseFloat(ac.pct_acuerdo_2) || 0) / 100;
                        const p3 = (parseFloat(ac.pct_acuerdo_3) || 0) / 100;
                        let factor = (1 - p1);
                        if (p2 > 0) factor *= (1 - p2);
                        if (p3 > 0) factor *= (1 - p3);
                        pctAcuerdoCadenaTotal += (1 - factor) * 100;
                    } else {
                        pctAcuerdoCadenaTotal += parseFloat(ac.pct_acuerdo) || 0;
                    }
                }
                const tieneAcuerdosCadena = acuerdosCadena.length > 0;

                // === DESANDAR LA CADENA DESDE PVP HACIA ATRÁS ===

                // Paso 1: PVP incluye IVA → sacar IVA
                let precioNetoFinal = pvp / (1 + ivaPct);

                // Paso 2: Si hay markup tradicional → desandar
                let precioNetoEslabonAnterior = precioNetoFinal;
                if (pctMarkupTrad > 0) {
                    precioNetoEslabonAnterior = precioNetoFinal / (1 + pctMarkupTrad / 100);
                }

                // Paso 3: Si hay margen cliente (distribuidor/super) → desandar gross-up
                let baseClienteMasInternos = precioNetoEslabonAnterior;
                if (pctMargenCliente > 0) {
                    if (pctMargenCliente < 100) {
                        baseClienteMasInternos = precioNetoEslabonAnterior * (1 - pctMargenCliente / 100);
                    } else {
                        baseClienteMasInternos = precioNetoEslabonAnterior / (1 + pctMargenCliente / 100);
                    }
                }

                // Paso 4: Quitar imp. internos
                let basePreInternos = baseClienteMasInternos;
                if (impInternoPct > 0) {
                    basePreInternos = baseClienteMasInternos / (1 + impInternoPct);
                }

                // Paso 5: Si hay acuerdos cadena, basePreInternos = Bruto Acordado
                //          → aplicar (1 - Σ% cadena) para obtener Neto Goodies
                //         Si NO hay acuerdos cadena, basePreInternos = Neto Goodies directamente
                let precioNetoGoodies;
                let precioBrutoAcordado = null;
                if (tieneAcuerdosCadena) {
                    precioBrutoAcordado = basePreInternos;
                    precioNetoGoodies = precioBrutoAcordado * (1 - pctAcuerdoCadenaTotal / 100);
                } else {
                    precioNetoGoodies = basePreInternos;
                }

                // Paso 6: Deducciones sobre Neto Goodies (gastos + acuerdos flat)
                const totalPctDeducciones = pctLogistico + pctIIBB + pctFinanciero + pctComision + pctOtroCosto + pctAcuerdoFlat;
                const deducciones = precioNetoGoodies * (totalPctDeducciones / 100);

                // Ingreso Neto Goodies
                const ingresoNeto = precioNetoGoodies - deducciones;

                // Margen Goodies real
                const margenPct = costoNeto > 0 ? ((ingresoNeto - costoNeto) / costoNeto) * 100 : 0;
                const margenSobrePrecio = precioNetoGoodies > 0 ? ((ingresoNeto - costoNeto) / precioNetoGoodies) * 100 : 0;

                // Margen punta a punta del super (informativo)
                let margenPuntaPuntaSuper = null;
                if (tieneAcuerdosCadena && pctMargenCliente > 0) {
                    const precioVentaSuper = precioNetoEslabonAnterior; // neto super sin IVA
                    const costoRealSuper = precioNetoGoodies; // lo que realmente paga después de acuerdos
                    margenPuntaPuntaSuper = precioVentaSuper > 0 ? ((precioVentaSuper - costoRealSuper) / precioVentaSuper) * 100 : 0;
                }

                margenesListas.push({
                    lista_id: lista.id,
                    lista_nombre: lista.nombre,
                    pvp,
                    precio_neto_final: Math.round(precioNetoFinal * 100) / 100,
                    precio_neto_trad: pctMarkupTrad > 0 ? Math.round(precioNetoFinal * 100) / 100 : null,
                    costo_trad: pctMarkupTrad > 0 ? Math.round(precioNetoEslabonAnterior * 100) / 100 : null,
                    precio_neto_cliente: pctMargenCliente > 0 ? Math.round(precioNetoEslabonAnterior * 100) / 100 : null,
                    tiene_acuerdos_cadena: tieneAcuerdosCadena,
                    precio_bruto_acordado: precioBrutoAcordado ? Math.round(precioBrutoAcordado * 100) / 100 : null,
                    pct_acuerdo_cadena_total: pctAcuerdoCadenaTotal,
                    precio_neto_goodies: Math.round(precioNetoGoodies * 100) / 100,
                    total_deducciones: Math.round(deducciones * 100) / 100,
                    ingreso_neto: Math.round(ingresoNeto * 100) / 100,
                    costo_neto: Math.round(costoNeto * 100) / 100,
                    margen_pct: Math.round(margenPct * 100) / 100,
                    margen_sobre_precio: Math.round(margenSobrePrecio * 100) / 100,
                    margen_punta_punta_super: margenPuntaPuntaSuper ? Math.round(margenPuntaPuntaSuper * 100) / 100 : null,
                    pcts_usados: {
                        logistico: pctLogistico, iibb: pctIIBB, financiero: pctFinanciero,
                        comision: pctComision, otro_costo: pctOtroCosto,
                        acuerdo_flat: pctAcuerdoFlat, acuerdo_cadena: pctAcuerdoCadenaTotal,
                        margen_cliente: pctMargenCliente, markup_trad: pctMarkupTrad
                    }
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

// =============================================
// MERCADO LIBRE - Calculadora de costos
// =============================================

const mlService = require('../services/mlCostos');

// Calcular costos ML para múltiples artículos
router.post('/ml/calcular', auth, async (req, res) => {
    try {
        const { articulos, canal, comision_pct, otros_costos } = req.body;
        // articulos = [{ codigo_goodies, precio_venta, peso_kg, largo_cm, ancho_cm, alto_cm, es_esencial }]
        
        const resultados = [];
        
        for (const art of articulos) {
            // Buscar costo neto del artículo
            let costoNeto = art.costo_producto || 0;
            if (!costoNeto && art.codigo_goodies) {
                const ultimo = await ArticuloCosteo.findOne({
                    where: { codigo_goodies: art.codigo_goodies },
                    include: [{ model: Costeo, as: 'costeo', where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } } }],
                    order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
                });
                costoNeto = ultimo ? parseFloat(ultimo.costo_unitario_neto_ars) || 0 : 0;
            }

            // Buscar datos del catálogo (incluye físicos y ML)
            let nombre = art.nombre || '';
            let pesoKg = parseFloat(art.peso_kg) || 0;
            let largoCm = parseFloat(art.largo_cm) || 0;
            let anchoCm = parseFloat(art.ancho_cm) || 0;
            let altoCm = parseFloat(art.alto_cm) || 0;
            let esEsencial = art.es_esencial || false;
            let unidadesPorCaja = parseInt(art.unidades_por_caja) || 1;
            let tipoCaja = art.tipo_caja || '';
            
            if (art.codigo_goodies) {
                const catalogo = await CatalogoArticulo.findOne({ where: { codigo_goodies: art.codigo_goodies } });
                if (catalogo) {
                    if (!nombre) nombre = catalogo.nombre || '';
                    if (!pesoKg) pesoKg = parseFloat(catalogo.peso_unitario_kg) || 0;
                    if (!largoCm) largoCm = parseFloat(catalogo.largo_cm) || 0;
                    if (!anchoCm) anchoCm = parseFloat(catalogo.ancho_cm) || 0;
                    if (!altoCm) altoCm = parseFloat(catalogo.alto_cm) || 0;
                    if (!art.es_esencial && catalogo.es_esencial_ml) esEsencial = catalogo.es_esencial_ml;
                    if (!art.unidades_por_caja && catalogo.unidades_por_caja_ml) unidadesPorCaja = catalogo.unidades_por_caja_ml;
                    if (!art.tipo_caja && catalogo.tipo_caja_ml) tipoCaja = catalogo.tipo_caja_ml;
                }
            }

            const resultado = mlService.calcularMLConCaja(
                parseFloat(art.precio_venta) || 0,
                costoNeto,
                pesoKg,
                unidadesPorCaja,
                tipoCaja,
                largoCm, anchoCm, altoCm,
                canal || 'flex',
                esEsencial,
                parseFloat(comision_pct) || 14,
                otros_costos || {}
            );

            resultados.push({
                codigo_goodies: art.codigo_goodies || '',
                nombre,
                ...resultado
            });
        }

        res.json(resultados);
    } catch (error) {
        console.error('Error calculando ML:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtener tablas de costos ML (para mostrar en frontend)
router.get('/ml/tablas', auth, (req, res) => {
    res.json({
        flex: mlService.FLEX_COSTOS,
        full_super_esenciales: mlService.FULL_SUPER_ESENCIALES,
        full_super_resto: mlService.FULL_SUPER_RESTO,
        cajas: mlService.CAJAS_ML,
        comision_default: mlService.COMISION_ML_DEFAULT,
        vigencia: '12/03/2026',
        nota: 'Costo fijo nunca supera 25% del precio. Peso = max(físico, volumétrico). >= $33.000 sin costo fijo pero envío gratis obligatorio.'
    });
});

// Precio sugerido para margen objetivo
router.post('/ml/precio-sugerido', auth, (req, res) => {
    try {
        const { costo_producto, peso_kg, canal, es_esencial, comision_pct, margen_objetivo, otros_costos } = req.body;
        const precio = mlService.precioSugeridoML(
            parseFloat(costo_producto) || 0,
            parseFloat(peso_kg) || 0,
            canal || 'flex',
            es_esencial || false,
            parseFloat(comision_pct) || 14,
            parseFloat(margen_objetivo) || 30,
            otros_costos || {}
        );
        res.json({ precio_sugerido: precio });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
