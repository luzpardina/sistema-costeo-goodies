const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ArticuloCosteo = sequelize.define('ArticuloCosteo', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    codigo_goodies: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    codigo_proveedor: {
        type: DataTypes.STRING(50)
    },
    nombre: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    cantidad_cajas: {
        type: DataTypes.DECIMAL(10, 2)
    },
    unidades_por_caja: {
        type: DataTypes.DECIMAL(10, 2)
    },
    unidades_totales: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    moneda_origen: {
        type: DataTypes.STRING(10)
    },
    valor_unitario_origen: {
        type: DataTypes.DECIMAL(15, 4)
    },
    valor_proveedor_origen: {
        type: DataTypes.DECIMAL(15, 4)
    },
    importe_total_origen: {
        type: DataTypes.DECIMAL(15, 2)
    },
    derechos_porcentaje: {
        type: DataTypes.DECIMAL(5, 4)
    },
    impuesto_interno_porcentaje: {
        type: DataTypes.DECIMAL(5, 4)
    },
    // NUEVOS CAMPOS
    aplica_anmat: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    grupo: {
        type: DataTypes.STRING(50),
        defaultValue: ''
    },
    // FOB
    fob_unitario_usd: {
        type: DataTypes.DECIMAL(15, 4)
    },
    fob_total_usd: {
        type: DataTypes.DECIMAL(15, 2)
    },
    fob_unitario_ars: {
        type: DataTypes.DECIMAL(15, 4)
    },
    fob_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Participacion FOB
    participacion_fob: {
        type: DataTypes.DECIMAL(10, 6)
    },
    // ANMAT
    anmat_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Base Aduana
    gastos_base_aduana_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    base_aduana_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Derechos y Estadistica
    derechos_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    estadistica_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Gastos Varios
    gastos_varios_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Costo Neto
    costo_total_neto_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    costo_unitario_neto_ars: {
        type: DataTypes.DECIMAL(15, 4)
    },
    // IVA
    iva_unitario_ars: {
        type: DataTypes.DECIMAL(15, 4)
    },
    iva_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Impuesto Interno
    impuesto_interno_unitario_ars: {
        type: DataTypes.DECIMAL(15, 4)
    },
    impuesto_interno_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Costo Final
    costo_unitario_ars: {
        type: DataTypes.DECIMAL(15, 4)
    },
    costo_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    // Factor Importacion
    factor_importacion: {
        type: DataTypes.DECIMAL(10, 4)
    }
}, {
    tableName: 'articulos_costeo',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ArticuloCosteo;