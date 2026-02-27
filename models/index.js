const Usuario = require('./Usuario');
const Empresa = require('./Empresa');
const Costeo = require('./Costeo');
const ArticuloCosteo = require('./ArticuloCosteo');
const GastosAduana = require('./GastosAduana');
const GastosVarios = require('./GastosVarios');
const Revaluacion = require('./Revaluacion');
const RevaluacionArticulo = require('./RevaluacionArticulo');
const ConsolidadoProveedor = require('./ConsolidadoProveedor');
const ArticuloMaestro = require('./ArticuloMaestro');
const CatalogoArticulo = require('./CatalogoArticulo');

// === NUEVOS MODELOS ===
const ListaPrecio = require('./ListaPrecio');
const AcuerdoComercial = require('./AcuerdoComercial');
const PrecioPVP = require('./PrecioPVP');
const PrecioActual = require('./PrecioActual');
const ValuacionInventario = require('./ValuacionInventario');
const ValuacionDetalle = require('./ValuacionDetalle');

// =============================================
// RELACIONES EXISTENTES (sin cambios)
// =============================================

// Relaciones Usuario - Empresa
Empresa.hasMany(Usuario, {
    foreignKey: 'empresa_id',
    as: 'usuarios'
});
Usuario.belongsTo(Empresa, {
    foreignKey: 'empresa_id',
    as: 'empresa'
});
// Relaciones Usuario - Costeo
Usuario.hasMany(Costeo, {
    foreignKey: 'usuario_id',
    as: 'costeos'
});
Costeo.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario'
});
// Relaciones Empresa - Costeo
Empresa.hasMany(Costeo, {
    foreignKey: 'empresa_id',
    as: 'costeos'
});
Costeo.belongsTo(Empresa, {
    foreignKey: 'empresa_id',
    as: 'empresa'
});
// Relaciones Costeo - ArticuloCosteo
Costeo.hasMany(ArticuloCosteo, {
    foreignKey: 'costeo_id',
    as: 'articulos',
    onDelete: 'CASCADE'
});
ArticuloCosteo.belongsTo(Costeo, {
    foreignKey: 'costeo_id',
    as: 'costeo'
});
// Relaciones Costeo - GastosAduana (1 a 1)
Costeo.hasOne(GastosAduana, {
    foreignKey: 'costeo_id',
    as: 'gastos_aduana',
    onDelete: 'CASCADE'
});
GastosAduana.belongsTo(Costeo, {
    foreignKey: 'costeo_id',
    as: 'costeo'
});
// Relaciones Costeo - GastosVarios
Costeo.hasMany(GastosVarios, {
    foreignKey: 'costeo_id',
    as: 'gastos_varios',
    onDelete: 'CASCADE'
});
GastosVarios.belongsTo(Costeo, {
    foreignKey: 'costeo_id',
    as: 'costeo'
});
// Relaciones Usuario - Revaluacion
Usuario.hasMany(Revaluacion, {
    foreignKey: 'usuario_id',
    as: 'revaluaciones'
});
Revaluacion.belongsTo(Usuario, {
    foreignKey: 'usuario_id',
    as: 'usuario'
});
// Relaciones Revaluacion - RevaluacionArticulo
Revaluacion.hasMany(RevaluacionArticulo, {
    foreignKey: 'revaluacion_id',
    as: 'articulos',
    onDelete: 'CASCADE'
});
RevaluacionArticulo.belongsTo(Revaluacion, {
    foreignKey: 'revaluacion_id',
    as: 'revaluacion'
});
// Relaciones Costeo - ConsolidadoProveedor
Costeo.hasMany(ConsolidadoProveedor, {
    foreignKey: 'costeo_id',
    as: 'proveedores_consolidado',
    onDelete: 'CASCADE'
});
ConsolidadoProveedor.belongsTo(Costeo, {
    foreignKey: 'costeo_id',
    as: 'costeo'
});

// =============================================
// NUEVAS RELACIONES - MÓDULO COMERCIAL
// =============================================

// ListaPrecio - AcuerdoComercial
ListaPrecio.hasMany(AcuerdoComercial, {
    foreignKey: 'lista_id',
    as: 'acuerdos',
    onDelete: 'CASCADE'
});
AcuerdoComercial.belongsTo(ListaPrecio, {
    foreignKey: 'lista_id',
    as: 'lista'
});

// ListaPrecio - PrecioActual
ListaPrecio.hasMany(PrecioActual, {
    foreignKey: 'lista_id',
    as: 'precios_actuales',
    onDelete: 'CASCADE'
});
PrecioActual.belongsTo(ListaPrecio, {
    foreignKey: 'lista_id',
    as: 'lista'
});

// =============================================
// NUEVAS RELACIONES - MÓDULO CONTABLE
// =============================================

// ValuacionInventario - ValuacionDetalle
ValuacionInventario.hasMany(ValuacionDetalle, {
    foreignKey: 'valuacion_id',
    as: 'detalles',
    onDelete: 'CASCADE'
});
ValuacionDetalle.belongsTo(ValuacionInventario, {
    foreignKey: 'valuacion_id',
    as: 'valuacion'
});

// Revaluacion - ValuacionInventario (opcional)
Revaluacion.hasMany(ValuacionInventario, {
    foreignKey: 'revaluacion_id',
    as: 'valuaciones'
});
ValuacionInventario.belongsTo(Revaluacion, {
    foreignKey: 'revaluacion_id',
    as: 'revaluacion'
});

module.exports = {
    Usuario,
    Empresa,
    Costeo,
    ArticuloCosteo,
    GastosAduana,
    GastosVarios,
    Revaluacion,
    RevaluacionArticulo,
    ConsolidadoProveedor,
    ArticuloMaestro,
    CatalogoArticulo,
    // Nuevos
    ListaPrecio,
    AcuerdoComercial,
    PrecioPVP,
    PrecioActual,
    ValuacionInventario,
    ValuacionDetalle
};
