const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CatalogoArticulo = sequelize.define('CatalogoArticulo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    codigo_goodies: {
        type: DataTypes.STRING(100),
        unique: true,
        allowNull: false
    },
    nombre: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    proveedor: DataTypes.STRING(255),
    marca: DataTypes.STRING(100),
    rubro: DataTypes.STRING(100),
    subrubro: DataTypes.STRING(100),
    codigo_elaborador: DataTypes.STRING(100),
    pos_arancelaria: DataTypes.STRING(30),
    pos_sim: DataTypes.STRING(30),
    derechos_porcentaje: DataTypes.DECIMAL(8, 4),
    estadistica_porcentaje: DataTypes.DECIMAL(8, 4),
    iva_porcentaje: DataTypes.DECIMAL(8, 4),
    imp_interno_porcentaje: DataTypes.DECIMAL(8, 4),
    pais_origen: DataTypes.STRING(100),
    moneda: DataTypes.STRING(10),
    precio_unitario: DataTypes.DECIMAL(15, 4),
    habilitado: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'catalogo_articulos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = CatalogoArticulo;