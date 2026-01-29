const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GastosVarios = sequelize.define('GastosVarios', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    descripcion: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    proveedor_gasto: {
        type: DataTypes.STRING(255)
    },
    nro_comprobante: {
        type: DataTypes.STRING(100)
    },
    moneda: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    monto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    recargo: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    monto_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    observaciones: {
        type: DataTypes.STRING(500)
    }
}, {
    tableName: 'gastos_varios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = GastosVarios;