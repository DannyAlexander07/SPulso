# Seguridad de SPulso

## Base implementada

- JWT obligatorio para rutas privadas del API.
- Permisos por modulo mediante `@Permissions(...)`.
- Matriz canónica de permisos y roles base documentada en `docs/access-control.md`.
- CORS limitado por `CORS_ORIGINS`.
- Headers HTTP seguros con `helmet`.
- Headers de seguridad en Next.js: `nosniff`, `DENY` para iframes, referrer policy y permissions policy.
- Limite de tamano para JSON y formularios.
- Rate limit basico por IP, metodo y ruta.
- Rate limit mas estricto para `/auth/login`.
- `JWT_SECRET` obligatorio en produccion.
- Auditoria para acciones sensibles ya conectadas en modulos clave.
- Subida de imagenes de comunicados con limite de 3 MB, MIME permitido y validacion de firma real JPG, PNG o WebP.

## Reglas para nuevos modulos

- Toda ruta administrativa debe usar `JwtAuthGuard` y `PermissionsGuard`.
- Toda accion que cree, edite, apruebe, firme o elimine datos debe escribir auditoria.
- Toda ruta del portal trabajador debe validar que el recurso pertenezca al trabajador autenticado.
- No aceptar `employeeId`, `tenantId` o `companyId` desde el cliente cuando pueda derivarse del token.
- No habilitar `multipart/form-data` en rutas nuevas hasta implementar almacenamiento seguro, validacion de tipo/tamano y, si aplica, antivirus.
- No devolver contrasenas, hashes, tokens, secretos ni datos internos en respuestas.

## Pendientes antes de produccion

- Mover sesion web a cookie `HttpOnly`, `Secure`, `SameSite=Lax` emitida desde backend.
- Reemplazar rate limit en memoria por Redis cuando haya mas de una instancia del API.
- Agregar DTOs con `class-validator` para validar payloads antes de llegar a servicios.
- Rotacion de JWT y refresh tokens con revocacion.
- Politica de contrasenas y bloqueo temporal por intentos fallidos.
- Logs centralizados con alertas ante errores 401, 403, 429 y acciones administrativas criticas.
- Backups automatizados y pruebas de restauracion de PostgreSQL.
