// exportRoutes.js - Rutas para exportación
const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const auth = require('../middleware/auth');

// Listar todos los costeos del usuario
router.get('/costeos', auth, exportController.listarCosteos);

// Exportar un costeo a Excel
router.get('/costeos/:id/excel', auth, exportController.exportarCosteo);

module.exports = router;