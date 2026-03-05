const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditoriaLog = sequelize.define('AuditoriaLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    usuario_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    usuario_email: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    accion: {
        type: DataTypes.STRING(30),
        allowNull: false,
        comment: 'crear | actualizar | eliminar | calcular | revaluar | login | exportar'
    },
    entidad: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'costeo | articulo | lista | acuerdo | catalogo | valuacion | revaluacion | usuario'
    },
    entidad_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    detalle: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción breve de la acción'
    },
    datos_anteriores: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    datos_nuevos: {
        type: DataTypes.JSONB,
        allowNull: true
    },
    ip: {
        type: DataTypes.STRING(50),
        allowNull: true
    }
}, {
    tableName: 'auditoria_log',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['entidad', 'entidad_id'] },
        { fields: ['usuario_id'] },
        { fields: ['created_at'] },
        { fields: ['accion'] }
    ]
});

module.exports = AuditoriaLog;
