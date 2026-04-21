const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const Usuario = sequelize.define('Usuario', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    rol: {
        type: DataTypes.STRING(50),
        allowNull: false,
        validate: {
            isIn: [['admin', 'comex', 'comercial', 'contable', 'visualizador']]
        }
    },
    activo: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'usuarios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        beforeCreate: async (usuario) => {
            if (usuario.password_hash) {
                const salt = await bcrypt.genSalt(10);
                usuario.password_hash = await bcrypt.hash(usuario.password_hash, salt);
            }
        }
    }
});

// Método para comparar contraseñas
Usuario.prototype.compararPassword = async function(password) {
    return await bcrypt.compare(password, this.password_hash);
};

module.exports = Usuario;