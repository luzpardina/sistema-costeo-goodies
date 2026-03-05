const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ConfigSistema = sequelize.define('ConfigSistema', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    clave: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    valor: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    tipo: {
        type: DataTypes.STRING(20),
        defaultValue: 'porcentaje',
        comment: 'porcentaje | moneda | texto | numero'
    }
}, {
    tableName: 'config_sistema',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ConfigSistema;
