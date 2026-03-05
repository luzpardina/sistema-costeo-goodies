const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

// Rutas públicas (sin autenticación)
router.post('/login', authController.login);

// Rutas protegidas (requieren autenticación)
router.post('/register', auth, authController.register); // Solo usuarios logueados pueden crear usuarios
router.get('/me', auth, authController.me);

module.exports = router;