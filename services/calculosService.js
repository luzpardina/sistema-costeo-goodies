// services/calculosService.js
// Servicio de cálculos automáticos para costeo de importación
// Soporta ANMAT selectivo, gastos por grupo y COSTEOS CONSOLIDADOS
// Cada gasto puede tener su propio método de prorrateo

const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios, ConsolidadoProveedor } = require('../models');

class CalculosService {

    static async calcularCosteo(costeoId) {
        try {
            const costeo = await Costeo.findByPk(costeoId, {
                include: [
                    { model: ArticuloCosteo, as: 'articulos' },
                    { model: GastosAduana, as: 'gastos_aduana' },
                    { model: GastosVarios, as: 'gastos_varios' },
                    { model: ConsolidadoProveedor, as: 'proveedores_consolidado' }
                ]
            });

            if (!costeo) {
                throw new Error('Costeo no encontrado');
            }

            const tc_usd = parseFloat(costeo.tc_usd) || 1;
            const tc_eur = parseFloat(costeo.tc_eur) || tc_usd;
            const tc_gbp = parseFloat(costeo.tc_gbp) || tc_usd;

            const monedaPrincipal = (costeo.moneda_principal || 'USD').toUpperCase();
            let tcPrincipal = tc_usd;
            if (monedaPrincipal === 'EUR') {
                tcPrincipal = tc_eur;
            } else if (monedaPrincipal === 'GBP') {
                tcPrincipal = tc_gbp;
            }

            const articulos = costeo.articulos || [];
            const gastosVarios = costeo.gastos_varios || [];
            const proveedoresConsolidado = costeo.proveedores_consolidado || [];

            // ========================================
            // CALCULAR PARTICIPACIONES PARA CONSOLIDADO
            // ========================================
            const esConsolidado = costeo.es_consolidado === true;
            let participacionPorFOB = 1;
            let participacionPorVolumen = 1;
            let participacionPorPeso = 1;

            if (esConsolidado && proveedoresConsolidado.length > 0) {
                const fobProveedorActual = articulos.reduce((sum, art) => {
                    return sum + (parseFloat(art.importe_total_origen) || 0);
                }, 0);
                const volumenActual = parseFloat(costeo.volumen_m3) || 0;
                const pesoActual = parseFloat(costeo.peso_kg) || 0;

                let fobOtrosProveedores = 0;
                let volumenOtros = 0;
                let pesoOtros = 0;

                for (const prov of proveedoresConsolidado) {
                    let fobProv = parseFloat(prov.fob_total) || 0;
                    const monedaProv = (prov.moneda || 'USD').toUpperCase();
                    
                    if (monedaProv !== monedaPrincipal) {
                        let fobEnUSD = fobProv;
                        if (monedaProv === 'EUR') {
                            fobEnUSD = fobProv * (tc_eur / tc_usd);
                        } else if (monedaProv === 'GBP') {
                            fobEnUSD = fobProv * (tc_gbp / tc_usd);
                        }
                        
                        if (monedaPrincipal === 'EUR') {
                            fobProv = fobEnUSD * (tc_usd / tc_eur);
                        } else if (monedaPrincipal === 'GBP') {
                            fobProv = fobEnUSD * (tc_usd / tc_gbp);
                        } else {
                            fobProv = fobEnUSD;
                        }
                    }
                    
                    fobOtrosProveedores += fobProv;
                    volumenOtros += parseFloat(prov.volumen_m3) || 0;
                    pesoOtros += parseFloat(prov.peso_kg) || 0;
                }

                const fobTotalConsolidado = fobProveedorActual + fobOtrosProveedores;
                const volumenTotalConsolidado = volumenActual + volumenOtros;
                const pesoTotalConsolidado = pesoActual + pesoOtros;

                participacionPorFOB = fobTotalConsolidado > 0 ? fobProveedorActual / fobTotalConsolidado : 1;
                participacionPorVolumen = volumenTotalConsolidado > 0 ? volumenActual / volumenTotalConsolidado : 1;
                participacionPorPeso = pesoTotalConsolidado > 0 ? pesoActual / pesoTotalConsolidado : 1;
            }

            // 2. Calcular FOB TOTAL en PESOS
            let fobTotalPesos = 0;
            let fobTotalDivisa = 0;
            const fobPorGrupo = {};
            let fobArticulosConAnmat = 0;

            for (const art of articulos) {
                const importeOrigen = parseFloat(art.importe_total_origen) || 0;
                const fobArtPesos = importeOrigen * tcPrincipal;
                const grupo = art.grupo || '';
                const aplicaAnmat = art.aplica_anmat !== false;

                fobTotalDivisa += importeOrigen;
                fobTotalPesos += fobArtPesos;

                if (!fobPorGrupo[grupo]) {
                    fobPorGrupo[grupo] = 0;
                }
                fobPorGrupo[grupo] += fobArtPesos;

                if (aplicaAnmat) {
                    fobArticulosConAnmat += fobArtPesos;
                }
            }

            // 3. Obtener Gastos Base Aduana (Flete + Seguro)
            const fleteUSD = parseFloat(costeo.flete_usd) || 0;
            const seguroUSD = parseFloat(costeo.seguro_usd) || 0;
            let gastosBaseAduanaTotal = (fleteUSD + seguroUSD) * tcPrincipal;

            // Si es consolidado, el flete/seguro también se prorratea (por volumen típicamente)
            if (esConsolidado) {
                gastosBaseAduanaTotal = gastosBaseAduanaTotal * participacionPorVolumen;
            }

            // 4. Calcular total de Gastos Varios aplicando método de prorrateo individual
            const gastosPorGrupo = {};
            let totalGastosVariosPesos = 0;

            for (const gasto of gastosVarios) {
                let montoARS = parseFloat(gasto.monto_ars) || 0;

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

                    montoARS = montoOriginal * tcGasto;
                    if (recargo > 0) {
                        montoARS = montoARS * (1 + recargo / 100);
                    }

                    await gasto.update({ monto_ars: montoARS });
                }

                // APLICAR PRORRATEO SEGÚN MÉTODO ELEGIDO PARA CADA GASTO
                if (esConsolidado) {
                    const metodo = gasto.metodo_prorrateo || 'no_prorratear';
                    
                    if (metodo === 'por_fob') {
                        montoARS = montoARS * participacionPorFOB;
                    } else if (metodo === 'por_volumen') {
                        montoARS = montoARS * participacionPorVolumen;
                    } else if (metodo === 'por_peso') {
                        montoARS = montoARS * participacionPorPeso;
                    }
                    // Si es 'no_prorratear', se queda con el 100%
                }

                totalGastosVariosPesos += montoARS;

                const grupoGasto = gasto.grupo || '';
                if (!gastosPorGrupo[grupoGasto]) {
                    gastosPorGrupo[grupoGasto] = 0;
                }
                gastosPorGrupo[grupoGasto] += montoARS;
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
                const grupoArticulo = articulo.grupo || '';
                const aplicaAnmat = articulo.aplica_anmat !== false;

                const fobTotalArtPesos = importeOrigen * tcPrincipal;
                const fobUnitarioPesos = fobTotalArtPesos / unidades;
                const fobUnitarioDivisa = importeOrigen / unidades;

                const participacionFOB = fobTotalPesos > 0 ? fobTotalArtPesos / fobTotalPesos : 0;

                let anmatARS = 0;
                if (aplicaAnmat && fobArticulosConAnmat > 0) {
                    anmatARS = fobTotalArtPesos * 0.005;
                }

                const gastosBaseAduanaArt = gastosBaseAduanaTotal * participacionFOB;
                const baseAduana = fobTotalArtPesos + gastosBaseAduanaArt;

                const derechosARS = derechosPct > 0 ? baseAduana * derechosPct : 0;
                const estadisticaARS = derechosPct > 0 ? baseAduana * 0.03 : 0;

                let gastosVariosArt = 0;
                const gastosGenerales = gastosPorGrupo[''] || 0;
                gastosVariosArt += gastosGenerales * participacionFOB;

                for (const [grupoGasto, montoGasto] of Object.entries(gastosPorGrupo)) {
                    if (grupoGasto !== '' && grupoGasto === grupoArticulo) {
                        const fobDelGrupo = fobPorGrupo[grupoArticulo] || 0;
                        if (fobDelGrupo > 0) {
                            const participacionEnGrupo = fobTotalArtPesos / fobDelGrupo;
                            gastosVariosArt += montoGasto * participacionEnGrupo;
                        }
                    }
                }

                const costoTotalNetoARS = fobTotalArtPesos + anmatARS + derechosARS + estadisticaARS + gastosVariosArt;
                const costoUnitarioNetoARS = costoTotalNetoARS / unidades;

                const impuestoInternoUnitARS = costoUnitarioNetoARS * impInternosPct;
                const impuestoInternoTotalARS = impuestoInternoUnitARS * unidades;

                const ivaUnitarioARS = costoUnitarioNetoARS * 0.21;
                const ivaTotalARS = ivaUnitarioARS * unidades;

                const costoUnitarioFinalARS = costoUnitarioNetoARS + impuestoInternoUnitARS + ivaUnitarioARS;
                const costoTotalFinalARS = costoUnitarioFinalARS * unidades;

                const factorImportacion = fobUnitarioPesos > 0 ?
                    ((costoUnitarioNetoARS - fobUnitarioPesos) / fobUnitarioPesos) * 100 : 0;

                totalAnmatARS += anmatARS;
                totalDerechosARS += derechosARS;
                totalEstadisticaARS += estadisticaARS;
                totalIVA_ARS += ivaTotalARS;
                totalImpuestoInternoARS += impuestoInternoTotalARS;
                totalCostoNetoARS += costoTotalNetoARS;
                unidadesTotales += unidades;

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
                    grupo: grupoArticulo,
                    aplica_anmat: aplicaAnmat,
                    fob_unitario_divisa: fobUnitarioDivisa,
                    fob_unitario_pesos: fobUnitarioPesos,
                    anmat: anmatARS,
                    gastos_varios: gastosVariosArt,
                    costo_unitario_neto: costoUnitarioNetoARS,
                    iva_unitario: ivaUnitarioARS,
                    imp_interno_unitario: impuestoInternoUnitARS,
                    costo_unitario_final: costoUnitarioFinalARS,
                    factor_importacion: factorImportacion
                });
            }

            const totalTributosARS = totalDerechosARS + totalEstadisticaARS + totalIVA_ARS + totalImpuestoInternoARS;
            const costoTotalFinalARS = totalCostoNetoARS + totalIVA_ARS + totalImpuestoInternoARS;

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

            const resultado = {
                exito: true,
                costeo_id: costeoId,
                moneda_principal: monedaPrincipal,
                tc_utilizado: tcPrincipal,
                es_consolidado: esConsolidado,
                participaciones: esConsolidado ? {
                    por_fob: (participacionPorFOB * 100).toFixed(2) + '%',
                    por_volumen: (participacionPorVolumen * 100).toFixed(2) + '%',
                    por_peso: (participacionPorPeso * 100).toFixed(2) + '%'
                } : null,
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

            return resultado;

        } catch (error) {
            console.error('Error en calculos:', error);
            throw error;
        }
    }

    // Método para obtener preview de participaciones
    static async previewConsolidado(costeoId) {
        try {
            const costeo = await Costeo.findByPk(costeoId, {
                include: [
                    { model: ArticuloCosteo, as: 'articulos' },
                    { model: GastosVarios, as: 'gastos_varios' },
                    { model: ConsolidadoProveedor, as: 'proveedores_consolidado' }
                ]
            });

            if (!costeo) {
                throw new Error('Costeo no encontrado');
            }

            if (!costeo.es_consolidado) {
                return { es_consolidado: false, mensaje: 'Este costeo no es consolidado' };
            }

            const tc_usd = parseFloat(costeo.tc_usd) || 1;
            const tc_eur = parseFloat(costeo.tc_eur) || tc_usd;
            const tc_gbp = parseFloat(costeo.tc_gbp) || tc_usd;
            const monedaPrincipal = (costeo.moneda_principal || 'USD').toUpperCase();

            const articulos = costeo.articulos || [];
            const proveedoresConsolidado = costeo.proveedores_consolidado || [];
            const gastosVarios = costeo.gastos_varios || [];

            const fobProveedorActual = articulos.reduce((sum, art) => {
                return sum + (parseFloat(art.importe_total_origen) || 0);
            }, 0);
            const volumenActual = parseFloat(costeo.volumen_m3) || 0;
            const pesoActual = parseFloat(costeo.peso_kg) || 0;

            let fobOtrosProveedores = 0;
            let volumenOtros = 0;
            let pesoOtros = 0;
            const detalleProveedores = [];

            for (const prov of proveedoresConsolidado) {
                let fobProv = parseFloat(prov.fob_total) || 0;
                const monedaProv = (prov.moneda || 'USD').toUpperCase();
                
                if (monedaProv !== monedaPrincipal) {
                    let fobEnUSD = fobProv;
                    if (monedaProv === 'EUR') {
                        fobEnUSD = fobProv * (tc_eur / tc_usd);
                    } else if (monedaProv === 'GBP') {
                        fobEnUSD = fobProv * (tc_gbp / tc_usd);
                    }
                    
                    if (monedaPrincipal === 'EUR') {
                        fobProv = fobEnUSD * (tc_usd / tc_eur);
                    } else if (monedaPrincipal === 'GBP') {
                        fobProv = fobEnUSD * (tc_usd / tc_gbp);
                    } else {
                        fobProv = fobEnUSD;
                    }
                }
                
                fobOtrosProveedores += fobProv;
                volumenOtros += parseFloat(prov.volumen_m3) || 0;
                pesoOtros += parseFloat(prov.peso_kg) || 0;

                detalleProveedores.push({
                    nombre: prov.nombre_proveedor,
                    fob_original: parseFloat(prov.fob_total) || 0,
                    moneda: prov.moneda,
                    fob_convertido: fobProv,
                    volumen_m3: parseFloat(prov.volumen_m3) || 0,
                    peso_kg: parseFloat(prov.peso_kg) || 0
                });
            }

            const fobTotal = fobProveedorActual + fobOtrosProveedores;
            const volumenTotal = volumenActual + volumenOtros;
            const pesoTotal = pesoActual + pesoOtros;

            const participacionFOB = fobTotal > 0 ? fobProveedorActual / fobTotal : 1;
            const participacionVolumen = volumenTotal > 0 ? volumenActual / volumenTotal : 1;
            const participacionPeso = pesoTotal > 0 ? pesoActual / pesoTotal : 1;

            // Calcular gastos por método
            let gastosPorFOB = 0;
            let gastosPorVolumen = 0;
            let gastosPorPeso = 0;
            let gastosNoProrratear = 0;

            for (const gasto of gastosVarios) {
                let montoARS = parseFloat(gasto.monto_ars) || 0;
                if (montoARS === 0 && gasto.monto) {
                    const montoOriginal = parseFloat(gasto.monto) || 0;
                    const monedaGasto = (gasto.moneda || 'USD').toUpperCase();
                    let tcGasto = tc_usd;
                    if (monedaGasto === 'EUR') tcGasto = tc_eur;
                    else if (monedaGasto === 'GBP') tcGasto = tc_gbp;
                    montoARS = montoOriginal * tcGasto;
                }

                const metodo = gasto.metodo_prorrateo || 'no_prorratear';
                if (metodo === 'por_fob') {
                    gastosPorFOB += montoARS;
                } else if (metodo === 'por_volumen') {
                    gastosPorVolumen += montoARS;
                } else if (metodo === 'por_peso') {
                    gastosPorPeso += montoARS;
                } else {
                    gastosNoProrratear += montoARS;
                }
            }

            const totalGastosEstimado = 
                (gastosPorFOB * participacionFOB) + 
                (gastosPorVolumen * participacionVolumen) + 
                (gastosPorPeso * participacionPeso) + 
                gastosNoProrratear;

            return {
                es_consolidado: true,
                proveedor_actual: {
                    nombre: costeo.proveedor,
                    fob: fobProveedorActual,
                    volumen_m3: volumenActual,
                    peso_kg: pesoActual
                },
                otros_proveedores: detalleProveedores,
                totales: {
                    fob: fobTotal,
                    volumen_m3: volumenTotal,
                    peso_kg: pesoTotal
                },
                participaciones: {
                    por_fob: (participacionFOB * 100).toFixed(2) + '%',
                    por_volumen: (participacionVolumen * 100).toFixed(2) + '%',
                    por_peso: (participacionPeso * 100).toFixed(2) + '%'
                },
                gastos_por_metodo: {
                    por_fob: { total: gastosPorFOB.toFixed(2), prorrateado: (gastosPorFOB * participacionFOB).toFixed(2) },
                    por_volumen: { total: gastosPorVolumen.toFixed(2), prorrateado: (gastosPorVolumen * participacionVolumen).toFixed(2) },
                    por_peso: { total: gastosPorPeso.toFixed(2), prorrateado: (gastosPorPeso * participacionPeso).toFixed(2) },
                    no_prorratear: { total: gastosNoProrratear.toFixed(2), prorrateado: gastosNoProrratear.toFixed(2) }
                },
                total_gastos_estimado: totalGastosEstimado.toFixed(2)
            };

        } catch (error) {
            console.error('Error en preview consolidado:', error);
            throw error;
        }
    }
}

module.exports = CalculosService;