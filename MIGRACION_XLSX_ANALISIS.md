# Análisis: Migración xlsx → exceljs

**Vulnerabilidad**: paquete `xlsx` v0.18.5 tiene 2 vulnerabilidades HIGH (Prototype Pollution + ReDoS) sin parche oficial. **No hay versión arreglada disponible**.

**Riesgo real**:
- Solo se procesan Excels subidos por usuarios autenticados (Comex/Ariana)
- No hay endpoint público que reciba Excels
- El vector de ataque requeriría que un atacante obtenga credenciales válidas Y suba un Excel maliciosamente armado
- Severidad práctica: **baja-media**, aunque la vulnerabilidad declarada sea HIGH

## Lugares donde se usa XLSX

```
controllers/costeoController.js:1       const XLSX = require('xlsx');
  línea 9    : XLSX.utils.encode_cell
  línea 159  : XLSX.read(buffer, { type: 'buffer', cellDates: true })
  línea 770  : XLSX.read(buffer, { type: 'buffer', cellDates: true })

routes/contableRoutes.js:7              const XLSX = require('xlsx');
  línea 43   : XLSX.read(buffer, { type: 'buffer' })
  línea 46   : XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

routes/maestroRoutes.js:4               const XLSX = require('xlsx');
  línea 13   : XLSX.read(buffer, { type: 'buffer' })
  línea 15   : XLSX.utils.sheet_to_json(sheet)

services/logisticosImporter.js:8        const XLSX = require('xlsx');
  línea 15   : XLSX.read(buffer, { type: 'buffer' })
  línea 22   : XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  línea 33   : XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
```

## Por qué la migración NO es trivial

El código actual no solo usa los métodos públicos de XLSX, también accede directamente a estructuras internas:

```javascript
// costeoController.js línea 8-12
const getCellValue = (sheet, row, col) => {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet[cellAddress];   // ← Acceso directo a estructura XLSX
    return cell ? cell.v : null;        // ← .v es un atributo interno de XLSX
};
```

**ExcelJS** tiene una API completamente diferente:
- Es **async** (usa Promises): `await workbook.xlsx.load(buffer)`
- Las hojas se acceden con `workbook.getWorksheet(name)`, no con `workbook.Sheets[name]`
- Las celdas se acceden con `worksheet.getCell('A1').value`, no con `sheet[address].v`
- El manejo de fechas es distinto (ExcelJS devuelve Date objects, XLSX devuelve número o Date según `cellDates`)
- Las fórmulas, hojas con merge cells, y celdas vacías tienen comportamientos distintos

## Tres caminos posibles

### Opción A — Adapter wrapping (parche cosmético)
Crear `utils/xlsxCompat.js` que exponga una API tipo XLSX pero internamente use ExcelJS.
- **Pros**: cambio mínimo en los 4 archivos consumidores (solo el `require`).
- **Contras**: el adapter tiene que recrear `workbook.Sheets[X][addr].v` lo cual implica iterar TODAS las celdas del worksheet ExcelJS y construir el objeto plano. Para Excels grandes (5000+ filas), puede ser 10x más lento. Además los métodos como `sheet_to_json` requieren reimplementación completa.
- **Estimado**: 4-6 horas de desarrollo + testing.
- **Riesgo**: alto. Bugs sutiles aparecerán solo con Excels reales del proveedor.

### Opción B — Refactor completo (correcto)
Migrar cada uno de los 4 archivos a la API nativa de ExcelJS. Convertir funciones a async donde haga falta.
- **Pros**: código limpio, sin capa de compatibilidad, performance óptima.
- **Contras**: cambio invasivo, requiere convertir funciones síncronas a async (afecta llamadores en cascada).
- **Estimado**: 1-2 días de trabajo + testing exhaustivo con Excels reales.
- **Riesgo**: alto si no se hace con buena suite de Excels de prueba reales del proveedor.

### Opción C — Aislar el riesgo (pragmático)
Mantener `xlsx` pero:
1. Validar el `Content-Type` del request (`application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)
2. Limitar tamaño máximo del archivo (multer ya tiene `limits: { fileSize: ... }` pero verificar)
3. Verificar que solo usuarios autenticados con rol no-visualizador puedan subir Excels
4. Agregar rate limit específico al endpoint de import (pocos por minuto)
5. Documentar la vulnerabilidad y aceptarla mitigada
- **Pros**: cero riesgo de romper imports, defensa en profundidad.
- **Contras**: la vulnerabilidad sigue ahí en el package.json.
- **Estimado**: 30-60 min.
- **Riesgo**: bajo.

## Mi recomendación

**Opción C ahora + Opción B planificada**.

La opción C cierra el vector de ataque práctico (atacante necesitaría credenciales + bypass de rate limit + un Excel cuidadosamente armado). La opción B se hace en una sesión dedicada con tiempo, con Excels reales de cada proveedor (Maille, Bornibus, Cusqueña, etc.) para testear.

## Si elegís opción C, los cambios concretos serían:

1. En `controllers/costeoController.js` y demás, agregar validación al inicio del handler:
   ```javascript
   if (!req.file) return res.status(400).json({ error: 'Sin archivo' });
   if (req.file.size > 10 * 1024 * 1024) {
       return res.status(413).json({ error: 'Archivo > 10MB' });
   }
   const tiposPermitidos = [
       'application/vnd.ms-excel',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'application/octet-stream'  // a veces el browser manda esto
   ];
   if (!tiposPermitidos.includes(req.file.mimetype)) {
       return res.status(415).json({ error: 'Solo se aceptan archivos .xlsx o .xls' });
   }
   ```

2. En `server.js` agregar rate limit específico:
   ```javascript
   const importLimiter = rateLimit({
       windowMs: 5 * 60 * 1000,  // 5 minutos
       max: 20,                   // 20 imports por usuario
       message: { error: 'Demasiados imports. Esperá 5 minutos.' }
   });
   app.use('/api/costeos/importar', importLimiter);
   app.use('/api/costeos/precargar', importLimiter);
   app.use('/api/maestro/importar', importLimiter);
   app.use('/api/maestro/previsualizar', importLimiter);
   app.use('/api/contable/parsear-excel', importLimiter);
   ```

3. Agregar middleware de roles: solo Comex/Admin pueden importar Excels (no Comercial, no Visualizador).

## Si elegís opción B (migración real)

Necesito de vos:
- Excels REALES de cada proveedor (al menos 1 de cada formato distinto)
- Una sesión de varias horas con verificación intermedia
- Aceptar que puede haber 2-3 iteraciones de bugfix después del primer deploy

**Recomendación final**: cerrá la sesión de hoy SIN tocar XLSX. Mañana decidís con calma entre A/B/C.
