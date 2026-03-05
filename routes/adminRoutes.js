const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { AuditoriaLog, ConfigSistema } = require('../models');

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

module.exports = router;
