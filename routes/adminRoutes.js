const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { AuditoriaLog, ConfigSistema, Usuario } = require('../models');
const { registrarAuditoria } = require('../utils/auditoria');

// Listar usuarios (solo admins)
router.get('/usuarios', auth, async (req, res) => {
    try {
        const usuarios = await Usuario.findAll({
            attributes: ['id', 'email', 'nombre', 'rol', 'activo', 'created_at', 'updated_at'],
            order: [['nombre', 'ASC']]
        });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar usuario (rol, activo)
router.put('/usuarios/:id', auth, async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        const updates = {};
        if (req.body.rol) updates.rol = req.body.rol;
        if (req.body.activo !== undefined) updates.activo = req.body.activo;
        if (req.body.nombre) updates.nombre = req.body.nombre;
        
        await usuario.update(updates);
        await registrarAuditoria(req, 'actualizar', 'usuario', usuario.id, 
            'Actualizado: ' + usuario.email + ' → ' + JSON.stringify(updates));
        
        res.json({ mensaje: 'Usuario actualizado', usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, activo: usuario.activo } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Resetear contraseña
router.put('/usuarios/:id/password', auth, async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!req.body.password) return res.status(400).json({ error: 'Contraseña requerida' });
        
        usuario.password_hash = req.body.password;
        await usuario.save();
        await registrarAuditoria(req, 'actualizar', 'usuario', usuario.id, 'Password reseteada: ' + usuario.email);
        
        res.json({ mensaje: 'Contraseña actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Log de auditoría (solo admins)
router.get('/auditoria', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await AuditoriaLog.findAll({
            order: [['created_at', 'DESC']],
            limit
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configuración del sistema - leer
router.get('/config', auth, async (req, res) => {
    try {
        const configs = await ConfigSistema.findAll({ order: [['clave', 'ASC']] });
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Configuración del sistema - actualizar
router.put('/config/:clave', auth, async (req, res) => {
    try {
        const config = await ConfigSistema.findOne({ where: { clave: req.params.clave } });
        if (!config) return res.status(404).json({ error: 'Configuración no encontrada' });
        await config.update({ valor: req.body.valor });
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seed de configuración por defecto
router.post('/config/seed', auth, async (req, res) => {
    try {
        const defaults = [
            { clave: 'IVA_GENERAL', valor: '21', descripcion: 'IVA general (%)', tipo: 'porcentaje' },
            { clave: 'IVA_ADICIONAL', valor: '20', descripcion: 'IVA adicional percepción (%)', tipo: 'porcentaje' },
            { clave: 'ESTADISTICA', valor: '3', descripcion: 'Tasa de estadística (%)', tipo: 'porcentaje' },
            { clave: 'ANMAT', valor: '0.5', descripcion: 'Tasa ANMAT sobre FOB (%)', tipo: 'porcentaje' },
            { clave: 'MARGEN_ALERTA_MINIMO', valor: '10', descripcion: 'Margen mínimo para alerta (%)', tipo: 'porcentaje' },
            { clave: 'MONEDA_DEFAULT', valor: 'USD', descripcion: 'Moneda por defecto', tipo: 'texto' },
        ];
        let creados = 0;
        for (const d of defaults) {
            const [config, created] = await ConfigSistema.findOrCreate({
                where: { clave: d.clave },
                defaults: d
            });
            if (created) creados++;
        }
        res.json({ mensaje: 'Configuración inicializada', creados, total: defaults.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cotizaciones BNA
router.get('/cotizaciones-bna', auth, async (req, res) => {
    try {
        const { obtenerCotizacionesBNA } = require('../services/bnaCotizaciones');
        const data = await obtenerCotizacionesBNA();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'No se pudo obtener cotizaciones del BNA: ' + error.message });
    }
});

module.exports = router;
