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
    proveedor: {
        type: DataTypes.STRING(255)
    },
    moneda: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    monto: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    monto_ars: {
        type: DataTypes.DECIMAL(15, 2)
    }
}, {
    tableName: 'gastos_varios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = GastosVarios;