const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { AuditoriaLog, ConfigSistema, Usuario } = require('../models');
const { registrarAuditoria } = require('../utils/auditoria');
const bcrypt = require('bcryptjs');

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

// Crear nuevo usuario
router.post('/usuarios', auth, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden crear usuarios' });
        }
        const { email, password, nombre, rol } = req.body;
        if (!email || !password || !nombre) {
            return res.status(400).json({ error: 'Email, password y nombre son requeridos' });
        }
        const existente = await Usuario.findOne({ where: { email } });
        if (existente) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const usuario = await Usuario.create({
            email,
            password: hashedPassword,
            nombre,
            rol: rol || 'visualizador',
            activo: true
        });
        await registrarAuditoria(req.usuario.id, 'CREAR_USUARIO', 'Usuario', usuario.id, null, { email, nombre, rol });
        res.json({ mensaje: 'Usuario creado', usuario: { id: usuario.id, email, nombre, rol: usuario.rol } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar usuario
router.delete('/usuarios/:id', auth, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden eliminar usuarios' });
        }
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (usuario.id === req.usuario.id) {
            return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
        }
        const datosAntes = { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol };
        await usuario.destroy();
        await registrarAuditoria(req.usuario.id, 'ELIMINAR_USUARIO', 'Usuario', req.params.id, datosAntes, null);
        res.json({ mensaje: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actualizar usuario (rol, activo)
router.put('/usuarios/:id', auth, async (req, res) => {
    try {
        // SECURITY FIX: validar rol admin antes de modificar usuarios.
        // Sin esta validación, cualquier usuario autenticado podía escalar su
        // propio rol a admin o modificar cualquier otro usuario.
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden modificar usuarios' });
        }
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
        // SECURITY FIX 1: validar rol admin (faltaba).
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo administradores pueden resetear contraseñas' });
        }
        const usuario = await Usuario.findByPk(req.params.id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        if (!req.body.password) return res.status(400).json({ error: 'Contraseña requerida' });
        // SECURITY FIX 2: hashear la contraseña antes de guardar.
        // El modelo Usuario solo tiene hook beforeCreate (no beforeUpdate),
        // por lo que asignar password_hash directamente la guardaba en texto plano
        // y el login con bcrypt.compare fallaba siempre. Hashea explícitamente acá.
        if (req.body.password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }
        const salt = await bcrypt.genSalt(10);
        usuario.password_hash = await bcrypt.hash(req.body.password, salt);
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

// Recalcular pct_costo_divisa y pct_costo_pesos en todos los costeos existentes.
// Endpoint one-time: itera todos los costeos calculados y los recalcula para
// poblar los nuevos campos. Los costeos borradores (estado='borrador') se saltean
// porque no tienen cálculo previo válido.
// Solo admin. Devuelve reporte: total, exitosos, con errores, duración.
router.post('/recalcular-pct-costo', auth, async (req, res) => {
    try {
        if (req.usuario.rol !== 'admin') {
            return res.status(403).json({ error: 'Solo admins pueden ejecutar esta operación' });
        }
        const { Costeo } = require('../models');
        const CalculosService = require('../services/calculosService');

        const inicioMs = Date.now();
        const costeos = await Costeo.findAll({
            where: { estado: 'calculado' },
            attributes: ['id', 'nombre_costeo'],
            order: [['created_at', 'ASC']]
        });

        const resultados = { total: costeos.length, exitosos: 0, errores: [] };
        for (const c of costeos) {
            try {
                await CalculosService.calcularCosteo(c.id);
                resultados.exitosos++;
            } catch (e) {
                resultados.errores.push({ id: c.id, nombre: c.nombre_costeo, error: e.message });
            }
        }
        resultados.duracion_segundos = Math.round((Date.now() - inicioMs) / 1000);

        // Invalido el cache de últimos costos que ahora tiene datos recalculados
        const { invalidateCache } = require('../utils/cache');
        invalidateCache('/api/costeos/ultimos-costos');

        // Registro en auditoría
        try {
            await registrarAuditoria(req.usuario.id, 'recalculo_masivo_pct_costo', {
                total: resultados.total,
                exitosos: resultados.exitosos,
                cantidad_errores: resultados.errores.length
            });
        } catch (e) { /* no frenar si falla auditoría */ }

        res.json(resultados);
    } catch (error) {
        console.error('Error en recálculo masivo pct_costo:', error);
        res.status(500).json({ error: 'Error en recálculo masivo: ' + error.message });
    }
});

module.exports = router;
