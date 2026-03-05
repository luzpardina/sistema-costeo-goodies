const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CatalogoLog = sequelize.define('CatalogoLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    codigo_goodies: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    accion: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'crear | actualizar | desactivar | activar'
    },
    campo: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    valor_anterior: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    valor_nuevo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    origen: {
        type: DataTypes.STRING(30),
        defaultValue: 'importacion',
        comment: 'importacion | costeo_sync | manual'
    },
    usuario_id: {
        type: DataTypes.UUID,
        allowNull: true
    }
}, {
    tableName: 'catalogo_log',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = CatalogoLog;
