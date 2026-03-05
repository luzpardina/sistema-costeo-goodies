/**
 * Mercado Libre - Tablas de costos desde 12/03/2026
 * 
 * Para productos < $33.000:
 *   - Comisión ML (%) + Costo fijo por unidad (flat fee según precio/peso/canal)
 * 
 * Para productos >= $33.000:
 *   - Comisión ML (%) + Costo de envío gratis obligatorio (según peso y rango de precio)
 */

// === FLEX (solo por precio, productos < $33K) ===
const FLEX_COSTOS = [
    { min: 0, max: 15999, costo: 1255 },
    { min: 16000, max: 23999, costo: 2500 },
    { min: 24000, max: 32999, costo: 3030 },
];

// === COSTO ENVÍO GRATIS OBLIGATORIO (productos >= $33K) ===
// Peso × rango de precio. El seller absorbe este costo.
const ENVIO_GRATIS_COSTOS = {
    precios: [
        { min: 0, max: 32999, label: '<$33K' },
        { min: 33000, max: 49999, label: '$33-50K' },
        { min: 50000, max: 999999999, label: '>$50K' },
    ],
    pesos: [
        { min: 0, max: 0.3 }, { min: 0.3, max: 0.5 }, { min: 0.5, max: 1 },
        { min: 1, max: 1.5 }, { min: 1.5, max: 2 }, { min: 2, max: 3 },
        { min: 3, max: 4 }, { min: 4, max: 5 }, { min: 5, max: 8 },
        { min: 8, max: 10 }, { min: 10, max: 13 }, { min: 13, max: 15 },
        { min: 15, max: 20 }, { min: 20, max: 25 }, { min: 25, max: 30 },
        { min: 30, max: 40 }, { min: 40, max: 50 }, { min: 50, max: 60 },
        { min: 60, max: 70 }, { min: 70, max: 80 }, { min: 80, max: 90 },
        { min: 90, max: 100 }, { min: 100, max: 120 }, { min: 120, max: 140 },
        { min: 140, max: 160 }, { min: 160, max: 180 }, { min: 180, max: 9999999 },
    ],
    // costos[peso_idx][precio_idx] — <$33K, $33-50K, >$50K
    costos: [
        [7868, 5620, 6080],
        [8596, 6140, 6600],
        [9800, 7000, 7470],
        [10122, 7230, 7720],
        [10458, 7470, 7970],
        [11550, 8250, 8710],
        [12866, 9190, 9860],
        [14070, 10050, 10760],
        [15512, 11080, 11830],
        [16926, 12090, 12840],
        [18270, 13050, 13920],
        [19684, 14060, 14930],
        [23506, 16790, 17830],
        [28182, 20130, 21420],
        [38780, 27700, 29410],
        [44268, 31620, 33570],
        [46802, 33430, 35490],
        [51996, 37140, 39610],
        [54068, 38620, 41290],
        [62524, 44660, 47850],
        [77308, 55220, 59180],
        [89152, 63680, 68230],
        [97328, 69520, 74490],
        [109592, 78280, 83890],
        [121870, 87050, 93280],
        [134120, 95800, 102660],
        [146398, 104570, 112060],
    ]
};

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

// === COLECTA / ENVÍOS FULL / CORREO / DESPACHO (precio × peso detallado) ===
const COLECTA_COSTOS = {
    precios: [
        { min: 0, max: 15999 },
        { min: 16000, max: 23999 },
        { min: 24000, max: 32999 },
    ],
    pesos: [
        { min: 0, max: 0.3, label: 'Hasta 0,3 kg' },
        { min: 0.3, max: 0.5, label: '0,3 a 0,5 kg' },
        { min: 0.5, max: 1, label: '0,5 a 1 kg' },
        { min: 1, max: 1.5, label: '1 a 1,5 kg' },
        { min: 1.5, max: 2, label: '1,5 a 2 kg' },
        { min: 2, max: 3, label: '2 a 3 kg' },
        { min: 3, max: 4, label: '3 a 4 kg' },
        { min: 4, max: 5, label: '4 a 5 kg' },
        { min: 5, max: 8, label: '5 a 8 kg' },
        { min: 8, max: 10, label: '8 a 10 kg' },
        { min: 10, max: 13, label: '10 a 13 kg' },
        { min: 13, max: 15, label: '13 a 15 kg' },
        { min: 15, max: 20, label: '15 a 20 kg' },
        { min: 20, max: 25, label: '20 a 25 kg' },
        { min: 25, max: 30, label: '25 a 30 kg' },
        { min: 30, max: 40, label: '30 a 40 kg' },
        { min: 40, max: 50, label: '40 a 50 kg' },
        { min: 50, max: 60, label: '50 a 60 kg' },
        { min: 60, max: 70, label: '60 a 70 kg' },
        { min: 70, max: 80, label: '70 a 80 kg' },
        { min: 80, max: 90, label: '80 a 90 kg' },
        { min: 90, max: 100, label: '90 a 100 kg' },
        { min: 100, max: 120, label: '100 a 120 kg' },
        { min: 120, max: 140, label: '120 a 140 kg' },
        { min: 140, max: 160, label: '140 a 160 kg' },
        { min: 160, max: 180, label: '160 a 180 kg' },
        { min: 180, max: 9999, label: 'Más de 180 kg' },
    ],
    // costos[peso_idx][precio_idx]
    costos: [
        [1230, 2455, 2925],
        [1240, 2465, 2925],
        [1255, 2465, 2940],
        [1265, 2490, 2950],
        [1275, 2500, 2965],
        [1290, 2575, 3050],
        [1310, 2620, 3100],
        [1365, 2735, 3240],
        [1395, 2790, 3305],
        [1420, 2850, 3445],
        [1450, 2850, 3510],
        [1470, 2920, 3510],
        [1470, 2965, 3570],
        [1475, 2990, 3600],
        [1490, 3010, 3625],
        [1515, 3035, 3650],
        [1525, 3055, 3680],
        [1535, 3080, 3705],
        [1545, 3105, 3735],
        [1580, 3125, 3760],
        [1630, 3150, 3790],
        [1640, 3170, 3815],
        [1655, 3195, 3845],
        [1665, 3220, 3870],
        [1675, 3240, 3900],
        [1685, 3265, 3925],
        [1705, 3285, 3950],
    ]
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

    if (canal === 'full_colecta') {
        const tabla = COLECTA_COSTOS;
        const precioIdx = tabla.precios.findIndex(r => precio >= r.min && precio <= r.max);
        const pesoIdx = tabla.pesos.findIndex(r => pesoKg >= r.min && pesoKg < r.max);

        if (precioIdx === -1 || pesoIdx === -1) {
            return { costo: 0, detalle: 'Fuera de rango' };
        }

        const costo = tabla.costos[pesoIdx][precioIdx];
        const tope = precio * 0.25;
        const costoFinal = Math.min(costo, tope);

        return {
            costo: costoFinal,
            costo_tabla: costo,
            tope_aplicado: costoFinal < costo,
            peso_rango: tabla.pesos[pesoIdx].label,
            precio_rango: `$${tabla.precios[precioIdx].min}-$${tabla.precios[precioIdx].max}`,
            detalle: `Full/Colecta: $${costo} [${tabla.pesos[pesoIdx].label}, ${tabla.precios[precioIdx].min}-${tabla.precios[precioIdx].max}]`
        };
    }

    if (canal === 'colecta') {
        const precioIdx = COLECTA_COSTOS.precios.findIndex(r => precio >= r.min && precio <= r.max);
        const pesoIdx = COLECTA_COSTOS.pesos.findIndex(r => pesoKg >= r.min && pesoKg < r.max);

        if (precioIdx === -1 || pesoIdx === -1) {
            return { costo: 0, detalle: 'Fuera de rango' };
        }

        const costo = COLECTA_COSTOS.costos[pesoIdx][precioIdx];
        const tope = precio * 0.25;
        const costoFinal = Math.min(costo, tope);

        return {
            costo: costoFinal,
            costo_tabla: costo,
            tope_aplicado: costoFinal < costo,
            peso_rango: COLECTA_COSTOS.pesos[pesoIdx].label,
            precio_rango: `$${COLECTA_COSTOS.precios[precioIdx].min}-$${COLECTA_COSTOS.precios[precioIdx].max}`,
            detalle: `Colecta: $${costo} [${COLECTA_COSTOS.pesos[pesoIdx].label}, ${COLECTA_COSTOS.precios[precioIdx].min}-${COLECTA_COSTOS.precios[precioIdx].max}]`
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
/**
 * Obtener costo de envío gratis obligatorio (>= $33K)
 */
function costoEnvioGratis(precio, pesoKg) {
    if (precio < 33000) return { costo: 0, detalle: 'No aplica (<$33K)' };
    
    const tabla = ENVIO_GRATIS_COSTOS;
    const precioIdx = tabla.precios.findIndex(r => precio >= r.min && precio <= r.max);
    const pesoIdx = tabla.pesos.findIndex(r => pesoKg >= r.min && pesoKg < r.max);
    
    if (precioIdx === -1 || pesoIdx === -1) return { costo: 0, detalle: 'Fuera de rango' };
    
    const costo = tabla.costos[pesoIdx][precioIdx];
    return {
        costo,
        peso_rango: `${tabla.pesos[pesoIdx].min}-${tabla.pesos[pesoIdx].max} kg`,
        precio_rango: tabla.precios[precioIdx].label,
        detalle: `Envío gratis: $${costo} [${tabla.pesos[pesoIdx].min}-${tabla.pesos[pesoIdx].max}kg, ${tabla.precios[precioIdx].label}]`
    };
}

/**
 * Cálculo completo ML para un artículo
 * 
 * < $33.000: Comisión + Flat fee (costo fijo por unidad)
 * >= $33.000: Comisión + Costo envío gratis obligatorio
 * 
 * Además: IIBB, IVA (si corresponde), Imp. Internos (si corresponde)
 */
function calcularML(precioVenta, costoProducto, pesoFisicoKg, largoCm, anchoCm, altoCm, canal, esEsencial, comisionPct, otrosCostos = {}) {
    const pesoVol = pesoVolumetrico(largoCm || 0, anchoCm || 0, altoCm || 0);
    const pesoEfec = Math.max(pesoFisicoKg || 0, pesoVol);

    // 1. Comisión ML (% sobre precio) — siempre
    const comision = comisionPct || COMISION_ML_DEFAULT;
    const montoComision = precioVenta * (comision / 100);

    // 2. Costo ML por unidad: flat fee O envío gratis según rango
    let costoFijo = { costo: 0, detalle: '' };
    let costoEnvio = { costo: 0, detalle: '' };
    
    if (precioVenta < 33000) {
        // Flat fee según canal/precio/peso
        costoFijo = costoFijoML(precioVenta, pesoEfec, canal, esEsencial);
    } else {
        // Envío gratis obligatorio (el seller lo absorbe)
        costoEnvio = costoEnvioGratis(precioVenta, pesoEfec);
    }

    // 3. Costos Goodies sobre la venta
    const pctIIBB = otrosCostos.pctIIBB || 0;
    const pctIVA = otrosCostos.pctIVA || 0;       // IVA débito fiscal si corresponde
    const pctImpInterno = otrosCostos.pctImpInterno || 0;
    const pctFinanciero = otrosCostos.pctFinanciero || 0;
    
    const montoIIBB = precioVenta * (pctIIBB / 100);
    const montoImpInterno = precioVenta * (pctImpInterno / 100);
    const montoFinanciero = precioVenta * (pctFinanciero / 100);

    // Total costos
    const totalCostosML = montoComision + costoFijo.costo + costoEnvio.costo;
    const totalCostosGoodies = montoIIBB + montoImpInterno + montoFinanciero;
    const totalCostos = totalCostosML + totalCostosGoodies;

    // Ingreso neto
    const ingresoNeto = precioVenta - totalCostos;

    // Margen sobre costo
    const margenPesos = ingresoNeto - costoProducto;
    const margenPct = costoProducto > 0 ? (margenPesos / costoProducto) * 100 : 0;
    const margenSobreVenta = precioVenta > 0 ? (margenPesos / precioVenta) * 100 : 0;

    return {
        precio_venta: round(precioVenta),
        costo_producto: round(costoProducto),
        peso_fisico: pesoFisicoKg,
        peso_volumetrico: round(pesoVol),
        peso_efectivo: round(pesoEfec),
        canal,
        es_esencial: esEsencial,
        // Desglose
        comision_pct: comision,
        comision_monto: round(montoComision),
        costo_fijo: costoFijo,          // Solo < $33K
        costo_envio: costoEnvio,        // Solo >= $33K
        iibb_monto: round(montoIIBB),
        imp_interno_monto: round(montoImpInterno),
        financiero_monto: round(montoFinanciero),
        // Totales
        total_costos_ml: round(totalCostosML),
        total_costos_goodies: round(totalCostosGoodies),
        total_costos: round(totalCostos),
        ingreso_neto: round(ingresoNeto),
        margen_pesos: round(margenPesos),
        margen_pct: round(margenPct),
        margen_sobre_venta: round(margenSobreVenta),
        envio_gratis_obligatorio: precioVenta >= 33000,
        alerta: margenPct < 0 ? '🔴 PÉRDIDA' : (margenPct < 10 ? '⚠️ Margen menor al 10%' : null)
    };
}

/**
 * CÁLCULO INVERSO: dado un precio de publicación ML, calcular el margen
 * Misma lógica que calcularML pero pensado para "ya tengo el precio, cuánto me queda"
 */
function margenInversoML(precioPublicacion, costoImportacion, pesoKg, canal, esEsencial, comisionPct, otrosCostos = {}) {
    const resultado = calcularML(precioPublicacion, costoImportacion, pesoKg, 0, 0, 0, canal, esEsencial, comisionPct, otrosCostos);
    
    return {
        precio_publicacion: round(precioPublicacion),
        costo_importacion: round(costoImportacion),
        // Desglose costos ML
        comision: round(resultado.comision_monto),
        costo_fijo_o_envio: round(resultado.costo_fijo.costo + resultado.costo_envio.costo),
        detalle_costo_ml: precioPublicacion < 33000 ? resultado.costo_fijo.detalle : resultado.costo_envio.detalle,
        // Desglose costos Goodies  
        iibb: round(resultado.iibb_monto),
        imp_interno: round(resultado.imp_interno_monto),
        financiero: round(resultado.financiero_monto),
        // Resultado
        total_deducciones: round(resultado.total_costos),
        ingreso_neto: round(resultado.ingreso_neto),
        margen_pesos: round(resultado.margen_pesos),
        margen_pct: round(resultado.margen_pct),
        margen_sobre_venta_pct: round(resultado.margen_sobre_venta),
        es_rentable: resultado.margen_pct > 0,
        alerta: resultado.alerta
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
 * Usa método iterativo porque el costo fijo depende del rango de precio
 */
function precioSugeridoML(costoProducto, pesoKg, canal, esEsencial, comisionPct, margenObjetivoPct, otrosCostos = {}) {
    const comision = comisionPct || COMISION_ML_DEFAULT;
    const totalOtrosPct = (otrosCostos.pctIIBB || 0) + (otrosCostos.pctFinanciero || 0) + (otrosCostos.pctLogisticoInterno || 0);

    // Estimación inicial
    let precio = costoProducto * (1 + margenObjetivoPct / 100) / (1 - comision / 100 - totalOtrosPct / 100);

    // Iteración para converger (el costo fijo cambia según el rango de precio)
    for (let i = 0; i < 30; i++) {
        const resultado = calcularML(precio, costoProducto, pesoKg, 0, 0, 0, canal, esEsencial, comisionPct, otrosCostos);
        const diff = resultado.margen_pct - margenObjetivoPct;
        if (Math.abs(diff) < 0.3) break;
        precio = precio * (1 + (margenObjetivoPct - resultado.margen_pct) / 200);
    }

    return round(precio);
}

/**
 * Optimizador completo: dado un artículo, calcular precio sugerido para cada canal
 * y comparar con precio actual
 * @param {Object} articulo - { costo_neto, peso_kg, precio_actual_ml, es_esencial }
 * @param {number} margenObjetivo - % margen deseado sobre costo
 * @param {number} comisionPct - % comisión ML
 * @param {Object} otrosCostos - { pctIIBB, pctFinanciero, pctLogisticoInterno }
 * @returns {Object} análisis por canal + recomendación
 */
function optimizarPrecioML(articulo, margenObjetivo, comisionPct, otrosCostos = {}) {
    const costo = articulo.costo_neto || 0;
    const peso = articulo.peso_kg || 0;
    const precioActual = articulo.precio_actual_ml || 0;
    const esEsencial = articulo.es_esencial || false;
    
    if (costo <= 0) return { error: 'Sin costo de importación' };
    
    const canales = ['flex', 'full_super', 'full_colecta'];
    const canalLabels = { flex: 'Flex', full_super: 'Full Súper', full_colecta: 'Full/Colecta' };
    
    const resultados = {};
    let mejorCanal = null;
    let mejorPrecio = Infinity;
    
    for (const canal of canales) {
        // Precio sugerido para el margen objetivo
        const precioSugerido = precioSugeridoML(costo, peso, canal, esEsencial, comisionPct, margenObjetivo, otrosCostos);
        
        // Si hay precio actual, calcular margen actual
        let margenActual = null;
        let resultadoActual = null;
        if (precioActual > 0) {
            resultadoActual = calcularML(precioActual, costo, peso, 0, 0, 0, canal, esEsencial, comisionPct, otrosCostos);
            margenActual = resultadoActual.margen_pct;
        }
        
        // Resultado con precio sugerido
        const resultadoSugerido = calcularML(precioSugerido, costo, peso, 0, 0, 0, canal, esEsencial, comisionPct, otrosCostos);
        
        resultados[canal] = {
            canal: canalLabels[canal],
            precio_sugerido: precioSugerido,
            margen_con_sugerido: resultadoSugerido.margen_pct,
            costo_fijo_sugerido: resultadoSugerido.costo_fijo.costo,
            comision_sugerido: resultadoSugerido.comision_monto,
            total_costos_ml_sugerido: resultadoSugerido.total_costos,
            // Con precio actual
            precio_actual: precioActual,
            margen_actual: margenActual,
            costo_fijo_actual: resultadoActual ? resultadoActual.costo_fijo.costo : 0,
            total_costos_ml_actual: resultadoActual ? resultadoActual.total_costos : 0,
            ingreso_neto_actual: resultadoActual ? resultadoActual.ingreso_neto : 0,
            // Delta
            ajuste_necesario: precioActual > 0 ? round(precioSugerido - precioActual) : null,
            ajuste_pct: precioActual > 0 ? round((precioSugerido - precioActual) / precioActual * 100) : null,
        };
        
        if (precioSugerido < mejorPrecio) {
            mejorPrecio = precioSugerido;
            mejorCanal = canal;
        }
    }
    
    // Recomendación
    let recomendacion = '';
    const mejor = resultados[mejorCanal];
    if (precioActual > 0) {
        if (mejor.ajuste_necesario <= 0) {
            recomendacion = `OK — Precio actual cubre margen ${margenObjetivo}% en ${mejor.canal}`;
        } else if (mejor.ajuste_pct <= 5) {
            recomendacion = `Ajuste menor: +${mejor.ajuste_pct}% en ${mejor.canal}`;
        } else if (mejor.ajuste_pct <= 15) {
            recomendacion = `Ajuste necesario: +${mejor.ajuste_pct}% en ${mejor.canal}`;
        } else {
            recomendacion = `⚠️ Ajuste grande: +${mejor.ajuste_pct}% — evaluar pausar`;
        }
    }
    
    return {
        costo_neto: costo,
        peso_kg: peso,
        margen_objetivo: margenObjetivo,
        mejor_canal: canalLabels[mejorCanal],
        mejor_precio: mejorPrecio,
        canales: resultados,
        recomendacion
    };
}

function round(v) {
    return Math.round(v * 100) / 100;
}

module.exports = {
    costoFijoML, costoEnvioGratis, calcularML, calcularMLConCaja, 
    precioSugeridoML, optimizarPrecioML, margenInversoML,
    pesoVolumetrico, pesoEfectivo,
    FLEX_COSTOS, FULL_SUPER_ESENCIALES, FULL_SUPER_RESTO, COLECTA_COSTOS, 
    ENVIO_GRATIS_COSTOS, COMISION_ML_DEFAULT, CAJAS_ML
};
