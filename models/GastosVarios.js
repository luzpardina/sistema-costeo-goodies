const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GastosVarios = sequelize.define('GastosVarios', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    costeo_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.STRING(255)
    },
    proveedor_gasto: {
        type: DataTypes.STRING(255)
    },
    nro_comprobante: {
        type: DataTypes.STRING(100)
    },
    moneda: {
        type: DataTypes.STRING(10),
        defaultValue: 'USD'
    },
    monto: {
        type: DataTypes.DECIMAL(15, 2)
    },
    recargo: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    },
    monto_ars: {
        type: DataTypes.DECIMAL(15, 2)
    },
    monto_prorrateado: {
        type: DataTypes.DECIMAL(15, 2)
    },
    grupo: {
        type: DataTypes.STRING(50),
        defaultValue: ''
    },
    prorratear_consolidado: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    metodo_prorrateo: {
        type: DataTypes.STRING(20),
        defaultValue: 'por_fob'
    },
    observaciones: {
        type: DataTypes.TEXT
    },
    no_contable: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'gastos_varios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = GastosVarios;