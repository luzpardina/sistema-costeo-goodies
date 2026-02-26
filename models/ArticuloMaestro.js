const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ArticuloMaestro = sequelize.define('ArticuloMaestro', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    codigo: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    nombre: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    proveedor: {
        type: DataTypes.STRING(255)
    },
    marca: {
        type: DataTypes.STRING(255)
    },
    categoria: {
        type: DataTypes.STRING(255)
    },
    tipo: {
        type: DataTypes.STRING(100)
    },
    sociedad: {
        type: DataTypes.STRING(100)
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'articulos_maestro',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ArticuloMaestro;
