const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ConsolidadoProveedor = sequelize.define('ConsolidadoProveedor', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    costeo_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    nombre_proveedor: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    fob_total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    moneda: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'USD'
    },
    volumen_m3: {
        type: DataTypes.DECIMAL(10, 2)
    },
    peso_kg: {
        type: DataTypes.DECIMAL(10, 2)
    }
}, {
    tableName: 'consolidado_proveedores',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ConsolidadoProveedor;