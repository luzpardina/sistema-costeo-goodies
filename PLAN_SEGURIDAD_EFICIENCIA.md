# Plan de Mejoras — Seguridad y Eficiencia
## Sistema de Costeo GOODIES — v2.2
### Marzo 2026

---

## 🔴 CRÍTICAS (hacer ya)

### 1. Crear .gitignore
**Estado:** No existe. El .env con credenciales y JWT_SECRET está en el repositorio público.
**Riesgo:** Cualquiera con acceso al repo puede ver contraseñas de la base de datos.
**Solución:** Crear .gitignore, mover secretos a variables de entorno de Railway, rotar JWT_SECRET.

### 2. Proteger endpoint de registro
**Estado:** `/api/auth/register` es público — cualquiera puede crear usuarios.
**Riesgo:** Un atacante crea un usuario admin y accede a todo el sistema.
**Solución:** Restringir registro solo a admins autenticados (agregar middleware `auth` + check de rol).

### 3. JWT_SECRET débil
**Estado:** Es un string simple y predecible: `goodies_sistema_costeo_secreto_2025`
**Riesgo:** Fácil de adivinar, permite falsificar tokens.
**Solución:** Generar un secreto aleatorio de 64+ caracteres y almacenarlo como variable de entorno en Railway.

---

## 🟠 IMPORTANTES (próximas sesiones)

### 4. Implementar roles y permisos por endpoint
**Estado:** Todos los endpoints protegidos con `auth` pero sin verificación de rol. Cualquier usuario logueado puede eliminar costeos, modificar catálogo, etc.
**Riesgo:** Un usuario "visualizador" puede ejecutar operaciones de admin.
**Solución:** Middleware `requireRole('admin')` en endpoints POST/PUT/DELETE sensibles.

### 5. Agregar Helmet (headers de seguridad HTTP)
**Estado:** No se usa. Sin protección contra clickjacking, MIME sniffing, XSS reflejado.
**Solución:** `npm install helmet` + `app.use(helmet())` en server.js.

### 6. Rate limiting en login
**Estado:** No hay límite de intentos de login. Vulnerable a fuerza bruta.
**Solución:** `npm install express-rate-limit` → máximo 5 intentos por minuto por IP en `/api/auth/login`.

### 7. Validación de inputs en el servidor
**Estado:** Los endpoints confían en los datos que llegan del frontend sin sanitizar.
**Riesgo:** Inyección SQL (Sequelize mitiga parcialmente), datos malformados que rompen cálculos.
**Solución:** `npm install express-validator` → validar tipos, rangos y formatos en cada endpoint.

### 8. CORS restrictivo
**Estado:** `app.use(cors())` permite requests desde cualquier origen.
**Solución:** Configurar solo el dominio de Railway: `cors({ origin: 'https://tu-app.railway.app' })`.

### 9. Expiración de JWT y refresh tokens
**Estado:** Token expira en 24hs, no hay refresh. Si se compromete un token, dura todo el día.
**Solución:** Reducir expiración a 2-4 horas + implementar refresh token para renovar sin re-login.

### 10. HTTPS forzado
**Estado:** Railway ya usa HTTPS, pero no se fuerza la redirección.
**Solución:** Middleware que redirija HTTP → HTTPS en producción.

---

## 🟡 EFICIENCIA (mejoras de rendimiento)

### 11. Caché en el servidor para datos que cambian poco
**Estado:** Cada request de últimos costos, proveedores, marcas reconsulta la base desde cero.
**Impacto:** Lentitud cuando hay muchos artículos o usuarios concurrentes.
**Solución:** Caché en memoria (node-cache) con TTL de 5 minutos para endpoints de catálogo y dropdowns.

### 12. Paginación en listados grandes
**Estado:** Todos los costeos y artículos se cargan de una vez.
**Impacto:** Lento con 100+ costeos, consume memoria del navegador.
**Solución:** Paginación server-side (limit/offset) con scroll infinito o botones de página.

### 13. Índices en la base de datos
**Estado:** Solo PKs tienen índice. Búsquedas por codigo_goodies, proveedor, fecha_despacho sin índice.
**Impacto:** Queries lentas a medida que crecen los datos.
**Solución:** `CREATE INDEX` en campos más consultados: codigo_goodies, proveedor, fecha_despacho, lista_id.

### 14. Compresión de respuestas
**Estado:** Las respuestas JSON se envían sin comprimir.
**Solución:** `npm install compression` + `app.use(compression())` — reduce 60-80% el tráfico.

### 15. Lazy loading de módulos JS
**Estado:** Los 5 archivos JS se cargan al abrir la página aunque solo se use COMEX.
**Solución:** Cargar comercial.js, contable.js y admin.js solo cuando se activa su pestaña (con `<script async>`).

---

## 🟢 BUENAS PRÁCTICAS (cuando haya tiempo)

### 16. Logging estructurado
**Estado:** Solo `console.log/error`. No se registra quién hizo qué ni cuándo.
**Solución:** Winston o Pino para logs con timestamp, usuario, acción. Útil para auditoría y debugging.

### 17. Manejo centralizado de errores
**Estado:** Cada endpoint tiene su propio try/catch con mensajes inconsistentes.
**Solución:** Middleware global de errores + clases de error personalizadas (NotFoundError, ValidationError).

### 18. Backup automático de la base de datos
**Estado:** Solo backups manuales vía tag de GitHub. La base de datos depende de los backups de Railway.
**Solución:** Script cron que haga pg_dump y suba a Google Drive o S3 semanalmente.

### 19. Health check completo
**Estado:** `/health` solo devuelve `{ status: 'OK' }` sin verificar la conexión a la DB.
**Solución:** Verificar conexión a PostgreSQL, espacio en disco, y tiempo de respuesta.

### 20. Tests automatizados
**Estado:** No hay tests. Cada cambio se prueba manualmente.
**Riesgo:** Regresiones silenciosas al modificar lógica de cálculo.
**Solución:** Tests unitarios para las fórmulas de costeo, gross-up, cadena de precios, y márgenes. Jest + Supertest.

### 21. Variables de entorno para configuración
**Estado:** Algunos valores hardcodeados (IVA 21%, estadística 3%, ANMAT 0.5%).
**Solución:** Mover a tabla de configuración en la DB o variables de entorno, editables desde ADMIN.

### 22. Limitar tamaño de uploads
**Estado:** `limit: '50mb'` en JSON y archivos — muy generoso.
**Solución:** Reducir a 10mb para JSON, mantener 10mb para archivos Excel. Rechazar archivos sospechosos.

### 23. Soft-delete en vez de hard-delete
**Estado:** Eliminar un costeo lo borra permanentemente de la base.
**Solución:** Campo `eliminado_at` (soft delete) → se oculta pero se puede recuperar.

### 24. Auditoría completa de acciones
**Estado:** Solo el catálogo tiene log de cambios (CatalogoLog). Costeos, listas y acuerdos no.
**Solución:** Tabla general `auditoria_log` con usuario, acción, entidad, datos antes/después.

---

## Orden de implementación sugerido

| Prioridad | Items | Tiempo estimado |
|-----------|-------|-----------------|
| **AHORA** | 1, 2, 3 | 15 minutos |
| **Esta semana** | 4, 5, 6, 8 | 1 sesión |
| **Próxima semana** | 7, 9, 10, 13, 14 | 1-2 sesiones |
| **Cuando haya tiempo** | 11, 12, 15-24 | Varias sesiones |

---

*Documento generado el 5 de Marzo de 2026*

---

## ESTADO DE IMPLEMENTACIÓN (actualizado 5 marzo 2026)

| # | Item | Estado |
|---|------|--------|
| 1 | .gitignore + .env fuera del repo | ✅ Hecho |
| 2 | Proteger registro (solo admins) | ✅ Hecho |
| 3 | JWT_SECRET fuerte | ✅ Hecho (local, pendiente Railway) |
| 4 | Roles y permisos (noVisualizador) | ✅ Hecho en DELETE endpoints |
| 5 | Helmet (headers seguridad) | ✅ Hecho |
| 6 | Rate limiting login | ✅ Hecho (10 intentos/15 min) |
| 7 | Validación inputs | ⏳ Pendiente |
| 8 | CORS restrictivo | ✅ Hecho (configurable) |
| 9 | JWT refresh tokens | ⏳ Pendiente |
| 10 | HTTPS forzado | ✅ Hecho (producción) |
| 11 | Caché servidor | ✅ Hecho (node-cache 5 min) |
| 12 | Paginación | ⏳ Pendiente |
| 13 | Índices DB | ✅ Hecho (auto en startup) |
| 14 | Compresión | ✅ Hecho (compression) |
| 15 | Lazy loading JS | ⏳ Pendiente |
| 16 | Logging estructurado | ⏳ Parcial (audit log) |
| 17 | Error handler centralizado | ✅ Hecho |
| 18 | Backup automático DB | ⏳ Pendiente |
| 19 | Health check completo | ✅ Hecho (DB + memoria + uptime) |
| 20 | Tests automatizados | ✅ Hecho (17 tests fórmulas pricing) |
| 21 | Config variables en DB | ✅ Hecho (ConfigSistema) |
| 22 | Limitar uploads | ✅ Hecho (10mb) |
| 23 | Soft-delete costeos | ✅ Hecho (paranoid) |
| 24 | Auditoría completa | ✅ Hecho (AuditoriaLog + visor ADMIN) |

**Resumen: 18/24 implementados, 6 pendientes**
