const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const { loginValidation, registerValidation } = require('../middleware/validations');

// Rutas públicas
router.post('/login', loginValidation, authController.login);

// Rutas protegidas
router.post('/register', auth, registerValidation, authController.register);
router.get('/me', auth, authController.me);

module.exports = router;
