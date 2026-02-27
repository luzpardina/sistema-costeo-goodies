-- ============================================
-- UNIFICAR: Agregar artículos del maestro al catálogo
-- Solo agrega los que NO existen en catalogo_articulos
-- ============================================

INSERT INTO catalogo_articulos (codigo_goodies, nombre, proveedor, marca, rubro, habilitado, created_at, updated_at)
SELECT 
    m.codigo,
    m.nombre,
    m.proveedor,
    m.marca,
    m.categoria,
    m.activo,
    m.created_at,
    m.updated_at
FROM articulos_maestro m
WHERE NOT EXISTS (
    SELECT 1 FROM catalogo_articulos c 
    WHERE UPPER(c.codigo_goodies) = UPPER(m.codigo)
);

-- Verificar resultado
SELECT 
    COUNT(*) as total_catalogo_unificado,
    COUNT(derechos_porcentaje) as con_derechos,
    COUNT(unidades_por_caja) as con_und_caja,
    COUNT(ultimo_valor_origen) as con_valor_origen,
    COUNT(marca) as con_marca
FROM catalogo_articulos;
