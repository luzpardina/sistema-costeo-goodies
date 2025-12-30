const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GastosAduana = sequelize.define('GastosAduana', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    despachante: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    gestion_senasa: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    gestion_anmat: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    transporte_internacional: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    gastos_origen: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    terminal: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    maritima_agencia: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    bancarios: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    gestor: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    transporte_nacional: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    custodia: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    sim: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    },
    total_gastos_ars: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0
    }
}, {
    tableName: 'gastos_aduana',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = GastosAduana;