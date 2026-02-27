const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ListaPrecio = sequelize.define('ListaPrecio', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    pct_logistico: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    pct_iibb: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    pct_financiero: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    pct_comision: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    pct_margen_cliente: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    activa: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'listas_precios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ListaPrecio;
