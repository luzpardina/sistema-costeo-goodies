const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { AuditoriaLog } = require('../models');

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

module.exports = router;
