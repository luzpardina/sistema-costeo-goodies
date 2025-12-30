const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RevaluacionArticulo = sequelize.define('RevaluacionArticulo', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    revaluacion_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    codigo_goodies: {
        type: DataTypes.STRING(50)
    },
    nombre: {
        type: DataTypes.STRING(255)
    },
    proveedor: {
        type: DataTypes.STRING(255)
    },
    nombre_costeo_origen: {
        type: DataTypes.STRING(255)
    },
    fecha_despacho: {
        type: DataTypes.DATE
    },
    // Valores originales
    tc_usd_original: {
        type: DataTypes.DECIMAL(15, 4)
    },
    tc_eur_original: {
        type: DataTypes.DECIMAL(15, 4)
    },
    tc_gbp_original: {
        type: DataTypes.DECIMAL(15, 4)
    },
    fob_proveedor_origen: {
        type: DataTypes.DECIMAL(15, 4)
    },
    fob_intermediaria: {
        type: DataTypes.DECIMAL(15, 4)
    },
    diferencia_fob_pct: {
        type: DataTypes.DECIMAL(10, 4)
    },
    costo_neto_original: {
        type: DataTypes.DECIMAL(15, 4)
    },
    // Valores revaluados
    tc_usd_nuevo: {
        type: DataTypes.DECIMAL(15, 4)
    },
    tc_eur_nuevo: {
        type: DataTypes.DECIMAL(15, 4)
    },
    tc_gbp_nuevo: {
        type: DataTypes.DECIMAL(15, 4)
    },
    costo_neto_revaluado: {
        type: DataTypes.DECIMAL(15, 4)
    },
    diferencia_costo_pct: {
        type: DataTypes.DECIMAL(10, 4)
    }
}, {
    tableName: 'revaluacion_articulos',
    timestamps: true,
    underscored: true
});

module.exports = RevaluacionArticulo;