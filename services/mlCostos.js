/**
 * Mercado Libre - Tablas de costos desde 12/03/2026
 * Canales: Flex, Full Súper (Esenciales / Resto)
 * Solo aplica a productos < $33.000
 */

// === FLEX (solo por precio) ===
const FLEX_COSTOS = [
    { min: 0, max: 15999, costo: 1255 },
    { min: 16000, max: 23999, costo: 2500 },
    { min: 24000, max: 32999, costo: 3030 },
];

// === FULL SÚPER - ESENCIALES (precio × peso) ===
const FULL_SUPER_ESENCIALES = {
    precios: [
        { min: 0, max: 3499 },
        { min: 3500, max: 4999 },
        { min: 5000, max: 7999 },
        { min: 8000, max: 15999 },
        { min: 16000, max: 32999 },
    ],
    pesos: [
        { min: 0, max: 1, label: 'Hasta 1 kg' },
        { min: 1, max: 2, label: '1 a 2 kg' },
        { min: 2, max: 5, label: '2 a 5 kg' },
        { min: 5, max: 8, label: '5 a 8 kg' },
        { min: 8, max: 9999, label: 'Más de 8 kg' },
    ],
    // costos[peso_idx][precio_idx]
    costos: [
        [100, 200, 300, 500, 800],
        [125, 225, 350, 550, 1000],
        [175, 275, 400, 600, 1100],
        [250, 325, 450, 700, 1250],
        [300, 375, 500, 800, 1400],
    ]
};

// === FULL SÚPER - RESTO (precio × peso) ===
const FULL_SUPER_RESTO = {
    precios: [
        { min: 0, max: 3499 },
        { min: 3500, max: 4999 },
        { min: 5000, max: 7999 },
        { min: 8000, max: 15999 },
        { min: 16000, max: 32999 },
    ],
    pesos: [
        { min: 0, max: 1, label: 'Hasta 1 kg' },
        { min: 1, max: 2, label: '1 a 2 kg' },
        { min: 2, max: 5, label: '2 a 5 kg' },
        { min: 5, max: 8, label: '5 a 8 kg' },
        { min: 8, max: 9999, label: 'Más de 8 kg' },
    ],
    costos: [
        [175, 350, 500, 850, 1300],
        [225, 400, 600, 900, 1500],
        [290, 550, 750, 1000, 1750],
        [350, 650, 850, 1250, 2000],
        [550, 750, 950, 1500, 2250],
    ]
};

// Comisión ML por categoría (Argentina, referencia)
const COMISION_ML_DEFAULT = 14; // % - ajustable

// Cajas estándar de embalaje ML (configurables)
const CAJAS_ML = {
    chica:   { largo: 25, ancho: 20, alto: 15, label: 'Chica (25×20×15)' },
    mediana: { largo: 35, ancho: 25, alto: 20, label: 'Mediana (35×25×20)' },
    grande:  { largo: 45, ancho: 35, alto: 25, label: 'Grande (45×35×25)' }
};

/**
 * Calcular peso volumétrico
 * Fórmula ML: (largo_cm × ancho_cm × alto_cm) / 4000
 */
function pesoVolumetrico(largoCm, anchoCm, altoCm) {
    return (largoCm * anchoCm * altoCm) / 4000;
}

/**
 * Peso efectivo = max(peso físico, peso volumétrico)
 */
function pesoEfectivo(pesoFisicoKg, largoCm, anchoCm, altoCm) {
    const volum = pesoVolumetrico(largoCm, anchoCm, altoCm);
    return Math.max(pesoFisicoKg, volum);
}

/**
 * Buscar costo fijo por unidad vendida
 */
function costoFijoML(precio, pesoKg, canal, esEsencial) {
    // Productos >= $33.000 no pagan costo fijo
    if (precio >= 33000) return { costo: 0, detalle: 'Sin costo fijo (>= $33.000)' };

    if (canal === 'flex') {
        const rango = FLEX_COSTOS.find(r => precio >= r.min && precio <= r.max);
        const costo = rango ? rango.costo : 0;
        // Tope 25% del precio
        const tope = precio * 0.25;
        const costoFinal = Math.min(costo, tope);
        return {
            costo: costoFinal,
            costo_tabla: costo,
            tope_aplicado: costoFinal < costo,
            detalle: `Flex: $${costo} (rango $${rango ? rango.min : 0}-$${rango ? rango.max : 0})`
        };
    }

    if (canal === 'full_super') {
        const tabla = esEsencial ? FULL_SUPER_ESENCIALES : FULL_SUPER_RESTO;
        const precioIdx = tabla.precios.findIndex(r => precio >= r.min && precio <= r.max);
        const pesoIdx = tabla.pesos.findIndex(r => pesoKg >= r.min && pesoKg < r.max);

        if (precioIdx === -1 || pesoIdx === -1) {
            return { costo: 0, detalle: 'Fuera de rango' };
        }

        const costo = tabla.costos[pesoIdx][precioIdx];
        const tope = precio * 0.25;
        const costoFinal = Math.min(costo, tope);
        const tipoLabel = esEsencial ? 'Esencial' : 'Resto';

        return {
            costo: costoFinal,
            costo_tabla: costo,
            tope_aplicado: costoFinal < costo,
            peso_rango: tabla.pesos[pesoIdx].label,
            precio_rango: `$${tabla.precios[precioIdx].min}-$${tabla.precios[precioIdx].max}`,
            tipo: tipoLabel,
            detalle: `Full Súper (${tipoLabel}): $${costo} [${tabla.pesos[pesoIdx].label}, ${tabla.precios[precioIdx].min}-${tabla.precios[precioIdx].max}]`
        };
    }

    return { costo: 0, detalle: 'Canal no reconocido' };
}

/**
 * Cálculo completo ML para un artículo
 * @param {number} precioVenta - Precio de venta en ML
 * @param {number} costoProducto - Costo neto del artículo (de nuestro costeo)
 * @param {number} pesoFisicoKg - Peso físico en kg
 * @param {number} largoCm - Largo embalaje cm
 * @param {number} anchoCm - Ancho embalaje cm
 * @param {number} altoCm - Alto embalaje cm
 * @param {string} canal - 'flex' | 'full_super'
 * @param {boolean} esEsencial - true si es producto esencial en Full Súper
 * @param {number} comisionPct - % comisión ML (default 14%)
 * @param {Object} otrosCostos - { pctIIBB, pctFinanciero, pctLogisticoInterno }
 */
function calcularML(precioVenta, costoProducto, pesoFisicoKg, largoCm, anchoCm, altoCm, canal, esEsencial, comisionPct, otrosCostos = {}) {
    const pesoVol = pesoVolumetrico(largoCm || 0, anchoCm || 0, altoCm || 0);
    const pesoEfec = Math.max(pesoFisicoKg || 0, pesoVol);

    // Comisión ML (% sobre precio)
    const comision = comisionPct || COMISION_ML_DEFAULT;
    const montoComision = precioVenta * (comision / 100);

    // Costo fijo por unidad
    const costoFijo = costoFijoML(precioVenta, pesoEfec, canal, esEsencial);

    // Otros costos Goodies
    const pctIIBB = otrosCostos.pctIIBB || 0;
    const pctFinanciero = otrosCostos.pctFinanciero || 0;
    const pctLogisticoInterno = otrosCostos.pctLogisticoInterno || 0;
    const montoIIBB = precioVenta * (pctIIBB / 100);
    const montoFinanciero = precioVenta * (pctFinanciero / 100);
    const montoLogisticoInterno = precioVenta * (pctLogisticoInterno / 100);

    // Total costos ML + Goodies
    const totalCostosML = montoComision + costoFijo.costo;
    const totalCostosGoodies = montoIIBB + montoFinanciero + montoLogisticoInterno;
    const totalCostos = totalCostosML + totalCostosGoodies;

    // Ingreso neto
    const ingresoNeto = precioVenta - totalCostos;

    // Margen
    const margenPesos = ingresoNeto - costoProducto;
    const margenPct = costoProducto > 0 ? (margenPesos / costoProducto) * 100 : 0;
    const margenSobreVenta = precioVenta > 0 ? (margenPesos / precioVenta) * 100 : 0;

    // Precio sugerido para margen objetivo
    // precioSugerido = (costoProducto + costoFijo) / (1 - comision/100 - otrosPct/100) * (1 + margenObjetivo/100)

    return {
        precio_venta: round(precioVenta),
        costo_producto: round(costoProducto),
        peso_fisico: pesoFisicoKg,
        peso_volumetrico: round(pesoVol),
        peso_efectivo: round(pesoEfec),
        canal,
        es_esencial: esEsencial,
        comision_pct: comision,
        comision_monto: round(montoComision),
        costo_fijo: costoFijo,
        iibb_monto: round(montoIIBB),
        financiero_monto: round(montoFinanciero),
        logistico_interno_monto: round(montoLogisticoInterno),
        total_costos_ml: round(totalCostosML),
        total_costos_goodies: round(totalCostosGoodies),
        total_costos: round(totalCostos),
        ingreso_neto: round(ingresoNeto),
        margen_pesos: round(margenPesos),
        margen_pct: round(margenPct),
        margen_sobre_venta: round(margenSobreVenta),
        envio_gratis_obligatorio: precioVenta >= 33000,
        alerta: margenPct < 10 ? '⚠️ Margen menor al 10%' : (margenPct < 0 ? '🔴 PÉRDIDA' : null)
    };
}

/**
 * Calcular costo ML por unidad usando datos del catálogo (caja + unidades)
 * @param {number} precioVentaUnitario - Precio de venta por unidad en ML
 * @param {number} costoProducto - Costo neto unitario
 * @param {number} pesoUnitarioKg - Peso de 1 unidad
 * @param {number} unidadesPorCaja - Cuántas unidades van en la caja
 * @param {string} tipoCaja - 'chica' | 'mediana' | 'grande' | 'custom'
 * @param {number} largoCm - Si custom, largo de la caja
 * @param {number} anchoCm - Si custom
 * @param {number} altoCm - Si custom
 * @param {string} canal - 'flex' | 'full_super'
 * @param {boolean} esEsencial
 * @param {number} comisionPct
 * @param {Object} otrosCostos
 */
function calcularMLConCaja(precioVentaUnitario, costoProducto, pesoUnitarioKg, unidadesPorCaja, tipoCaja, largoCm, anchoCm, altoCm, canal, esEsencial, comisionPct, otrosCostos) {
    const unidades = unidadesPorCaja || 1;
    
    // Determinar dimensiones de la caja
    let cajaL, cajaA, cajaH;
    if (tipoCaja && CAJAS_ML[tipoCaja]) {
        cajaL = CAJAS_ML[tipoCaja].largo;
        cajaA = CAJAS_ML[tipoCaja].ancho;
        cajaH = CAJAS_ML[tipoCaja].alto;
    } else {
        cajaL = largoCm || 0;
        cajaA = anchoCm || 0;
        cajaH = altoCm || 0;
    }
    
    // Peso total del envío
    const pesoTotalEnvio = (pesoUnitarioKg || 0) * unidades;
    
    // Peso volumétrico de la caja
    const pesoVol = pesoVolumetrico(cajaL, cajaA, cajaH);
    
    // Peso efectivo
    const pesoEfec = Math.max(pesoTotalEnvio, pesoVol);
    
    // El costo fijo ML se calcula sobre el PRECIO DEL PRODUCTO (no del envío)
    // y se cobra por cada unidad vendida
    const resultadoUnitario = calcularML(
        precioVentaUnitario, costoProducto,
        pesoEfec, // peso efectivo del envío completo
        cajaL, cajaA, cajaH,
        canal, esEsencial, comisionPct, otrosCostos
    );
    
    return {
        ...resultadoUnitario,
        unidades_por_caja: unidades,
        tipo_caja: tipoCaja,
        caja_dimensiones: cajaL + '×' + cajaA + '×' + cajaH + ' cm',
        peso_total_envio: round(pesoTotalEnvio),
        caja_label: CAJAS_ML[tipoCaja] ? CAJAS_ML[tipoCaja].label : 'Custom (' + cajaL + '×' + cajaA + '×' + cajaH + ')'
    };
}

/**
 * Calcular precio sugerido para un margen objetivo
 */
function precioSugeridoML(costoProducto, pesoKg, canal, esEsencial, comisionPct, margenObjetivoPct, otrosCostos = {}) {
    const comision = comisionPct || COMISION_ML_DEFAULT;
    const totalOtrosPct = (otrosCostos.pctIIBB || 0) + (otrosCostos.pctFinanciero || 0) + (otrosCostos.pctLogisticoInterno || 0);

    // Iterativo: probar precios hasta encontrar el que da el margen objetivo
    // Empezar con una estimación
    let precio = costoProducto * (1 + margenObjetivoPct / 100) / (1 - comision / 100 - totalOtrosPct / 100);

    for (let i = 0; i < 20; i++) {
        const resultado = calcularML(precio, costoProducto, pesoKg, 0, 0, 0, canal, esEsencial, comisionPct, otrosCostos);
        const diff = resultado.margen_pct - margenObjetivoPct;
        if (Math.abs(diff) < 0.5) break;
        // Ajustar precio proporcionalmente
        precio = precio * (1 + (margenObjetivoPct - resultado.margen_pct) / 200);
    }

    return round(precio);
}

function round(v) {
    return Math.round(v * 100) / 100;
}

module.exports = {
    costoFijoML, calcularML, calcularMLConCaja, precioSugeridoML, pesoVolumetrico, pesoEfectivo,
    FLEX_COSTOS, FULL_SUPER_ESENCIALES, FULL_SUPER_RESTO, COMISION_ML_DEFAULT, CAJAS_ML
};
