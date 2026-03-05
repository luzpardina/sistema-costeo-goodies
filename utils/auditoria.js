const AuditoriaLog = require('../models/AuditoriaLog');

/**
 * Registrar acción en el log de auditoría
 * @param {Object} req - Express request (para obtener usuario e IP)
 * @param {string} accion - crear|actualizar|eliminar|calcular|revaluar|login|exportar
 * @param {string} entidad - costeo|lista|acuerdo|catalogo|valuacion|revaluacion|usuario
 * @param {string} entidadId - ID de la entidad afectada
 * @param {string} detalle - Descripción breve
 * @param {Object} datosAnteriores - Datos antes del cambio (opcional)
 * @param {Object} datosNuevos - Datos después del cambio (opcional)
 */
async function registrarAuditoria(req, accion, entidad, entidadId, detalle, datosAnteriores = null, datosNuevos = null) {
    try {
        await AuditoriaLog.create({
            usuario_id: req.usuario ? req.usuario.id : null,
            usuario_email: req.usuario ? req.usuario.email : null,
            accion,
            entidad,
            entidad_id: entidadId ? String(entidadId) : null,
            detalle,
            datos_anteriores: datosAnteriores,
            datos_nuevos: datosNuevos,
            ip: req.ip || req.connection?.remoteAddress || null
        });
    } catch (error) {
        // No fallar si la auditoría falla
        console.error('Error registrando auditoría:', error.message);
    }
}

module.exports = { registrarAuditoria };
