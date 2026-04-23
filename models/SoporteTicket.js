const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Sistema interno de tickets de soporte técnico.
// Cualquier usuario del sistema puede crear tickets desde el botón flotante;
// solo admins los ven todos y pueden responder/cerrarlos.
const SoporteTicket = sequelize.define('SoporteTicket', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    usuario_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    // Snapshot del email al momento de crear el ticket — útil si el usuario
    // cambia o se borra después (el histórico se mantiene).
    usuario_email: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    usuario_nombre: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    tipo: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'consulta',
        validate: {
            isIn: [['bug', 'sugerencia', 'consulta', 'mejora']]
        }
    },
    titulo: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // Metadata capturada automáticamente al abrir el ticket, ayuda al
    // debugging sin pedirle al usuario que lo especifique.
    url_contexto: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true
    },
    // Estados: abierto → en_progreso → resuelto/cerrado
    estado: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'abierto',
        validate: {
            isIn: [['abierto', 'en_progreso', 'resuelto', 'cerrado']]
        }
    },
    prioridad: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'media',
        validate: {
            isIn: [['baja', 'media', 'alta', 'critica']]
        }
    },
    // Respuesta del admin. Historial simple: un solo campo texto que el
    // admin puede editar. Si se necesita multi-mensaje, se hace en v2.
    respuesta_admin: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    respondido_por: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    respondido_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'soporte_tickets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['usuario_id'] },
        { fields: ['estado'] },
        { fields: ['tipo'] },
        { fields: ['created_at'] }
    ]
});

module.exports = SoporteTicket;
