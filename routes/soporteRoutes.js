const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { SoporteTicket, Usuario } = require('../models');
const { registrarAuditoria } = require('../utils/auditoria');

// Crear ticket (cualquier usuario autenticado)
router.post('/', auth, async (req, res) => {
    try {
        const { tipo, titulo, descripcion, url_contexto, user_agent, prioridad } = req.body;

        // Validación mínima
        if (!titulo || !titulo.trim()) {
            return res.status(400).json({ error: 'El título es obligatorio' });
        }
        if (!descripcion || !descripcion.trim()) {
            return res.status(400).json({ error: 'La descripción es obligatoria' });
        }
        if (titulo.length > 200) {
            return res.status(400).json({ error: 'El título es demasiado largo (máximo 200 caracteres)' });
        }

        // Cargar datos del usuario para el snapshot
        const usuario = await Usuario.findByPk(req.usuario.id);
        if (!usuario) {
            return res.status(401).json({ error: 'Usuario inválido' });
        }

        const ticket = await SoporteTicket.create({
            usuario_id: req.usuario.id,
            usuario_email: usuario.email,
            usuario_nombre: usuario.nombre,
            tipo: tipo || 'consulta',
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
            url_contexto: url_contexto || null,
            user_agent: user_agent || null,
            prioridad: prioridad || 'media',
            estado: 'abierto'
        });

        await registrarAuditoria(req, 'crear', 'soporte_ticket', ticket.id,
            `Ticket creado: ${tipo} - ${titulo}`);

        res.json({
            mensaje: 'Ticket creado exitosamente',
            ticket: {
                id: ticket.id,
                numero: ticket.id.slice(0, 8),  // primeros 8 chars del UUID como "número" visible
                estado: ticket.estado,
                created_at: ticket.created_at
            }
        });
    } catch (error) {
        console.error('Error creando ticket:', error);
        res.status(500).json({ error: 'Error al crear el ticket', detalles: error.message });
    }
});

// Listar tickets
// - Admin ve todos
// - Otros usuarios ven solo los suyos
// Filtros opcionales: ?estado=abierto&tipo=bug
router.get('/', auth, async (req, res) => {
    try {
        const where = {};
        if (req.usuario.rol !== 'admin') {
            where.usuario_id = req.usuario.id;
        }
        if (req.query.estado) where.estado = req.query.estado;
        if (req.query.tipo) where.tipo = req.query.tipo;

        const tickets = await SoporteTicket.findAll({
            where,
            order: [['created_at', 'DESC']],
            limit: 500
        });

        res.json({
            total: tickets.length,
            tickets: tickets.map(t => ({
                id: t.id,
                numero: t.id.slice(0, 8),
                usuario_email: t.usuario_email,
                usuario_nombre: t.usuario_nombre,
                tipo: t.tipo,
                titulo: t.titulo,
                descripcion: t.descripcion,
                url_contexto: t.url_contexto,
                estado: t.estado,
                prioridad: t.prioridad,
                respuesta_admin: t.respuesta_admin,
                respondido_por: t.respondido_por,
                respondido_at: t.respondido_at,
                created_at: t.created_at,
                updated_at: t.updated_at
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ver un ticket puntual (propio o cualquier si admin)
router.get('/:id', auth, async (req, res) => {
    try {
        const ticket = await SoporteTicket.findByPk(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

        // Permiso: el creador o un admin
        if (ticket.usuario_id !== req.usuario.id && req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'No tenés acceso a este ticket' });
        }

        res.json({ ticket });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar ticket (solo admin, o el creador puede agregar info)
router.put('/:id', auth, async (req, res) => {
    try {
        const ticket = await SoporteTicket.findByPk(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

        const esAdmin = req.usuario.rol === 'admin';
        const esCreador = ticket.usuario_id === req.usuario.id;

        if (!esAdmin && !esCreador) {
            return res.status(403).json({ error: 'No tenés permiso para modificar este ticket' });
        }

        const updates = {};

        // Solo el admin puede cambiar estado, prioridad, respuesta
        if (esAdmin) {
            if (req.body.estado) {
                if (!['abierto', 'en_progreso', 'resuelto', 'cerrado'].includes(req.body.estado)) {
                    return res.status(400).json({ error: 'Estado inválido' });
                }
                updates.estado = req.body.estado;
            }
            if (req.body.prioridad) {
                if (!['baja', 'media', 'alta', 'critica'].includes(req.body.prioridad)) {
                    return res.status(400).json({ error: 'Prioridad inválida' });
                }
                updates.prioridad = req.body.prioridad;
            }
            if (req.body.respuesta_admin !== undefined) {
                updates.respuesta_admin = req.body.respuesta_admin;
                if (req.body.respuesta_admin) {
                    // Snapshot de quién respondió y cuándo
                    const userAdmin = await Usuario.findByPk(req.usuario.id);
                    updates.respondido_por = userAdmin ? userAdmin.email : req.usuario.email;
                    updates.respondido_at = new Date();
                }
            }
        }

        // El creador puede agregar info adicional a la descripción (append)
        if (esCreador && !esAdmin && req.body.descripcion_adicional) {
            updates.descripcion = ticket.descripcion + '\n\n---\n[Agregado ' +
                new Date().toLocaleString('es-AR') + ']\n' + req.body.descripcion_adicional;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No hay cambios para aplicar' });
        }

        await ticket.update(updates);
        await registrarAuditoria(req, 'actualizar', 'soporte_ticket', ticket.id,
            'Ticket ' + ticket.id.slice(0, 8) + ': ' + JSON.stringify(updates));

        res.json({ mensaje: 'Ticket actualizado', ticket });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Estadísticas rápidas (solo admin): cantidad por estado, tipo, prioridad
router.get('/stats/resumen', auth, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo admin' });
        }
        const todos = await SoporteTicket.findAll();
        const stats = {
            total: todos.length,
            por_estado: {},
            por_tipo: {},
            por_prioridad: {},
            pendientes_admin: 0
        };
        for (const t of todos) {
            stats.por_estado[t.estado] = (stats.por_estado[t.estado] || 0) + 1;
            stats.por_tipo[t.tipo] = (stats.por_tipo[t.tipo] || 0) + 1;
            stats.por_prioridad[t.prioridad] = (stats.por_prioridad[t.prioridad] || 0) + 1;
            if (t.estado === 'abierto' || t.estado === 'en_progreso') stats.pendientes_admin++;
        }
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
