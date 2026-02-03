const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Costeo = sequelize.define('Costeo', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombre_costeo: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    proveedor: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    factura_nro: {
        type: DataTypes.STRING(100)
    },
    fecha_factura: {
        type: DataTypes.DATE
    },
    fecha_vencimiento_factura: {
        type: DataTypes.DATE
    },
   fecha_despacho: {
        type: DataTypes.DATE
    },
    nro_despacho: {
        type: DataTypes.STRING(50)
    },
    
    moneda_principal: {
        type: DataTypes.STRING(10),
        allowNull: false
    },
    monto_factura: {
        type: DataTypes.DECIMAL(15, 2)
    },
    tc_usd: {
        type: DataTypes.DECIMAL(10, 4)
    },
    tc_eur: {
        type: DataTypes.DECIMAL(10, 4)
    },
    tc_gbp: {
        type: DataTypes.DECIMAL(10, 4)
    },
    tc_ars: {
        type: DataTypes.DECIMAL(10, 4)
    },
    fob_total_usd: {
        type: DataTypes.DECIMAL(15, 2)
    },
    flete_usd: {
        type: DataTypes.DECIMAL(15, 2)
    },
    seguro_usd: {
        type: DataTypes.DECIMAL(15, 2)
    },
    
fob_moneda: {
        type: DataTypes.STRING(10),
        defaultValue: 'USD'
    },
    fob_monto: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    flete_moneda: {
        type: DataTypes.STRING(10),
        defaultValue: 'USD'
    },
    flete_monto: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    seguro_moneda: {
        type: DataTypes.STRING(10),
        defaultValue: 'USD'
    },
    seguro_monto: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
fob_parte: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    flete_parte: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    seguro_parte: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    empresa_intermediaria: {
        type: DataTypes.STRING(255)
    },
    factura_intermediaria: {
        type: DataTypes.STRING(100)
    },
    fecha_factura_intermediaria: {
        type: DataTypes.DATE
    },
    cif_total_usd: {
        type: DataTypes.DECIMAL(15, 2)
    },
    cif_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    derechos_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    estadistica_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    iva_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    impuesto_interno_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    total_tributos_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    total_gastos_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    costo_total_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    unidades_totales: {
        type: DataTypes.INTEGER
    },
    costo_unitario_promedio_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    estado: {
        type: DataTypes.STRING(50),
        defaultValue: 'borrador'
    },
    es_consolidado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    volumen_m3: {
        type: DataTypes.DECIMAL(10, 2)
    },
    peso_kg: {
        type: DataTypes.DECIMAL(10, 2)
    },
    metodo_prorrateo: {
        type: DataTypes.STRING(20)
    }
}, {
    tableName: 'costeos',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Costeo;