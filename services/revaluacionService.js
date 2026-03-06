const { Costeo, ArticuloCosteo, GastosVarios, Revaluacion, RevaluacionArticulo, CatalogoArticulo } = require('../models');
const { Op } = require('sequelize');

class RevaluacionService {

    static async generarRevaluacion(usuarioId, costeoIds, tcNuevoUSD, tcNuevoEUR, tcNuevoGBP, motivo, soloContable = false, filtros = {}) {
        
        console.log('Revaluación - Filtros recibidos:', JSON.stringify(filtros));
        
        // 1. Obtener artículos a revaluar
        let whereCondition = { 
            estado: 'calculado',
            fecha_despacho: { [Op.ne]: null }
        };
        
        // Si hay costeos seleccionados, filtrar por ellos
        if (costeoIds && costeoIds.length > 0) {
            whereCondition.id = { [Op.in]: costeoIds };
        }

        // Si hay filtro de proveedor, filtrar costeos por proveedor
        if (filtros.proveedor) {
            whereCondition.proveedor = { [Op.iLike]: filtros.proveedor.trim() };
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
            throw new Error('No se encontraron costeos para revaluar' + (filtros.proveedor ? ' (proveedor: ' + filtros.proveedor + ')' : ''));
        }

        // Si hay filtros de fábrica o marca, necesitamos cruzar con el catálogo
        let filtroFabrica = filtros.fabrica ? filtros.fabrica.trim() : null;
        let filtroMarca = filtros.marca ? filtros.marca.trim() : null;
        let catalogoMap = {};
        if (filtroFabrica || filtroMarca) {
            const catalogoWhere = {};
            if (filtroFabrica) catalogoWhere.empresa_fabrica = { [Op.iLike]: filtros.fabrica.trim() };
            if (filtroMarca) catalogoWhere.marca = { [Op.iLike]: filtros.marca.trim() };
            let catalogoArts = await CatalogoArticulo.findAll({ where: catalogoWhere, attributes: ['codigo_goodies', 'nombre', 'marca'] });
            
            // Fallback: si no encontró por marca exacta, buscar en nombre del artículo
            if (catalogoArts.length === 0 && filtroMarca) {
                catalogoArts = await CatalogoArticulo.findAll({ 
                    where: { nombre: { [Op.iLike]: '%' + filtros.marca.trim() + '%' } },
                    attributes: ['codigo_goodies', 'nombre', 'marca']
                });
            }
            
            catalogoArts.forEach(a => { catalogoMap[a.codigo_goodies.toUpperCase()] = true; });
            
            if (Object.keys(catalogoMap).length === 0) {
                throw new Error('No se encontraron artículos en el catálogo con ' + 
                    (filtroMarca ? 'marca "' + filtros.marca + '"' : '') +
                    (filtroFabrica ? ' fábrica "' + filtros.fabrica + '"' : ''));
            }
            
            console.log('Filtro revaluación: ' + Object.keys(catalogoMap).length + ' artículos matchean ' +
                (filtroMarca ? 'marca/nombre "' + filtros.marca + '"' : '') +
                (filtroFabrica ? ' fábrica "' + filtros.fabrica + '"' : ''));
        }
        
        // 2. Agrupar por código de artículo y quedarse con el último (por fecha_despacho)
        const articulosPorCodigo = {};
        
        for (const costeo of costeos) {
            for (const art of costeo.articulos) {
                const codigo = art.codigo_goodies || 'SIN_CODIGO';
                
                // Aplicar filtro de fábrica/marca si está activo
                if ((filtroFabrica || filtroMarca) && !catalogoMap[codigo.toUpperCase()]) {
                    continue; // Skip artículos que no coinciden con el filtro
                }
                
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

        if (Object.keys(articulosPorCodigo).length === 0) {
            throw new Error('No se encontraron artículos que coincidan con los filtros aplicados');
        }

        console.log('Revaluación - Artículos después de filtros:', Object.keys(articulosPorCodigo).length, 
            'de', costeos.reduce((sum, c) => sum + c.articulos.length, 0), 'totales');
        
        // Build motivo with filter info
        let motivoCompleto = motivo;
        const filtrosActivos = [];
        if (filtros.proveedor) filtrosActivos.push('Prov: ' + filtros.proveedor);
        if (filtros.fabrica) filtrosActivos.push('Fáb: ' + filtros.fabrica);
        if (filtros.marca) filtrosActivos.push('Marca: ' + filtros.marca);
        if (filtrosActivos.length > 0) {
            motivoCompleto += ' [Filtro: ' + filtrosActivos.join(', ') + ']';
        }
        
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
            motivo: motivoCompleto,
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
                // Si se activó "solo contable", excluir gastos no contables
                if (soloContable && g.no_contable) continue;
                
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
            motivo: motivoCompleto,
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
