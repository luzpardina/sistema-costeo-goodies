const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Revaluacion = sequelize.define('Revaluacion', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    fecha_revaluacion: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    motivo: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    tc_usd_nuevo: {
        type: DataTypes.DECIMAL(15, 4),
        allowNull: false
    },
    tc_eur_nuevo: {
        type: DataTypes.DECIMAL(15, 4)
    },
    tc_gbp_nuevo: {
        type: DataTypes.DECIMAL(15, 4)
    },
    usuario_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    cantidad_articulos: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'revaluaciones',
    timestamps: true,
    underscored: true
});

module.exports = Revaluacion;