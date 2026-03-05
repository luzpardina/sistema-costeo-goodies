/**
 * Middleware de autorización por rol
 * Uso: router.delete('/:id', auth, requireRole('admin'), handler)
 * 
 * Roles definidos:
 *   admin       - Acceso total
 *   comex       - COMEX + catálogo (lectura comercial/contable)
 *   comercial   - Comercial + catálogo (lectura COMEX/contable)
 *   contable    - Contable + catálogo (lectura COMEX/comercial)
 *   visualizador - Solo lectura en todos los módulos
 */

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        // Admin siempre tiene acceso
        if (req.usuario.rol === 'admin') {
            return next();
        }
        
        if (!roles.includes(req.usuario.rol)) {
            return res.status(403).json({ 
                error: 'No tenés permisos para esta acción',
                rol_requerido: roles,
                rol_actual: req.usuario.rol
            });
        }
        
        next();
    };
};

/**
 * Middleware para bloquear visualizadores en endpoints de escritura
 * Se aplica a POST/PUT/DELETE
 */
const noVisualizador = (req, res, next) => {
    if (!req.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (req.usuario.rol === 'visualizador') {
        return res.status(403).json({ 
            error: 'Tu rol es solo de consulta. No podés modificar datos.' 
        });
    }
    
    next();
};

module.exports = { requireRole, noVisualizador };
