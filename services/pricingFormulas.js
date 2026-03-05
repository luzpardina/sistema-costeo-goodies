/**
 * Fórmulas de cálculo de precios y márgenes
 * Extraídas de comercialRoutes.js para poder testearlas unitariamente
 */

/**
 * Gross-up: Dado un costo y un % total, calcular el precio que contiene ese %
 * Fórmula: precio = costo / (1 - pct/100)
 */
function grossUp(costo, pctTotal) {
    if (pctTotal >= 100) return costo; // Protección overflow
    return costo / (1 - pctTotal / 100);
}

/**
 * Markup: Dado un costo y un %, calcular precio con markup
 * Fórmula: precio = costo * (1 + pct/100)
 */
function markup(costo, pctMarkup) {
    return costo * (1 + pctMarkup / 100);
}

/**
 * Tasa efectiva compuesta para OC escalonado
 * effective = 1 - (1-p1)(1-p2)(1-p3)
 * @param {number[]} pcts - Array de porcentajes [10, 5, 3]
 * @returns {number} Porcentaje efectivo compuesto
 */
function tasaCompuestaOC(pcts) {
    let factor = 1;
    for (const p of pcts) {
        if (p > 0) factor *= (1 - p / 100);
    }
    return (1 - factor) * 100;
}

/**
 * Calcular Precio Neto Goodies (Paso 1: gross-up de costos)
 * @param {number} costoNeto - Costo neto del artículo en ARS
 * @param {Object} pcts - { margen, logistico, iibb, financiero, comision, otro, acuerdoFlat }
 * @returns {number} Precio Neto Goodies
 */
function calcularPrecioNetoGoodies(costoNeto, pcts) {
    const sumaPct = (pcts.margen || 0) + (pcts.logistico || 0) + (pcts.iibb || 0) +
                    (pcts.financiero || 0) + (pcts.comision || 0) + (pcts.otro || 0) +
                    (pcts.acuerdoFlat || 0);
    return grossUp(costoNeto, sumaPct);
}

/**
 * Calcular Precio Bruto Acordado (Paso 1b: segunda capa gross-up para super)
 * @param {number} netoGoodies - Precio Neto Goodies
 * @param {number} pctCadenaTotal - % total de acuerdos en cadena
 * @returns {number} Precio Bruto Acordado
 */
function calcularBrutoAcordado(netoGoodies, pctCadenaTotal) {
    return grossUp(netoGoodies, pctCadenaTotal);
}

/**
 * Aplicar descuentos OC en cascada
 * @param {number} bruto - Precio bruto acordado
 * @param {number[]} pcts - Array de porcentajes OC [14.8, 5, 3]
 * @returns {Object} { netoFinal, pasos: [{base, pct, descuento, neto}], totalDescuento }
 */
function aplicarDescuentosOCCascada(bruto, pcts) {
    let base = bruto;
    let totalDescuento = 0;
    const pasos = [];
    
    for (const pct of pcts) {
        if (pct <= 0) continue;
        const descuento = base * (pct / 100);
        const neto = base - descuento;
        pasos.push({ base: round(base), pct, descuento: round(descuento), neto: round(neto) });
        totalDescuento += descuento;
        base = neto;
    }
    
    return { netoFinal: round(base), pasos, totalDescuento: round(totalDescuento) };
}

/**
 * Margen inverso: dado un PVP, desandar la cadena hasta obtener el margen de Goodies
 * @param {number} pvp - Precio de venta al público
 * @param {number} costoNeto - Costo neto del artículo
 * @param {Object} params - { ivaPct, impInternoPct, pctMargenCliente, pctMarkupTrad, pctAcuerdoCadena, pctGastosTotal }
 * @returns {Object} { precioNetoGoodies, ingresoNeto, margenPct }
 */
function calcularMargenInverso(pvp, costoNeto, params) {
    const { ivaPct, impInternoPct, pctMargenCliente, pctMarkupTrad, pctAcuerdoCadena, pctGastosTotal } = params;
    
    // Quitar IVA
    let precio = pvp / (1 + ivaPct);
    
    // Desandar markup trad
    if (pctMarkupTrad > 0) {
        precio = precio / (1 + pctMarkupTrad / 100);
    }
    
    // Desandar margen cliente (super/distribuidor)
    if (pctMargenCliente > 0) {
        if (pctMargenCliente < 100) {
            precio = precio * (1 - pctMargenCliente / 100);
        } else {
            precio = precio / (1 + pctMargenCliente / 100);
        }
    }
    
    // Quitar imp. internos
    if (impInternoPct > 0) {
        precio = precio / (1 + impInternoPct);
    }
    
    // Si hay acuerdos cadena → desandar
    let precioNetoGoodies = precio;
    if (pctAcuerdoCadena > 0) {
        precioNetoGoodies = precio * (1 - pctAcuerdoCadena / 100);
    }
    
    // Deducciones
    const deducciones = precioNetoGoodies * (pctGastosTotal / 100);
    const ingresoNeto = precioNetoGoodies - deducciones;
    
    // Margen
    const margenPct = costoNeto > 0 ? ((ingresoNeto - costoNeto) / costoNeto) * 100 : 0;
    
    return {
        precioNetoGoodies: round(precioNetoGoodies),
        ingresoNeto: round(ingresoNeto),
        margenPct: round(margenPct)
    };
}

function round(v) {
    return Math.round(v * 100) / 100;
}

module.exports = {
    grossUp, markup, tasaCompuestaOC,
    calcularPrecioNetoGoodies, calcularBrutoAcordado,
    aplicarDescuentosOCCascada, calcularMargenInverso, round
};
