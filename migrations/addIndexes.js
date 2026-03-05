/**
 * Migración de índices para mejorar rendimiento de consultas
 * Ejecutar una vez al deployar
 */
const addIndexes = async (sequelize) => {
    const queries = [
        // Catálogo - búsquedas por proveedor, fábrica, marca, código
        "CREATE INDEX IF NOT EXISTS idx_catalogo_codigo ON catalogo_articulos (codigo_goodies);",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_proveedor ON catalogo_articulos (proveedor);",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_fabrica ON catalogo_articulos (empresa_fabrica);",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_marca ON catalogo_articulos (marca);",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_activo ON catalogo_articulos (habilitado, proveedor_activo, empresa_fabrica_activa);",
        
        // Costeos - ordenamiento y filtros
        "CREATE INDEX IF NOT EXISTS idx_costeos_fecha_despacho ON costeos (fecha_despacho DESC NULLS LAST);",
        "CREATE INDEX IF NOT EXISTS idx_costeos_proveedor ON costeos (proveedor);",
        "CREATE INDEX IF NOT EXISTS idx_costeos_estado ON costeos (estado);",
        "CREATE INDEX IF NOT EXISTS idx_costeos_updated ON costeos (updated_at DESC);",
        
        // Artículos de costeo - búsqueda por código y costeo
        "CREATE INDEX IF NOT EXISTS idx_art_costeo_codigo ON articulo_costeos (codigo_goodies);",
        "CREATE INDEX IF NOT EXISTS idx_art_costeo_costeo ON articulo_costeos (costeo_id);",
        
        // Acuerdos comerciales - filtro por lista
        "CREATE INDEX IF NOT EXISTS idx_acuerdos_lista ON acuerdos_comerciales (lista_id);",
        
        // Revaluaciones
        "CREATE INDEX IF NOT EXISTS idx_rev_art_codigo ON revaluacion_articulos (codigo_goodies);",
        "CREATE INDEX IF NOT EXISTS idx_rev_art_rev ON revaluacion_articulos (revaluacion_id);",
        
        // Log de catálogo
        "CREATE INDEX IF NOT EXISTS idx_catalogo_log_codigo ON catalogo_log (codigo_goodies);",
        "CREATE INDEX IF NOT EXISTS idx_catalogo_log_fecha ON catalogo_log (created_at DESC);",
    ];

    for (const query of queries) {
        try {
            await sequelize.query(query);
        } catch (e) {
            // Ignore if table doesn't exist yet
            console.log('Index skip:', e.message.substring(0, 60));
        }
    }
    console.log('✅ Índices de base de datos verificados');
};

module.exports = addIndexes;
