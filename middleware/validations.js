/**
 * Validaciones de input para endpoints críticos
 */
const { body, param, query, validationResult } = require('express-validator');

// Middleware que verifica errores de validación
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Datos inválidos',
            detalles: errors.array().map(e => ({ campo: e.path, mensaje: e.msg }))
        });
    }
    next();
};

// Auth validations
const loginValidation = [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').notEmpty().withMessage('Contraseña requerida'),
    validate
];

const registerValidation = [
    body('email').isEmail().withMessage('Email inválido').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Contraseña mínimo 6 caracteres'),
    body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
    body('rol').optional().isIn(['admin', 'comex', 'comercial', 'contable', 'visualizador']).withMessage('Rol inválido'),
    validate
];

// Costeo validations
const costeoCalcValidation = [
    param('id').isUUID().withMessage('ID de costeo inválido'),
    validate
];

// Revaluación validations
const revaluacionValidation = [
    body('tc_usd').isFloat({ min: 0.01 }).withMessage('TC USD debe ser mayor a 0'),
    body('motivo').trim().notEmpty().withMessage('Motivo requerido'),
    validate
];

// ML validations
const mlCalcularValidation = [
    body('articulos').isArray({ min: 1 }).withMessage('Debe enviar al menos un artículo'),
    body('canal').optional().isIn(['flex', 'full_super', 'full_colecta']).withMessage('Canal inválido'),
    body('comision_pct').optional().isFloat({ min: 0, max: 100 }).withMessage('Comisión debe ser 0-100'),
    validate
];

const mlOptimizarValidation = [
    body('articulos').isArray({ min: 1 }).withMessage('Debe enviar al menos un artículo'),
    body('margen_objetivo').isFloat({ min: 0, max: 500 }).withMessage('Margen objetivo debe ser 0-500%'),
    validate
];

// ID parameter validation
const idValidation = [
    param('id').notEmpty().withMessage('ID requerido'),
    validate
];

module.exports = {
    validate, loginValidation, registerValidation,
    costeoCalcValidation, revaluacionValidation,
    mlCalcularValidation, mlOptimizarValidation, idValidation
};
