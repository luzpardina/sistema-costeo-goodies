const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AcuerdoComercial = sequelize.define('AcuerdoComercial', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    lista_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    categoria: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    pct_acuerdo: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
    }
}, {
    tableName: 'acuerdos_comerciales',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = AcuerdoComercial;
