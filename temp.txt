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

            const fleteUSD = parseFloat(costeo.flete_usd) || 0;
            const seguroUSD = parseFloat(costeo.seguro_usd) || 0;
            let gastosBaseAduanaTotal = (fleteUSD + seguroUSD) * tcPrincipal;

            if (esConsolidado) {
                gastosBaseAduanaTotal = gastosBaseAduanaTotal * participacionPorVolumen;
            }

            const gastosPorGrupo = {};
            let totalGastosVariosPesos = 0;

            for (const gasto of gastosVarios) {
                let montoOriginalARS = parseFloat(gasto.monto_ars) || 0;

                if (montoOriginalARS === 0 && gasto.monto) {
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

                    montoOriginalARS = montoOriginal * tcGasto;
                    if (recargo > 0) {
                        montoOriginalARS = montoOriginalARS * (1 + recargo / 100);
                    }
                }

                let montoProrrateado = montoOriginalARS;

                if (esConsolidado) {
                    const metodo = gasto.metodo_prorrateo || 'por_fob';
                    
                    if (metodo === 'por_fob') {
                        montoProrrateado = montoOriginalARS * participacionPorFOB;
                    } else if (metodo === 'por_volumen') {
                        montoProrrateado = montoOriginalARS * participacionPorVolumen;
                    } else if (metodo === 'por_peso') {
                        montoProrrateado = montoOriginalARS * participacionPorPeso;
                    }
                }

                await gasto.update({ 
                    monto_ars: montoOriginalARS,
                    monto_prorrateado: montoProrrateado 
                });

                totalGastosVariosPesos += montoProrrateado;

                const grupoGasto = gasto.grupo || '';
                if (!gastosPorGrupo[grupoGasto]) {
                    gastosPorGrupo[grupoGasto] = 0;
                }
                gastosPorGrupo[grupoGasto] += montoProrrateado;
            }

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
                    costo_unitario_neto: costoUnitarioNetoARS,
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

            return {
                exito: true,
                costeo_id: costeoId,
                es_consolidado: esConsolidado,
                resumen: {
                    fob_total_pesos: fobTotalPesos.toFixed(2),
                    gastos_varios_ars: totalGastosVariosPesos.toFixed(2),
                    costo_total_neto_ars: totalCostoNetoARS.toFixed(2),
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

    static async previewConsolidado(costeoId) {
        try {
            const costeo = await Costeo.findByPk(costeoId, {
                include: [
                    { model: ArticuloCosteo, as: 'articulos' },
                    { model: ConsolidadoProveedor, as: 'proveedores_consolidado' }
                ]
            });

            if (!costeo) {
                throw new Error('Costeo no encontrado');
            }

            if (!costeo.es_consolidado) {
                return { es_consolidado: false };
            }

            const articulos = costeo.articulos || [];
            const proveedoresConsolidado = costeo.proveedores_consolidado || [];

            const fobActual = articulos.reduce((sum, art) => sum + (parseFloat(art.importe_total_origen) || 0), 0);
            const volActual = parseFloat(costeo.volumen_m3) || 0;
            const pesoActual = parseFloat(costeo.peso_kg) || 0;

            let fobTotal = fobActual;
            let volTotal = volActual;
            let pesoTotal = pesoActual;

            const proveedores = [{
                nombre: costeo.proveedor + ' (ACTUAL)',
                fob: fobActual,
                volumen_m3: volActual,
                peso_kg: pesoActual
            }];

            for (const p of proveedoresConsolidado) {
                const fob = parseFloat(p.fob_total) || 0;
                const vol = parseFloat(p.volumen_m3) || 0;
                const peso = parseFloat(p.peso_kg) || 0;
                fobTotal += fob;
                volTotal += vol;
                pesoTotal += peso;
                proveedores.push({
                    nombre: p.nombre_proveedor,
                    fob: fob,
                    volumen_m3: vol,
                    peso_kg: peso
                });
            }

            for (const p of proveedores) {
                p.pct_fob = fobTotal > 0 ? ((p.fob / fobTotal) * 100).toFixed(2) : '0.00';
                p.pct_volumen = volTotal > 0 ? ((p.volumen_m3 / volTotal) * 100).toFixed(2) : '0.00';
                p.pct_peso = pesoTotal > 0 ? ((p.peso_kg / pesoTotal) * 100).toFixed(2) : '0.00';
            }

            return {
                es_consolidado: true,
                proveedores: proveedores,
                totales: { fob: fobTotal, volumen_m3: volTotal, peso_kg: pesoTotal }
            };

        } catch (error) {
            console.error('Error en preview:', error);
            throw error;
        }
    }
}

module.exports = CalculosService;