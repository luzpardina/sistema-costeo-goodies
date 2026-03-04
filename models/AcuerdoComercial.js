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
    },
    pct_acuerdo_2: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Solo para desc_oc: segundo escalón (sobre neto del primero)'
    },
    pct_acuerdo_3: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
        comment: 'Solo para desc_oc: tercer escalón (sobre neto del segundo)'
    },
    rubros: {
        type: DataTypes.TEXT,
        defaultValue: ''
    },
    tipo_acuerdo: {
        type: DataTypes.STRING(30),
        defaultValue: 'flat',
        comment: 'flat | desc_oc | nota_credito | factura_cliente'
    },
    orden: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    base_calculo: {
        type: DataTypes.STRING(30),
        defaultValue: 'bruto',
        comment: 'bruto | neto_post_desc_oc | neto_post_nota_credito | neto_post_factura_cliente'
    }
}, {
    tableName: 'acuerdos_comerciales',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = AcuerdoComercial;
