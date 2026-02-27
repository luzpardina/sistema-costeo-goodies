const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PrecioActual = sequelize.define('PrecioActual', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    codigo_goodies: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    lista_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    precio_actual: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    fecha_carga: {
        type: DataTypes.DATEONLY
    }
}, {
    tableName: 'precios_actuales',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = PrecioActual;
