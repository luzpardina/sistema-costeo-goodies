const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { 
    Costeo, ArticuloCosteo, GastosVarios, CatalogoArticulo,
    Revaluacion, RevaluacionArticulo, ListaPrecio, AcuerdoComercial,
    ValuacionInventario, AuditoriaLog, Usuario
} = require('../models');
const { Op } = require('sequelize');

/**
 * DIAGNÓSTICO COMPLETO DEL SISTEMA
 * Prueba cada subsistema y reporta errores
 * GET /api/diagnostico
 */
router.get('/', auth, async (req, res) => {
    const resultados = [];
    const ok = (nombre, detalle) => resultados.push({ status: '✅', nombre, detalle });
    const fail = (nombre, error) => resultados.push({ status: '❌', nombre, error: String(error) });
    const warn = (nombre, detalle) => resultados.push({ status: '⚠️', nombre, detalle });

    // ============================================
    // 1. BASE DE DATOS - Tablas y datos
    // ============================================
    try {
        const costeos = await Costeo.count();
        const calculados = await Costeo.count({ where: { estado: 'calculado' } });
        const conDespacho = await Costeo.count({ where: { fecha_despacho: { [Op.ne]: null } } });
        ok('DB: Costeos', `Total: ${costeos}, Calculados: ${calculados}, Con despacho: ${conDespacho}`);
    } catch(e) { fail('DB: Costeos', e.message); }

    try {
        const articulos = await ArticuloCosteo.count();
        ok('DB: ArticuloCosteo', `Total: ${articulos}`);
    } catch(e) { fail('DB: ArticuloCosteo', e.message); }

    try {
        const catalogo = await CatalogoArticulo.count();
        const activos = await CatalogoArticulo.count({ where: { habilitado: true, proveedor_activo: true } });
        ok('DB: Catálogo', `Total: ${catalogo}, Activos: ${activos}`);
    } catch(e) { fail('DB: Catálogo', e.message); }

    try {
        const revs = await Revaluacion.count();
        const revsUser = await Revaluacion.count({ where: { usuario_id: req.usuario.id } });
        ok('DB: Revaluaciones', `Total: ${revs}, Del usuario actual: ${revsUser}`);
    } catch(e) { fail('DB: Revaluaciones', e.message); }

    try {
        const revArts = await RevaluacionArticulo.count();
        ok('DB: RevaluacionArticulo', `Total: ${revArts}`);
    } catch(e) { fail('DB: RevaluacionArticulo', e.message); }

    try {
        const listas = await ListaPrecio.count();
        const activas = await ListaPrecio.count({ where: { activa: true } });
        ok('DB: Listas Precios', `Total: ${listas}, Activas: ${activas}`);
    } catch(e) { fail('DB: Listas Precios', e.message); }

    try {
        const acuerdos = await AcuerdoComercial.count();
        ok('DB: Acuerdos Comerciales', `Total: ${acuerdos}`);
    } catch(e) { fail('DB: Acuerdos Comerciales', e.message); }

    // ============================================
    // 2. ÚLTIMO COSTO POR ARTÍCULO
    // ============================================
    try {
        const costeos = await Costeo.findAll({
            where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } },
            include: [{ model: ArticuloCosteo, as: 'articulos', attributes: ['id', 'codigo_goodies', 'nombre', 'costo_unitario_neto_ars'] }],
            order: [['fecha_despacho', 'DESC']],
            limit: 5
        });
        const totalArts = costeos.reduce((sum, c) => sum + c.articulos.length, 0);
        ok('Último Costo: Query', `${costeos.length} costeos recientes, ${totalArts} artículos`);
        
        // Verificar que hay artículos con costo > 0
        let conCosto = 0;
        for (const c of costeos) {
            for (const a of c.articulos) {
                if (parseFloat(a.costo_unitario_neto_ars) > 0) conCosto++;
            }
        }
        if (conCosto > 0) ok('Último Costo: Datos', `${conCosto} artículos con costo > 0`);
        else warn('Último Costo: Datos', 'Ningún artículo con costo > 0 en los 5 últimos costeos');
    } catch(e) { fail('Último Costo', e.message); }

    // ============================================
    // 3. REVALUACIONES - findByPk
    // ============================================
    try {
        const ultRev = await Revaluacion.findAll({
            where: { usuario_id: req.usuario.id },
            order: [['fecha_revaluacion', 'DESC']],
            limit: 3
        });
        
        if (ultRev.length === 0) {
            warn('Revaluaciones: Historial', 'No hay revaluaciones para este usuario');
        } else {
            ok('Revaluaciones: Historial', `${ultRev.length} encontradas. Última: "${ultRev[0].motivo}" (${ultRev[0].id})`);
            
            // TEST CRÍTICO: findByPk con include
            for (const rev of ultRev) {
                try {
                    const found = await Revaluacion.findByPk(rev.id, {
                        include: [{ model: RevaluacionArticulo, as: 'articulos' }]
                    });
                    if (found) {
                        ok(`Revaluación findByPk: ${rev.id.substring(0,8)}...`, 
                           `Encontrada OK. ${found.articulos ? found.articulos.length : 0} artículos. Motivo: "${found.motivo}"`);
                        
                        // Verificar artículos tienen costo_neto_revaluado
                        if (found.articulos && found.articulos.length > 0) {
                            const conCosto = found.articulos.filter(a => parseFloat(a.costo_neto_revaluado) > 0).length;
                            if (conCosto > 0) ok(`Revaluación artículos: ${rev.id.substring(0,8)}`, `${conCosto}/${found.articulos.length} con costo revaluado > 0`);
                            else fail(`Revaluación artículos: ${rev.id.substring(0,8)}`, 'Ningún artículo tiene costo_neto_revaluado > 0');
                        }
                    } else {
                        fail(`Revaluación findByPk: ${rev.id.substring(0,8)}...`, 'findByPk devolvió NULL — esto causa "Revaluación no encontrada"');
                    }
                } catch(e) {
                    fail(`Revaluación findByPk: ${rev.id.substring(0,8)}...`, e.message);
                }
            }
        }
    } catch(e) { fail('Revaluaciones', e.message); }

    // ============================================
    // 4. LISTAS DE PRECIOS + ACUERDOS
    // ============================================
    try {
        const listas = await ListaPrecio.findAll({ order: [['nombre', 'ASC']] });
        const acuerdos = await AcuerdoComercial.findAll();
        
        for (const lista of listas) {
            const acLista = acuerdos.filter(a => a.lista_id === lista.id);
            const totalPct = (parseFloat(lista.pct_margen_goodies) || 0) + (parseFloat(lista.pct_logistico) || 0) +
                (parseFloat(lista.pct_iibb) || 0) + (parseFloat(lista.pct_financiero) || 0) +
                (parseFloat(lista.pct_comision) || 0) + (parseFloat(lista.pct_otro) || 0);
            
            if (totalPct >= 100) {
                fail(`Lista "${lista.nombre}"`, `Suma de % = ${totalPct}% (>= 100% causaría error en gross-up)`);
            } else {
                ok(`Lista "${lista.nombre}"`, `Σ% = ${totalPct.toFixed(1)}%, ${acLista.length} acuerdos, margen_cliente: ${lista.pct_margen_cliente || 0}%, markup_trad: ${lista.pct_markup_tradicional || 0}%`);
            }
        }
    } catch(e) { fail('Listas de Precios', e.message); }

    // ============================================
    // 5. CATÁLOGO - Integridad
    // ============================================
    try {
        const sinMarca = await CatalogoArticulo.count({ where: { habilitado: true, proveedor_activo: true, [Op.or]: [{ marca: null }, { marca: '' }] } });
        const sinRubro = await CatalogoArticulo.count({ where: { habilitado: true, proveedor_activo: true, [Op.or]: [{ rubro: null }, { rubro: '' }] } });
        const sinIva = await CatalogoArticulo.count({ where: { habilitado: true, proveedor_activo: true, [Op.or]: [{ iva_porcentaje: null }, { iva_porcentaje: 0 }] } });
        
        if (sinMarca > 0) warn('Catálogo: Marcas', `${sinMarca} artículos activos sin marca — filtros de marca no los encontrarán`);
        else ok('Catálogo: Marcas', 'Todos los artículos activos tienen marca');
        
        if (sinRubro > 0) warn('Catálogo: Rubros', `${sinRubro} artículos activos sin rubro — acuerdos por rubro no aplicarán`);
        else ok('Catálogo: Rubros', 'Todos los artículos activos tienen rubro');
        
        if (sinIva > 0) warn('Catálogo: IVA', `${sinIva} artículos activos sin IVA — usará 21% por defecto`);
        else ok('Catálogo: IVA', 'Todos los artículos activos tienen IVA definido');
        
        // Test filtro marca PREGO
        const prego = await CatalogoArticulo.findAll({ where: { marca: { [Op.iLike]: 'PREGO' } }, attributes: ['codigo_goodies', 'marca', 'nombre'] });
        const pregoNombre = await CatalogoArticulo.findAll({ where: { nombre: { [Op.iLike]: '%PREGO%' } }, attributes: ['codigo_goodies', 'marca', 'nombre'] });
        ok('Catálogo: Test "PREGO"', `Marca exacta: ${prego.length}, En nombre: ${pregoNombre.length}. Marcas encontradas: [${[...new Set(pregoNombre.map(a => a.marca))].join(', ')}]`);
        
    } catch(e) { fail('Catálogo', e.message); }

    // ============================================
    // 6. CÁLCULO DE PRECIOS - Simulación
    // ============================================
    try {
        // Buscar un artículo con costo para simular
        const artTest = await ArticuloCosteo.findOne({
            include: [{ model: Costeo, as: 'costeo', where: { estado: 'calculado', fecha_despacho: { [Op.ne]: null } } }],
            order: [[{ model: Costeo, as: 'costeo' }, 'fecha_despacho', 'DESC']]
        });
        
        if (artTest) {
            const costo = parseFloat(artTest.costo_unitario_neto_ars) || 0;
            ok('Calc Precios: Artículo test', `${artTest.codigo_goodies} (${artTest.nombre}), costo: $${costo.toFixed(2)}`);
            
            if (costo > 0) {
                // Simular gross-up con 40% total
                const precioNeto = costo / (1 - 40/100);
                ok('Calc Precios: Gross-up test', `Costo $${costo.toFixed(2)} con 40% → Precio Neto $${precioNeto.toFixed(2)}`);
            }
        } else {
            warn('Calc Precios', 'No hay artículos con costo para simular');
        }
    } catch(e) { fail('Calc Precios', e.message); }

    // ============================================
    // 7. RESUMEN FINAL
    // ============================================
    const errores = resultados.filter(r => r.status === '❌').length;
    const warnings = resultados.filter(r => r.status === '⚠️').length;
    const oks = resultados.filter(r => r.status === '✅').length;

    res.json({
        resumen: {
            total_checks: resultados.length,
            ok: oks,
            warnings: warnings,
            errores: errores,
            estado: errores === 0 ? '✅ SISTEMA OK' : `❌ ${errores} ERRORES ENCONTRADOS`
        },
        detalle: resultados,
        timestamp: new Date().toISOString(),
        usuario: req.usuario.email
    });
});

module.exports = router;
