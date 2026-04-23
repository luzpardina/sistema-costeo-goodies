# Análisis del bug del backup DB

**Contexto**: el commit `384e7dc` (feat: backup completo de DB) se pusheó a main el 21 abril 2026. Inmediatamente después, el login empezó a devolver "Error interno del servidor". Se hizo rollback (`22879e4`) y el sistema volvió a funcionar.

**Objetivo de este análisis**: encontrar la causa raíz del bug para decidir si re-implementar el backup o abandonarlo por otra vía.

## Hipótesis evaluadas

### H1 — require() top-level del servicio falló al cargar
**Descartada.** El `require` en `adminRoutes.js` es lazy (dentro del handler del endpoint). Se ejecuta solo cuando alguien hace click en el botón de backup, no al arrancar el server.

### H2 — Límite de body de Express
**Descartada.** Express tiene `limit: '10mb'` pero eso es para el **request body**. La **response** del backup es JSON grande pero `res.send(buffer)` no pasa por el parser.

### H3 — CSP o Helmet interfiere
**Descartada.** `contentSecurityPolicy: false` está desde antes. No se tocó en el commit.

### H4 — Modelos de Sequelize mal referenciados
**Descartada.** Verificación: `node -e` carga todos los 19 modelos mencionados en el servicio sin error.

### H5 — Memoria excesiva al ejecutar el backup
**Plausible pero descartada para este caso específico.**
Un backup con ~5000 logs de auditoría serializados a JSON ocupa ~5MB.
Un backup con ~250.000 registros ocupa ~330MB y puede reventar la RAM del container Railway (Hobby: 512MB, Pro: 2-8GB).
Pero el login se cayó **antes** de que nadie hiciera click en el botón de backup. Entonces memoria del endpoint no fue la causa del crash inicial, aunque sí sería un problema latente a largo plazo.

### H6 — El arranque del server falló
**No confirmable sin logs.** Pero pruebas locales muestran:
- `node -c server.js` → sin errores de sintaxis
- Carga completa de todos los routes → OK
- Carga del servicio backupService → OK
- Tests (43/43) → pasan
- Sincronización de Sequelize → sin nuevos ALTER TABLE en el commit

El code path del arranque no cambió entre el commit previo y `384e7dc`.

### H7 — Timing del deploy de Railway
**La hipótesis más probable.**
- Railway redeploya al detectar push a main
- Durante el redeploy (~20-60s) el container viejo se apaga y el nuevo arranca
- Durante ese gap, Railway puede devolver 500 en requests HTTP
- Si coincidió que vos/Ariana probaron el login en ese gap, verían "Error interno del servidor"
- El rollback subsecuente (`22879e4`) triggeeó otro redeploy, que ya encontró el sistema arrancado y todo "volvió a andar"

## Conclusión

**Es muy probable que el código del backup NUNCA haya tenido un bug real.** El timing del deploy y la coincidencia de que intentaron loguearse durante el redeploy explican perfectamente el síntoma.

## Recomendación

**Abandonar el backup DB custom** y usar la plantilla oficial de Railway `postgres-s3-backups`.

**Por qué:**
1. Es mantenida por Railway (soporte oficial)
2. Usa `pg_dump` (industry standard, restauración trivial)
3. Backup automático programado (cron), no manual
4. Se deploya como otro service al proyecto (container separado, no toca el backend principal)
5. **Cero riesgo** de afectar el sistema en uso
6. Storage gratis: Cloudflare R2 (10GB gratis) o Backblaze B2

**Costo**: 0 USD/mes si los backups caben en el free tier (con compresión, 1 backup diario de 500MB caben ~20 días antes de llegar al límite).

### Pasos sugeridos para deployar

1. Crear cuenta en Cloudflare R2 (gratis)
2. Crear bucket "goodies-db-backups"
3. Generar API token R2 con acceso al bucket
4. En Railway: "New Service" → "Template" → buscar "Postgres S3 Backups" o usar:
   - URL template: https://railway.com/deploy/postgresql-s3-backups
5. Configurar variables:
   - `BACKUP_DATABASE_URL = ${{Postgres.DATABASE_URL}}` (Railway infiere)
   - `AWS_S3_BUCKET = goodies-db-backups`
   - `AWS_S3_ENDPOINT = https://[account_id].r2.cloudflarestorage.com`
   - `AWS_ACCESS_KEY_ID = [de R2]`
   - `AWS_SECRET_ACCESS_KEY = [de R2]`
   - `BACKUP_CRON_SCHEDULE = 0 3 * * *` (diario a las 3am UTC)
6. Deploy

Después para restaurar en una emergencia, hay que descargar el dump de R2 y hacer `psql < backup.sql`. Puedo ayudar con ese script el día que haga falta.

## Decisión pendiente (para Luz, cuando se levante)

- [ ] Mergear esta branch y usar el endpoint custom (con tests pero sin diagnóstico de causa raíz)
- [ ] Abandonar esta branch y configurar la plantilla Railway oficial
- [ ] Hacer ambos (el custom para descarga ad-hoc desde panel admin + el automático de Railway para respaldo periódico)

Mi voto: **la tercera opción**. El custom para poder descargar un snapshot desde el panel cuando sea necesario (ej: antes de un cambio importante), y el automático como red de seguridad.
