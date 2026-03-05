const NodeCache = require('node-cache');

// TTL 5 minutos para datos de catálogo, 2 min para costos
const cache = new NodeCache({ 
    stdTTL: 300,     // 5 minutos por defecto
    checkperiod: 60  // Limpieza cada 60s
});

/**
 * Middleware de caché para GET endpoints
 * @param {number} ttl - Tiempo en segundos (default: 300)
 */
function cacheMiddleware(ttl = 300) {
    return (req, res, next) => {
        const key = req.originalUrl;
        const cached = cache.get(key);
        
        if (cached) {
            return res.json(cached);
        }
        
        // Override res.json para capturar la respuesta
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode === 200) {
                cache.set(key, body, ttl);
            }
            return originalJson(body);
        };
        
        next();
    };
}

/**
 * Invalidar caché por patrón
 * @param {string} pattern - Prefijo de URL a invalidar
 */
function invalidateCache(pattern) {
    const keys = cache.keys();
    keys.forEach(key => {
        if (key.includes(pattern)) {
            cache.del(key);
        }
    });
}

/**
 * Limpiar toda la caché
 */
function clearCache() {
    cache.flushAll();
}

module.exports = { cache, cacheMiddleware, invalidateCache, clearCache };
