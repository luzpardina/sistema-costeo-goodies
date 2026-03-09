const jwt = require('jsonwebtoken');
const auth = (req, res, next) => {
    try {
        // Obtener token del header o de la query string (para descargas)
        let token = req.header('Authorization')?.replace('Bearer ', '');
        
        // Si no hay token en header, buscar en query string
        if (!token && req.query.token) {
            token = req.query.token;
        }
        
        if (!token) {
            return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
        }
        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;

        // Auto-renovar si quedan menos de 2 horas
        const ahora = Math.floor(Date.now() / 1000);
        const restante = decoded.exp - ahora;
        if (restante < 7200) {
            const nuevoToken = jwt.sign(
                { id: decoded.id, email: decoded.email, rol: decoded.rol },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            res.setHeader('X-New-Token', nuevoToken);
        }

        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
};
module.exports = auth;