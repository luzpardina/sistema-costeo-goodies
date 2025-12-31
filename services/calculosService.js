// services/calculosService.js
// Servicio de cálculos automáticos para costeo de importación
// Usa el TC correcto según la moneda principal del costeo

const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios } = require('../models');

class CalculosService {

    static async calcularCosteo(costeoId) {
        try {
            // 1. Obtener el costeo con todos sus datos relacionados
            const costeo = await Costeo.findByPk(costeoId, {
                include: [
                    { model: ArticuloCosteo, as: 'articulos' },
                    { model: GastosAduana, as: 'gastos_aduana' },
                    { model: GastosVarios, as: 'gastos_varios' }
                ]
            });

            if (!costeo) {
                throw new Error('Costeo no encontrado');
            }

            // TCs disponibles
            const tc_usd = parseFloat(costeo.tc_usd) || 1;
            const tc_eur = parseFloat(costeo.tc_eur) || tc_usd;
            const tc_gbp = parseFloat(costeo.tc_gbp) || tc_usd;

            // Determinar TC principal según moneda de factura
            const monedaPrincipal = (costeo.moneda_principal || 'USD').toUpperCase();
            let tcPrincipal = tc_usd;
            if (monedaPrincipal === 'EUR') {
                tcPrincipal = tc_eur;
            } else if (monedaPrincipal === 'GBP') {
                tcPrincipal = tc_gbp;
            }

            const articulos = costeo.articulos || [];
            const gastosAduana = costeo.gastos_aduana;
            const gastosVarios = costeo.gastos_varios || [];

            // 2. Calcular FOB TOTAL en PESOS (suma de todos los artículos)
            // Usando el TC de la moneda principal
            let fobTotalPesos = 0;
            let fobTotalDivisa = 0;
            for (const art of articulos) {
                const importeOrigen = parseFloat(art.importe_total_origen) || 0;
                fobTotalDivisa += importeOrigen;
                fobTotalPesos += importeOrigen * tcPrincipal;
            }

            // 3. Obtener Gastos Base Aduana (Flete + Seguro)
            // Estos vienen en la moneda que indica el Excel, convertir a pesos
            const fleteUSD = parseFloat(costeo.flete_usd) || 0;
            const seguroUSD = parseFloat(costeo.seguro_usd) || 0;
            // El flete y seguro están guardados como "USD" pero en realidad vienen en la moneda del Excel
            // Usamos el TC principal porque generalmente coinciden con la moneda de factura
            const gastosBaseAduanaTotal = (fleteUSD + seguroUSD) * tcPrincipal;

            // 4. Calcular total de Gastos Varios (convertir a pesos si no están convertidos)
            let totalGastosVariosPesos = 0;
            for (const gasto of gastosVarios) {
                let montoARS = parseFloat(gasto.monto_ars) || 0;
                
                // Si monto_ars es 0 pero hay monto, calcularlo ahora
                if (montoARS === 0 && gasto.monto) {
                    const montoOriginal = parseFloat(gasto.monto) || 0;
                    const monedaGasto = (gasto.moneda || 'USD').toUpperCase();
                    const recargo = parseFloat(gasto.recargo) || 0;
                    
                    let tcGasto = 1;
                    if (monedaGasto === 'USD') {
                        tcGasto = tc_usd;
                    } else if (monedaGasto === 'EUR') {
                        tcGasto = tc_eur || tc_usd;
                    } else if (monedaGasto === 'GBP') {
                        tcGasto = tc_gbp || tc_usd;
                    }
                    // Si es ARS, tcGasto queda en 1
                    
                    montoARS = montoOriginal * tcGasto;
                    if (recargo > 0) {
                        montoARS = montoARS * (1 + recargo / 100);
                    }
                    
                    // Actualizar el gasto con monto_ars calculado
                    await gasto.update({ monto_ars: montoARS });
                }
                
                totalGastosVariosPesos += montoARS;
            }
            // 5. Calcular cada artículo
            let totalDerechosARS = 0;
            let totalEstadisticaARS = 0;
            let totalIVA_ARS = 0;
            let totalImpuestoInternoARS = 0;
            let totalAnmatARS = 0;
            let totalCostoNetoARS = 0;
            let unidadesTotales = 0;

            const articulosActualizados = [];

            for (const articulo of articulos) {
                const importeOrigen = parseFloat(articulo.importe_total_origen) || 0;
                const unidades = parseInt(articulo.unidades_totales) || 1;
                const derechosPct = parseFloat(articulo.derechos_porcentaje) || 0;
                const impInternosPct = parseFloat(articulo.impuesto_interno_porcentaje) || 0;

                // FOB en pesos (usando TC principal)
                const fobTotalArtPesos = importeOrigen * tcPrincipal;
                const fobUnitarioPesos = fobTotalArtPesos / unidades;
                const fobUnitarioDivisa = importeOrigen / unidades;

                // Participación FOB (% que representa este artículo del total)
                const participacionFOB = fobTotalPesos > 0 ? fobTotalArtPesos / fobTotalPesos : 0;

                // ANMAT = FOB Pesos × 0.5%
                const anmatARS = fobTotalArtPesos * 0.005;

                // Gastos Base Aduana prorrateados (Flete + Seguro)
                const gastosBaseAduanaArt = gastosBaseAduanaTotal * participacionFOB;

                // Base Aduana = FOB Pesos + Gastos Base Aduana
                const baseAduana = fobTotalArtPesos + gastosBaseAduanaArt;

                // Derechos = Base Aduana × % Derechos (solo si % > 0)
                const derechosARS = derechosPct > 0 ? baseAduana * derechosPct : 0;

                // Estadística = Base Aduana × 3% (solo si Derechos > 0)
                const estadisticaARS = derechosPct > 0 ? baseAduana * 0.03 : 0;

                // Gastos Varios prorrateados
                const gastosVariosArt = totalGastosVariosPesos * participacionFOB;

                // COSTO TOTAL NETO = FOB + ANMAT + Derechos + Estadística + Gastos Varios
                const costoTotalNetoARS = fobTotalArtPesos + anmatARS + derechosARS + estadisticaARS + gastosVariosArt;

                // COSTO UNITARIO NETO = Costo Total Neto / Unidades
                const costoUnitarioNetoARS = costoTotalNetoARS / unidades;

                // Impuesto Interno = Costo Unitario Neto × % Imp. Interno
                const impuestoInternoUnitARS = costoUnitarioNetoARS * impInternosPct;
                const impuestoInternoTotalARS = impuestoInternoUnitARS * unidades;

                // IVA = Costo Unitario Neto × 21%
                const ivaUnitarioARS = costoUnitarioNetoARS * 0.21;
                const ivaTotalARS = ivaUnitarioARS * unidades;

                // COSTO FINAL = Costo Unitario Neto + Imp. Interno + IVA
                const costoUnitarioFinalARS = costoUnitarioNetoARS + impuestoInternoUnitARS + ivaUnitarioARS;
                const costoTotalFinalARS = costoUnitarioFinalARS * unidades;

                // FACTOR IMPORTACIÓN = ((Costo Neto - FOB Unit Pesos) / FOB Unit Pesos) × 100
                const factorImportacion = fobUnitarioPesos > 0 ? 
                    ((costoUnitarioNetoARS - fobUnitarioPesos) / fobUnitarioPesos) * 100 : 0;

                // Acumular totales
                totalAnmatARS += anmatARS;
                totalDerechosARS += derechosARS;
                totalEstadisticaARS += estadisticaARS;
                totalIVA_ARS += ivaTotalARS;
                totalImpuestoInternoARS += impuestoInternoTotalARS;
                totalCostoNetoARS += costoTotalNetoARS;
                unidadesTotales += unidades;

                // Actualizar artículo en base de datos
                await articulo.update({
                    participacion_fob: participacionFOB,
                    fob_unitario_usd: fobUnitarioDivisa,
                    fob_total_usd: importeOrigen,
                    fob_unitario_ars: fobUnitarioPesos,
                    fob_total_ars: fobTotalArtPesos,
                    anmat_ars: anmatARS,
                    gastos_base_aduana_ars: gastosBaseAduanaArt,
                    base_aduana_ars: baseAduana,
                    derechos_total_ars: derechosARS,
                    estadistica_total_ars: estadisticaARS,
                    gastos_varios_ars: gastosVariosArt,
                    costo_total_neto_ars: costoTotalNetoARS,
                    costo_unitario_neto_ars: costoUnitarioNetoARS,
                    iva_unitario_ars: ivaUnitarioARS,
                    iva_total_ars: ivaTotalARS,
                    impuesto_interno_unitario_ars: impuestoInternoUnitARS,
                    impuesto_interno_total_ars: impuestoInternoTotalARS,
                    costo_unitario_ars: costoUnitarioFinalARS,
                    costo_total_ars: costoTotalFinalARS,
                    factor_importacion: factorImportacion
                });

                articulosActualizados.push({
                    codigo: articulo.codigo_goodies,
                    nombre: articulo.nombre,
                    unidades: unidades,
                    fob_unitario_divisa: fobUnitarioDivisa,
                    fob_unitario_pesos: fobUnitarioPesos,
                    costo_unitario_neto: costoUnitarioNetoARS,
                    iva_unitario: ivaUnitarioARS,
                    imp_interno_unitario: impuestoInternoUnitARS,
                    costo_unitario_final: costoUnitarioFinalARS,
                    factor_importacion: factorImportacion
                });
            }

            // 6. Calcular totales del costeo
            const totalTributosARS = totalDerechosARS + totalEstadisticaARS + totalIVA_ARS + totalImpuestoInternoARS;
            const costoTotalFinalARS = totalCostoNetoARS + totalIVA_ARS + totalImpuestoInternoARS;

            // 7. Actualizar costeo en base de datos
            await costeo.update({
                fob_total_usd: fobTotalDivisa,
                fob_total_ars: fobTotalPesos,
                anmat_total_ars: totalAnmatARS,
                derechos_total_ars: totalDerechosARS,
                estadistica_ars: totalEstadisticaARS,
                iva_ars: totalIVA_ARS,
                impuesto_interno_ars: totalImpuestoInternoARS,
                total_tributos_ars: totalTributosARS,
                total_gastos_ars: totalGastosVariosPesos,
                costo_total_neto_ars: totalCostoNetoARS,
                costo_total_ars: costoTotalFinalARS,
                unidades_totales: unidadesTotales,
                estado: 'calculado'
            });

            // 8. Retornar resumen
            return {
                exito: true,
                costeo_id: costeoId,
                moneda_principal: monedaPrincipal,
                tc_utilizado: tcPrincipal,
                resumen: {
                    fob_total_divisa: fobTotalDivisa.toFixed(2),
                    fob_total_pesos: fobTotalPesos.toFixed(2),
                    anmat_total: totalAnmatARS.toFixed(2),
                    gastos_base_aduana: gastosBaseAduanaTotal.toFixed(2),
                    derechos_ars: totalDerechosARS.toFixed(2),
                    estadistica_ars: totalEstadisticaARS.toFixed(2),
                    gastos_varios_ars: totalGastosVariosPesos.toFixed(2),
                    costo_total_neto_ars: totalCostoNetoARS.toFixed(2),
                    iva_ars: totalIVA_ARS.toFixed(2),
                    impuesto_interno_ars: totalImpuestoInternoARS.toFixed(2),
                    costo_total_final_ars: costoTotalFinalARS.toFixed(2),
                    unidades_totales: unidadesTotales
                },
                articulos: articulosActualizados
            };

        } catch (error) {
            console.error('Error en calculos:', error);
            throw error;
        }
    }
}

module.exports = CalculosService;
