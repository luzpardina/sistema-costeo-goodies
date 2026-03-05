# Resumen Ejecutivo — Sesión 4 de Marzo 2026

## Sistema de Costeo GOODIES — v2.0 → v2.1

**Commits realizados:** 26  
**Archivos modificados:** index.html, manual.html, comercialRoutes.js, costeoRoutes.js, maestroRoutes.js, AcuerdoComercial.js, CatalogoLog.js (nuevo)  
**Tags de backup:** v2.0-backup-2026-03-04, v2.1-backup-2026-03-04, v2.1-final-2026-03-04

---

## Lo que se hizo

### Módulo COMERCIAL — Precios y Márgenes
- Cadena de precios completa con 5 eslabones: Neto Goodies → Factura → Distribuidor (gross-up) → Tradicional (markup) → PVP
- Lógica de supermercados: dos capas de gross-up (costos Goodies + acuerdos comerciales)
- Acuerdos Comerciales ampliados: tipo (Flat/Desc. en OC/NC/Factura del Cliente), orden, base de cálculo
- OC escalonado: hasta 3 niveles en cadena con tasa compuesta
- Categoría "Todas" en acuerdos
- Cálculo de márgenes inverso adaptado a supermercados
- Margen punta a punta del super (informativo)
- Columna Contribución Marginal (CM $) en resultados
- Alerta automática si margen < 10%
- Checkboxes de listas inline en Precios y Márgenes
- Exportar márgenes a Excel implementado

### Módulo COMEX — Mejoras
- Reporte Importe Despacho (presupuesto impuestos aduana)
- Costeos ordenados por fecha despacho por defecto + opción última actualización
- Filtro por Nombre Costeo y por Estado (Definitivo/Presupuesto/Calculado/No Calculado)
- Eliminada casilla "Solo ultima version"
- Cargar artículos del catálogo filtrados por Proveedor/Fábrica en costeo
- Protección eliminación definitivos (doble confirmación + escribir ELIMINAR)
- Confirmar antes de cerrar costeo sin guardar
- Duplicar costeo ahora pide nombre

### Buscador y Análisis
- Buscador rápido global (código, nombre, proveedor, fábrica, marca)
- Historial de precios por artículo con gráfico de barras y variación %
- Dashboard resumen (costeos por proveedor, evolución TC, top artículos)

### Filtros en cascada (todas las pantallas)
- Proveedor → Fábrica → Marca se acotan entre sí
- Solo Proveedor → Marca de ese proveedor
- Solo Fábrica → Marca de esa fábrica
- Ambos → intersección
- Autocomplete del navegador desactivado para evitar confusión

### Manual y Documentación
- Manual de usuario online completo (manual.html) accesible desde ADMIN
- Documentado criterio de revaluación, fórmulas super, OC escalones, reporte despacho
- Tooltips en todos los botones + links ❓ al manual
- Glosario ampliado con 8 términos nuevos

### Infraestructura
- Fix error módulo Contable (articulosCentumCargados)
- Exportar/Importar configuración (listas + acuerdos) en ADMIN
- Log de cambios del catálogo (auditoría)
- Alerta proveedor diferente al importar catálogo
- Reorden columnas Listas de Precios

---

## Pendientes para próximas sesiones
1. Cargar acuerdos reales de supermercados (cuando pasen desglose OC)
2. Probar cálculo precios/márgenes con datos reales
3. Separar index.html en archivos por módulo (~5300 líneas)
4. Backup automático a Google Drive
5. Agregar log de cambios visible en ADMIN (tabla visual)
6. Resumen ejecutivo automático por sesión

---

*Generado automáticamente — Sesión del 4 de Marzo 2026*
