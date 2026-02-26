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
    ArticuloMaestro
};