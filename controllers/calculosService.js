// calculosService.js - Servicio de cálculos automáticos CORREGIDO

// Función para redondear a 2 decimales hacia arriba
const roundUp = (num) => {
    return Math.ceil(num * 100) / 100;
};

// Función principal que calcula todos los costos de un costeo
const calcularCosteo = async (costeoId, models) => {
    const { Costeo, ArticuloCosteo, GastosAduana, GastosVarios } = models;
    
    try {
        // 1. Obtener el costeo con sus artículos y gastos
        const costeo = await Costeo.findByPk(costeoId);
        if (!costeo) {
            throw new Error('Costeo no encontrado');
        }
        
        const articulos = await ArticuloCosteo.findAll({ where: { costeo_id: costeoId } });
        const gastosAduana = await GastosAduana.findOne({ where: { costeo_id: costeoId } });
        const gastosVarios = await GastosVarios.findAll({ where: { costeo_id: costeoId } });
        
        // 2. Obtener tipo de cambio
        const tcUsd = parseFloat(costeo.tc_usd) || 1;
        const fleteUsd = parseFloat(costeo.flete_usd) || 0;
        const seguroUsd = parseFloat(costeo.seguro_usd) || 0;
        
        // 3. Calcular FOB total (suma de todos los artículos)
        let fobTotalUsd = 0;
        for (const art of articulos) {
            const importeOrigen = parseFloat(art.importe_total_origen) || 0;
            fobTotalUsd += importeOrigen;
        }
        
        // 4. Calcular CIF
        const cifTotalUsd = roundUp(fobTotalUsd + fleteUsd + seguroUsd);
        const cifTotalArs = roundUp(cifTotalUsd * tcUsd);
        
        // 5. Calcular total de gastos varios en ARS
        let totalGastosArs = 0;
        if (gastosAduana) {
            totalGastosArs += parseFloat(gastosAduana.total_gastos_ars) || 0;
        }
        for (const gasto of gastosVarios) {
            totalGastosArs += parseFloat(gasto.monto_ars) || 0;
        }
        
        // 6. Calcular unidades totales
        let unidadesTotales = 0;
        for (const art of articulos) {
            unidadesTotales += parseInt(art.unidades_totales) || 0;
        }
        
        // 7. Variables para totales de tributos
        let derechosTotalArs = 0;
        let estadisticaTotalArs = 0;
        let ivaTotalArs = 0;
        let impuestoInternoTotalArs = 0;
        
        // 8. Calcular cada artículo
        for (const art of articulos) {
            const importeOrigen = parseFloat(art.importe_total_origen) || 0;
            const unidades = parseInt(art.unidades_totales) || 1;
            const derechosPct = parseFloat(art.derechos_porcentaje) || 0;
            const impInterPct = parseFloat(art.impuesto_interno_porcentaje) || 0;
            
            // Participación FOB (% que representa este artículo del total)
            const participacionFob = fobTotalUsd > 0 ? (importeOrigen / fobTotalUsd) : 0;
            
            // FOB del artículo
            const fobTotalArt = importeOrigen;
            const fobUnitarioUsd = roundUp(fobTotalArt / unidades);
            
            // Flete y seguro prorrateados
            const fleteArt = roundUp(fleteUsd * participacionFob);
            const seguroArt = roundUp(seguroUsd * participacionFob);
            
            // CIF del artículo
            const cifTotalArtUsd = roundUp(fobTotalArt + fleteArt + seguroArt);
            const cifUnitarioUsd = roundUp(cifTotalArtUsd / unidades);
            const cifTotalArtArs = roundUp(cifTotalArtUsd * tcUsd);
            const cifUnitarioArs = roundUp(cifTotalArtArs / unidades);
            
            // Derechos de importación
            const derechosTotal = roundUp(cifTotalArtArs * (derechosPct / 100));
            const derechosUnitario = roundUp(derechosTotal / unidades);
            
            // Estadística (3% del CIF) - Solo si NO está exento (derechos > 0)
            const estadisticaTotal = derechosPct > 0 ? roundUp(cifTotalArtArs * 0.03) : 0;
            const estadisticaUnitario = roundUp(estadisticaTotal / unidades);
            
            // Base para IVA = CIF + Derechos + Estadística
            const baseIva = cifTotalArtArs + derechosTotal + estadisticaTotal;
            
            // IVA (21%)
            const ivaTotal = roundUp(baseIva * 0.21);
            const ivaUnitario = roundUp(ivaTotal / unidades);
            
            // Impuesto interno
            const impuestoInternoTotal = roundUp(baseIva * (impInterPct / 100));
            const impuestoInternoUnitario = roundUp(impuestoInternoTotal / unidades);
            
            // Total tributos
            const tributosTotal = roundUp(derechosTotal + estadisticaTotal + ivaTotal + impuestoInternoTotal);
            const tributosUnitario = roundUp(tributosTotal / unidades);
            
            // Gastos prorrateados por participación FOB
            const gastosTotal = roundUp(totalGastosArs * participacionFob);
            const gastosUnitario = roundUp(gastosTotal / unidades);
            
            // Costo total del artículo (SIN IVA ni Imp Interno - son recuperables)
            const costoTotal = roundUp(cifTotalArtArs + derechosTotal + estadisticaTotal + gastosTotal);
            const costoUnitario = roundUp(costoTotal / unidades);
            
            // Acumular totales
            derechosTotalArs += derechosTotal;
            estadisticaTotalArs += estadisticaTotal;
            ivaTotalArs += ivaTotal;
            impuestoInternoTotalArs += impuestoInternoTotal;
            
            // Actualizar artículo en la base de datos
            await art.update({
                fob_unitario_usd: fobUnitarioUsd,
                fob_total_usd: fobTotalArt,
                flete_unitario_usd: roundUp(fleteArt / unidades),
                seguro_unitario_usd: roundUp(seguroArt / unidades),
                cif_unitario_usd: cifUnitarioUsd,
                cif_total_usd: cifTotalArtUsd,
                cif_unitario_ars: cifUnitarioArs,
                cif_total_ars: cifTotalArtArs,
                derechos_unitario_ars: derechosUnitario,
                derechos_total_ars: derechosTotal,
                estadistica_unitario_ars: estadisticaUnitario,
                estadistica_total_ars: estadisticaTotal,
                iva_unitario_ars: ivaUnitario,
                iva_total_ars: ivaTotal,
                impuesto_interno_unitario_ars: impuestoInternoUnitario,
                impuesto_interno_total_ars: impuestoInternoTotal,
                tributos_unitario_ars: tributosUnitario,
                tributos_total_ars: tributosTotal,
                gastos_unitario_ars: gastosUnitario,
                gastos_total_ars: gastosTotal,
                costo_unitario_ars: costoUnitario,
                costo_total_ars: costoTotal,
                costo_final_unitario_ars: roundUp((costoTotal + ivaTotal + impuestoInternoTotal) / unidades),
                costo_final_total_ars: roundUp(costoTotal + ivaTotal + impuestoInternoTotal)
            });
        }
        
        // 9. Calcular costo total del costeo
        const costoTotalCosteo = roundUp(cifTotalArs + derechosTotalArs + estadisticaTotalArs + totalGastosArs);
        const costoUnitarioPromedio = unidadesTotales > 0 ? roundUp(costoTotalCosteo / unidadesTotales) : 0;
        
        // 10. Actualizar el costeo principal
        await costeo.update({
            fob_total_usd: roundUp(fobTotalUsd),
            cif_total_usd: cifTotalUsd,
            cif_total_ars: cifTotalArs,
            derechos_total_ars: roundUp(derechosTotalArs),
            estadistica_ars: roundUp(estadisticaTotalArs),
            iva_ars: roundUp(ivaTotalArs),
            impuesto_interno_ars: roundUp(impuestoInternoTotalArs),
            total_tributos_ars: roundUp(derechosTotalArs + estadisticaTotalArs + ivaTotalArs + impuestoInternoTotalArs),
            total_gastos_ars: roundUp(totalGastosArs),
            costo_total_ars: costoTotalCosteo,
            unidades_totales: unidadesTotales,
            costo_unitario_promedio_ars: costoUnitarioPromedio,
            estado: 'calculado'
        });
        
        return { success: true, mensaje: 'Cálculos completados' };
        
    } catch (error) {
        console.error('Error en calcularCosteo:', error);
        throw error;
    }
};

module.exports = {
    calcularCosteo,
    roundUp
};