const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ValuacionDetalle = sequelize.define('ValuacionDetalle', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    valuacion_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    codigo_goodies: {
        type: DataTypes.STRING(100)
    },
    descripcion: {
        type: DataTypes.STRING(500)
    },
    cantidad: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    costo_unit_contable: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    costo_total_contable: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    costo_unit_revaluado: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    costo_total_revaluado: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    diferencia_unit: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    diferencia_total: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    diferencia_pct: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    }
}, {
    tableName: 'valuacion_detalle',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ValuacionDetalle;
