const jwt = require('jsonwebtoken');
const { Usuario, Empresa } = require('../models');

// Generar JWT
const generarToken = (usuario) => {
    return jwt.sign(
        {
            id: usuario.id,
            email: usuario.email,
            rol: usuario.rol
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

// Registro de usuario
const register = async (req, res) => {
    try {
        const { email, password, nombre, rol, empresa_id } = req.body;

        // Verificar si el usuario ya existe
        const usuarioExistente = await Usuario.findOne({ where: { email } });
        if (usuarioExistente) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Verificar que la empresa existe
        if (empresa_id) {
            const empresa = await Empresa.findByPk(empresa_id);
            if (!empresa) {
                return res.status(404).json({ error: 'Empresa no encontrada' });
            }
        }

        // Crear usuario
        const usuario = await Usuario.create({
            email,
            password_hash: password,
            nombre,
            rol: rol || 'visualizador',
            empresa_id,
            activo: true
        });

        // Generar token
        const token = generarToken(usuario);

        res.status(201).json({
            mensaje: 'Usuario registrado exitosamente',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                rol: usuario.rol
            }
        });
    } catch (error) {
        console.error('Error en register:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
};

// Login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Buscar usuario
        const usuario = await Usuario.findOne({
            where: { email },
            include: [{ model: Empresa, as: 'empresa' }]
        });

        if (!usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Verificar que el usuario esté activo
        if (!usuario.activo) {
            return res.status(401).json({ error: 'Usuario inactivo' });
        }

        // Verificar contraseña
        const passwordValida = await usuario.compararPassword(password);
        if (!passwordValida) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // Generar token
        const token = generarToken(usuario);

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                rol: usuario.rol,
                empresa: usuario.empresa ? {
                    id: usuario.empresa.id,
                    nombre: usuario.empresa.nombre
                } : null
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al hacer login' });
    }
};

// Obtener usuario actual
const me = async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.usuario.id, {
            include: [{ model: Empresa, as: 'empresa' }],
            attributes: { exclude: ['password_hash'] }
        });

        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({
            usuario: {
                id: usuario.id,
                email: usuario.email,
                nombre: usuario.nombre,
                rol: usuario.rol,
                activo: usuario.activo,
                empresa: usuario.empresa ? {
                    id: usuario.empresa.id,
                    nombre: usuario.empresa.nombre
                } : null
            }
        });
    } catch (error) {
        console.error('Error en me:', error);
        res.status(500).json({ error: 'Error al obtener usuario' });
    }
};

module.exports = {
    register,
    login,
    me
};