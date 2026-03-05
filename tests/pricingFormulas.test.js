const {
    grossUp, markup, tasaCompuestaOC,
    calcularPrecioNetoGoodies, calcularBrutoAcordado,
    aplicarDescuentosOCCascada, calcularMargenInverso, round
} = require('../services/pricingFormulas');

describe('Fórmulas básicas', () => {
    test('grossUp: costo $100, 35% → $153.85', () => {
        expect(round(grossUp(100, 35))).toBe(153.85);
    });

    test('grossUp: protección >= 100% devuelve costo', () => {
        expect(grossUp(100, 100)).toBe(100);
        expect(grossUp(100, 120)).toBe(100);
    });

    test('markup: costo $100, 30% → $130', () => {
        expect(markup(100, 30)).toBe(130);
    });

    test('markup: costo $200, 50% → $300', () => {
        expect(markup(200, 50)).toBe(300);
    });
});

describe('Tasa compuesta OC', () => {
    test('un solo escalón: 10% → 10%', () => {
        expect(round(tasaCompuestaOC([10]))).toBe(10);
    });

    test('dos escalones: 10% + 5% → 14.5% (no 15%)', () => {
        // 1 - (1-0.10)(1-0.05) = 1 - 0.90 * 0.95 = 1 - 0.855 = 14.5%
        expect(round(tasaCompuestaOC([10, 5]))).toBe(14.5);
    });

    test('tres escalones: 10% + 5% + 3% → 17.07%', () => {
        // 1 - (0.90)(0.95)(0.97) = 1 - 0.82935 = 17.065%
        const result = tasaCompuestaOC([10, 5, 3]);
        expect(round(result)).toBe(17.07);
    });

    test('sin escalones: [] → 0%', () => {
        expect(tasaCompuestaOC([])).toBe(0);
    });
});

describe('Precio Neto Goodies (gross-up)', () => {
    test('Ejemplo Jumbo: costo $100, margen 35% → ~$153.85', () => {
        const precio = calcularPrecioNetoGoodies(100, { margen: 35 });
        expect(round(precio)).toBe(153.85);
    });

    test('Con todos los costos: costo $100, margen 30% + log 5% + iibb 3%', () => {
        // sumaPct = 38%, precio = 100 / (1-0.38) = 161.29
        const precio = calcularPrecioNetoGoodies(100, { margen: 30, logistico: 5, iibb: 3 });
        expect(round(precio)).toBe(161.29);
    });
});

describe('Bruto Acordado (segunda capa gross-up)', () => {
    test('Ejemplo Jumbo: Neto $153.85, cadena 18% → $187.62', () => {
        const bruto = calcularBrutoAcordado(153.85, 18);
        expect(round(bruto)).toBe(187.62);
    });
});

describe('Descuentos OC en cascada', () => {
    test('Un solo descuento: bruto $200, OC 10% → neto $180', () => {
        const result = aplicarDescuentosOCCascada(200, [10]);
        expect(result.netoFinal).toBe(180);
        expect(result.totalDescuento).toBe(20);
        expect(result.pasos.length).toBe(1);
    });

    test('Dos escalones: bruto $200, OC1 10% + OC2 5%', () => {
        // Paso 1: $200 - 10% = $180
        // Paso 2: $180 - 5% = $171
        const result = aplicarDescuentosOCCascada(200, [10, 5]);
        expect(result.netoFinal).toBe(171);
        expect(result.pasos[0].neto).toBe(180);
        expect(result.pasos[1].neto).toBe(171);
        expect(result.totalDescuento).toBe(29);
    });

    test('Tres escalones: bruto $187.62, OC 11% + 5% + 2%', () => {
        const result = aplicarDescuentosOCCascada(187.62, [11, 5, 2]);
        // 187.62 * 0.89 = 166.98
        // 166.98 * 0.95 = 158.63
        // 158.63 * 0.98 = 155.46
        expect(result.pasos.length).toBe(3);
        expect(result.netoFinal).toBeCloseTo(155.46, 0);
    });
});

describe('Margen inverso (PVP → Margen Goodies)', () => {
    test('Caso simple sin acuerdos cadena', () => {
        // PVP $1000, IVA 21%, margen goodies 35%, sin markup trad, sin cadena
        // Neto sin IVA: 1000/1.21 = 826.45
        // Deducciones: 0%
        // Margen: (826.45 - costo) / costo
        const result = calcularMargenInverso(1000, 500, {
            ivaPct: 0.21,
            impInternoPct: 0,
            pctMargenCliente: 0,
            pctMarkupTrad: 0,
            pctAcuerdoCadena: 0,
            pctGastosTotal: 0
        });
        expect(result.precioNetoGoodies).toBeCloseTo(826.45, 0);
        expect(result.margenPct).toBeGreaterThan(60);
    });

    test('Con margen super y acuerdos cadena', () => {
        // Simular: PVP, costo $100, margen super 35%, cadena 18%
        const result = calcularMargenInverso(500, 100, {
            ivaPct: 0.21,
            impInternoPct: 0,
            pctMargenCliente: 35,
            pctMarkupTrad: 0,
            pctAcuerdoCadena: 18,
            pctGastosTotal: 10
        });
        // Debe devolver un margen positivo
        expect(result.margenPct).toBeGreaterThan(0);
        expect(result.precioNetoGoodies).toBeGreaterThan(100);
    });
});

describe('Consistencia gross-up ↔ margen inverso', () => {
    test('Forward gross-up then inverse should recover the original cost relationship', () => {
        const costoNeto = 100;
        const pctMargen = 35;
        const pctLogistico = 5;
        const pctIIBB = 3;
        
        // Forward: calcular precio (margen + gastos embedded via gross-up)
        const netoGoodies = calcularPrecioNetoGoodies(costoNeto, {
            margen: pctMargen, logistico: pctLogistico, iibb: pctIIBB
        });
        
        // netoGoodies = 100 / (1 - 0.43) = 175.44
        // Deducciones en inverso = log + iibb = 8% (NO incluir margen, es lo que calculamos)
        // Ingreso neto = 175.44 - 175.44*0.08 = 161.40
        // Margen = (161.40 - 100) / 100 = 61.4%
        // Esto es correcto: el margen SOBRE COSTO es mayor que el % gross-up
        
        const pvp = netoGoodies * 1.21;
        const resultado = calcularMargenInverso(pvp, costoNeto, {
            ivaPct: 0.21, impInternoPct: 0,
            pctMargenCliente: 0, pctMarkupTrad: 0,
            pctAcuerdoCadena: 0,
            pctGastosTotal: pctLogistico + pctIIBB
        });
        
        // El margen sobre costo (61.4%) es mayor que el % de gross-up (35%)
        // porque gross-up % es sobre precio, no sobre costo
        expect(resultado.precioNetoGoodies).toBeCloseTo(netoGoodies, 0);
        expect(resultado.margenPct).toBeGreaterThan(pctMargen);
    });
});

// =============================================
// MERCADO LIBRE COST TESTS
// =============================================
const mlService = require('../services/mlCostos');

describe('ML - Costo fijo Flex', () => {
    test('Producto $10.000 → $1.255', () => {
        const r = mlService.costoFijoML(10000, 1, 'flex', false);
        expect(r.costo).toBe(1255);
    });

    test('Producto $20.000 → $2.500', () => {
        const r = mlService.costoFijoML(20000, 1, 'flex', false);
        expect(r.costo).toBe(2500);
    });

    test('Producto $30.000 → $3.030', () => {
        const r = mlService.costoFijoML(30000, 1, 'flex', false);
        expect(r.costo).toBe(3030);
    });

    test('Producto >= $33.000 → $0', () => {
        const r = mlService.costoFijoML(35000, 1, 'flex', false);
        expect(r.costo).toBe(0);
    });
});

describe('ML - Costo fijo Full Súper', () => {
    test('Esencial: $6.000, 1.5kg → $350', () => {
        const r = mlService.costoFijoML(6000, 1.5, 'full_super', true);
        expect(r.costo).toBe(350);
    });

    test('Resto: $6.000, 1.5kg → $600', () => {
        const r = mlService.costoFijoML(6000, 1.5, 'full_super', false);
        expect(r.costo).toBe(600);
    });

    test('Resto: $20.000, 3kg → $1.750', () => {
        const r = mlService.costoFijoML(20000, 3, 'full_super', false);
        expect(r.costo).toBe(1750);
    });

    test('Tope 25%: producto $500, no puede pasar de $125', () => {
        const r = mlService.costoFijoML(500, 1, 'full_super', false);
        expect(r.costo).toBe(125);
        expect(r.tope_aplicado).toBe(true);
    });
});

describe('ML - Peso volumétrico', () => {
    test('20×20×25 cm → 2.5 kg', () => {
        expect(mlService.pesoVolumetrico(20, 20, 25)).toBe(2.5);
    });

    test('30×20×10 cm → 1.5 kg', () => {
        expect(mlService.pesoVolumetrico(30, 20, 10)).toBe(1.5);
    });
});

describe('ML - Cálculo completo', () => {
    test('Producto $15.000 en Flex, costo $8.000, comisión 14%', () => {
        const r = mlService.calcularML(15000, 8000, 1, 0, 0, 0, 'flex', false, 14, {});
        expect(r.comision_monto).toBe(2100);
        expect(r.costo_fijo.costo).toBe(1255);
        expect(r.total_costos_ml).toBe(3355);
        expect(r.ingreso_neto).toBe(11645);
        expect(r.margen_pesos).toBe(3645);
        expect(r.margen_pct).toBeCloseTo(45.6, 0);
    });

    test('Producto >= $33.000 no tiene costo fijo', () => {
        const r = mlService.calcularML(40000, 20000, 2, 0, 0, 0, 'flex', false, 14, {});
        expect(r.costo_fijo.costo).toBe(0);
        expect(r.envio_gratis_obligatorio).toBe(true);
    });
});

describe('ML - Costo fijo Colecta', () => {
    test('Producto $10.000, 0.8kg → $1.255', () => {
        const r = mlService.costoFijoML(10000, 0.8, 'colecta', false);
        expect(r.costo).toBe(1255);
    });

    test('Producto $20.000, 3.5kg → $2.620', () => {
        const r = mlService.costoFijoML(20000, 3.5, 'colecta', false);
        expect(r.costo).toBe(2620);
    });

    test('Producto $28.000, 10kg → $3.510', () => {
        const r = mlService.costoFijoML(28000, 10.5, 'colecta', false);
        expect(r.costo).toBe(3510);
    });

    test('Colecta >= $33.000 → $0', () => {
        const r = mlService.costoFijoML(35000, 5, 'colecta', false);
        expect(r.costo).toBe(0);
    });
});

describe('ML - Optimizador de precios', () => {
    test('Precio sugerido para margen 30% debe dar ~30%', () => {
        const precio = mlService.precioSugeridoML(10000, 1, 'flex', false, 14, 30, { pctIIBB: 3.5 });
        const check = mlService.calcularML(precio, 10000, 1, 0, 0, 0, 'flex', false, 14, { pctIIBB: 3.5 });
        expect(check.margen_pct).toBeCloseTo(30, 0);
    });

    test('Optimizador devuelve 3 canales', () => {
        const result = mlService.optimizarPrecioML(
            { costo_neto: 10000, peso_kg: 1, precio_actual_ml: 20000, es_esencial: false },
            30, 14, { pctIIBB: 3.5 }
        );
        expect(result.canales).toBeDefined();
        expect(result.canales.flex).toBeDefined();
        expect(result.canales.full_super).toBeDefined();
        expect(result.canales.full_colecta).toBeDefined();
        expect(result.mejor_canal).toBeDefined();
        expect(result.mejor_precio).toBeGreaterThan(0);
    });

    test('Si precio actual cubre margen, ajuste <= 0', () => {
        const result = mlService.optimizarPrecioML(
            { costo_neto: 5000, peso_kg: 0.5, precio_actual_ml: 50000, es_esencial: false },
            30, 14, {}
        );
        const mejor = Object.values(result.canales).sort((a,b) => a.precio_sugerido - b.precio_sugerido)[0];
        expect(mejor.ajuste_necesario).toBeLessThanOrEqual(0);
    });

    test('Si precio actual es bajo, ajuste > 0', () => {
        const result = mlService.optimizarPrecioML(
            { costo_neto: 10000, peso_kg: 1, precio_actual_ml: 12000, es_esencial: false },
            30, 14, {}
        );
        const mejor = Object.values(result.canales).sort((a,b) => a.precio_sugerido - b.precio_sugerido)[0];
        expect(mejor.ajuste_necesario).toBeGreaterThan(0);
    });
});
