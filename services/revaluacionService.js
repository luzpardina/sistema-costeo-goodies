const { Costeo, ArticuloCosteo, GastosVarios, Revaluacion, RevaluacionArticulo } = require('../models');
const { Op } = require('sequelize');

class RevaluacionService {

    static async generarRevaluacion(usuarioId, costeoIds, tcNuevoUSD, tcNuevoEUR, tcNuevoGBP, motivo) {
        
        // 1. Obtener artículos a revaluar
        let whereCondition = { usuario_id: usuarioId };
        
        // Si hay costeos seleccionados, filtrar por ellos
        if (costeoIds && costeoIds.length > 0) {
            whereCondition.id = { [Op.in]: costeoIds };
        }
        
        // Obtener todos los costeos con sus artículos y gastos
        const costeos = await Costeo.findAll({
            where: whereCondition,
            include: [
                { model: ArticuloCosteo, as: 'articulos' },
                { model: GastosVarios, as: 'gastos_varios' }
            ],
            order: [['fecha_despacho', 'DESC']]
        });
        
        if (costeos.length === 0) {
            throw new Error('No se encontraron costeos para revaluar');
        }
        
        // 2. Agrupar por código de artículo y quedarse con el último (por fecha_despacho)
        const articulosPorCodigo = {};
        
        for (const costeo of costeos) {
            for (const art of costeo.articulos) {
                const codigo = art.codigo_goodies || 'SIN_CODIGO';
                
                if (!articulosPorCodigo[codigo]) {
                    articulosPorCodigo[codigo] = {
                        articulo: art,
                        costeo: costeo
                    };
                }
                // Como los costeos vienen ordenados por fecha_despacho DESC,
                // el primero que encontramos es el más reciente
            }
        }
        
        // 3. Crear registro de revaluación
        const revaluacion = await Revaluacion.create({
            fecha_revaluacion: new Date(),
            motivo: motivo,
            tc_usd_nuevo: tcNuevoUSD,
            tc_eur_nuevo: tcNuevoEUR || null,
            tc_gbp_nuevo: tcNuevoGBP || null,
            usuario_id: usuarioId,
            cantidad_articulos: Object.keys(articulosPorCodigo).length
        });
        
        // 4. Calcular y guardar cada artículo revaluado
        const articulosRevaluados = [];
        
        for (const codigo in articulosPorCodigo) {
            const { articulo, costeo } = articulosPorCodigo[codigo];
            
            // Datos originales
            const tcOrigUSD = parseFloat(costeo.tc_usd) || 0;
            const tcOrigEUR = parseFloat(costeo.tc_eur) || 0;
            const tcOrigGBP = parseFloat(costeo.tc_gbp) || 0;
            const monedaPrincipal = (costeo.moneda_principal || 'USD').toUpperCase();
            
            // TC principal original según moneda
            let tcOrigPrincipal = tcOrigUSD;
            if (monedaPrincipal === 'EUR') tcOrigPrincipal = tcOrigEUR;
            if (monedaPrincipal === 'GBP') tcOrigPrincipal = tcOrigGBP;
            
            // TC principal nuevo según moneda
            let tcNuevoPrincipal = tcNuevoUSD;
            if (monedaPrincipal === 'EUR') tcNuevoPrincipal = tcNuevoEUR || tcNuevoUSD;
            if (monedaPrincipal === 'GBP') tcNuevoPrincipal = tcNuevoGBP || tcNuevoUSD;
            
            // Valores del artículo
            const fobProveedorOrigen = parseFloat(articulo.valor_proveedor_origen) || 0;
            const fobIntermediaria = parseFloat(articulo.valor_unitario_origen) || 0;
            const unidades = parseInt(articulo.unidades_totales) || 1;
            const derechosPctRaw = parseFloat(articulo.derechos_porcentaje) || 0;
            const impInternosPctRaw = parseFloat(articulo.impuesto_interno_porcentaje) || 0;
            const derechosPct = derechosPctRaw > 1 ? derechosPctRaw / 100 : derechosPctRaw;
            const impInternosPct = impInternosPctRaw > 1 ? impInternosPctRaw / 100 : impInternosPctRaw;
            
            // Costo neto original
            const costoNetoOriginal = parseFloat(articulo.costo_unitario_neto_ars) || 0;
            
            // Calcular diferencia FOB entre proveedor e intermediaria
            let diferenciaFobPct = null;
            if (fobProveedorOrigen > 0 && fobIntermediaria > 0 && fobProveedorOrigen !== fobIntermediaria) {
                diferenciaFobPct = ((fobIntermediaria - fobProveedorOrigen) / fobProveedorOrigen) * 100;
            }
            
            // ========== RECALCULO COMPLETO CON NUEVOS TC ==========
            
            // FOB en pesos con nuevo TC
            const importeOrigenDivisa = parseFloat(articulo.importe_total_origen) || 0;
            const fobTotalNuevoPesos = importeOrigenDivisa * tcNuevoPrincipal;
            const fobUnitarioNuevoPesos = fobTotalNuevoPesos / unidades;
            
            // Obtener gastos del costeo para calcular participación y prorrateo
            const gastosVarios = costeo.gastos_varios || [];
            
            // Total FOB del costeo original en divisa
            let fobTotalCosteoDivisa = 0;
            for (const a of costeo.articulos) {
                fobTotalCosteoDivisa += parseFloat(a.importe_total_origen) || 0;
            }
            
            // Participación FOB de este artículo
            const participacionFOB = fobTotalCosteoDivisa > 0 ? importeOrigenDivisa / fobTotalCosteoDivisa : 0;
            
            // Flete y seguro en pesos nuevos
            const fleteDivisa = parseFloat(costeo.flete_monto) || 0;
            const seguroDivisa = parseFloat(costeo.seguro_monto) || 0;
            const fleteMoneda = (costeo.flete_moneda || 'USD').toUpperCase();
            const seguroMoneda = (costeo.seguro_moneda || 'USD').toUpperCase();
            
            let tcFlete = tcNuevoUSD;
            if (fleteMoneda === 'EUR') tcFlete = tcNuevoEUR || tcNuevoUSD;
            if (fleteMoneda === 'GBP') tcFlete = tcNuevoGBP || tcNuevoUSD;
            
            let tcSeguro = tcNuevoUSD;
            if (seguroMoneda === 'EUR') tcSeguro = tcNuevoEUR || tcNuevoUSD;
            if (seguroMoneda === 'GBP') tcSeguro = tcNuevoGBP || tcNuevoUSD;
            
            const fleteNuevoPesos = fleteDivisa * tcFlete;
            const seguroNuevoPesos = seguroDivisa * tcSeguro;
            const gastosBaseAduanaNuevo = (fleteNuevoPesos + seguroNuevoPesos) * participacionFOB;
            
            // ANMAT = FOB * 0.5%
            const anmatNuevo = fobTotalNuevoPesos * 0.005;
            
            // Base Aduana
            const baseAduanaNuevo = fobTotalNuevoPesos + gastosBaseAduanaNuevo;
            
            // Derechos
            const derechosNuevo = derechosPct > 0 ? baseAduanaNuevo * derechosPct : 0;
            
            // Estadística
            const estadisticaNuevo = derechosPct > 0 ? baseAduanaNuevo * 0.03 : 0;
            
            // Gastos varios prorrateados con nuevos TC
            let totalGastosVarNuevoPesos = 0;
            for (const g of gastosVarios) {
                // Si es Revaluación Contable, excluir gastos no contables
                if (motivo === 'Revaluación Contable' && g.no_contable) continue;
                
                const montoOrig = parseFloat(g.monto) || 0;
                const monedaG = (g.moneda || 'USD').toUpperCase();
                const recargoG = parseFloat(g.recargo) || 0;
                
                let tcG = tcNuevoUSD;
                if (monedaG === 'EUR') tcG = tcNuevoEUR || tcNuevoUSD;
                if (monedaG === 'GBP') tcG = tcNuevoGBP || tcNuevoUSD;
                if (monedaG === 'ARS') tcG = 1;
                
                let montoGPesos = montoOrig * tcG;
                if (recargoG > 0) montoGPesos = montoGPesos * (1 + recargoG / 100);
                totalGastosVarNuevoPesos += montoGPesos;
            }
            const gastosVarArtNuevo = totalGastosVarNuevoPesos * participacionFOB;
            
            // Costo Neto Revaluado
            const costoTotalNetoNuevo = fobTotalNuevoPesos + anmatNuevo + derechosNuevo + estadisticaNuevo + gastosVarArtNuevo;
            const costoUnitarioNetoNuevo = costoTotalNetoNuevo / unidades;
            
            // Diferencia porcentual
            let diferenciaCostoPct = null;
            if (costoNetoOriginal > 0) {
                diferenciaCostoPct = ((costoUnitarioNetoNuevo - costoNetoOriginal) / costoNetoOriginal) * 100;
            }
            
            // Guardar artículo revaluado
            const artRevaluado = await RevaluacionArticulo.create({
                revaluacion_id: revaluacion.id,
                codigo_goodies: articulo.codigo_goodies,
                nombre: articulo.nombre,
                proveedor: costeo.proveedor,
                nombre_costeo_origen: costeo.nombre_costeo,
                fecha_despacho: costeo.fecha_despacho,
                tc_usd_original: tcOrigUSD,
                tc_eur_original: tcOrigEUR,
                tc_gbp_original: tcOrigGBP,
                fob_proveedor_origen: fobProveedorOrigen,
                fob_intermediaria: fobIntermediaria,
                diferencia_fob_pct: diferenciaFobPct,
                costo_neto_original: costoNetoOriginal,
                tc_usd_nuevo: tcNuevoUSD,
                tc_eur_nuevo: tcNuevoEUR,
                tc_gbp_nuevo: tcNuevoGBP,
                costo_neto_revaluado: costoUnitarioNetoNuevo,
                diferencia_costo_pct: diferenciaCostoPct
            });
            
            articulosRevaluados.push({
                codigo: articulo.codigo_goodies,
                nombre: articulo.nombre,
                costo_neto_original: costoNetoOriginal,
                costo_neto_revaluado: costoUnitarioNetoNuevo,
                diferencia_pct: diferenciaCostoPct
            });
        }
        
        return {
            revaluacion_id: revaluacion.id,
            fecha: revaluacion.fecha_revaluacion,
            motivo: motivo,
            tc_usd_nuevo: tcNuevoUSD,
            tc_eur_nuevo: tcNuevoEUR,
            tc_gbp_nuevo: tcNuevoGBP,
            cantidad_articulos: articulosRevaluados.length,
            articulos: articulosRevaluados
        };
    }
    
    static async obtenerHistorial(usuarioId) {
        const revaluaciones = await Revaluacion.findAll({
            where: { usuario_id: usuarioId },
            order: [['fecha_revaluacion', 'DESC']]
        });
        return revaluaciones;
    }
    
    static async obtenerDetalle(revaluacionId) {
        const revaluacion = await Revaluacion.findByPk(revaluacionId, {
            include: [{ model: RevaluacionArticulo, as: 'articulos' }]
        });
        return revaluacion;
    }
}

module.exports = RevaluacionService;