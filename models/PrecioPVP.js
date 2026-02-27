const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PrecioPVP = sequelize.define('PrecioPVP', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    codigo_goodies: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    pvp_sugerido: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    fecha_vigencia: {
        type: DataTypes.DATEONLY
    }
}, {
    tableName: 'precios_pvp',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = PrecioPVP;
