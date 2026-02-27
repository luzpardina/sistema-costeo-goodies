const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ValuacionInventario = sequelize.define('ValuacionInventario', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    fecha_carga: {
        type: DataTypes.DATEONLY
    },
    revaluacion_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    total_contable: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    total_revaluado: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    diferencia: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    cantidad_articulos: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    art_dif_positiva: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    art_dif_negativa: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    usuario_id: {
        type: DataTypes.UUID
    }
}, {
    tableName: 'valuaciones_inventario',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ValuacionInventario;
