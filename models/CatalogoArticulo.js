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
    empresa_fabrica: DataTypes.STRING(255),
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
    unidades_por_caja: DataTypes.DECIMAL(12, 2),
    ultimo_valor_origen: DataTypes.DECIMAL(15, 4),
    ultimo_valor_fabrica: DataTypes.DECIMAL(15, 4),
    fecha_ultimo_precio: DataTypes.DATE,
    habilitado: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    proveedor_activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    empresa_fabrica_activa: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    // Datos físicos del artículo (para ML y logística)
    peso_unitario_kg: {
        type: DataTypes.DECIMAL(8, 3),
        allowNull: true,
        comment: 'Peso de 1 unidad en kg'
    },
    alto_cm: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true
    },
    largo_cm: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true
    },
    ancho_cm: {
        type: DataTypes.DECIMAL(8, 2),
        allowNull: true
    },
    // Datos específicos para ML
    es_esencial_ml: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Producto "Esencial" en Full Súper ML'
    },
    unidades_por_caja_ml: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        comment: 'Cuántas unidades van en un envío típico de ML'
    },
    tipo_caja_ml: {
        type: DataTypes.STRING(20),
        defaultValue: 'mediana',
        comment: 'chica | mediana | grande | custom'
    }
}, {
    tableName: 'catalogo_articulos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = CatalogoArticulo;
