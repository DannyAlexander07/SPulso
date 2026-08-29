# Produccion SPulso

Esta guia deja la separacion minima para operar SPulso sin mezclar procesos:

- `web`: Next.js.
- `api`: NestJS HTTP, con `EXPORT_JOBS_API_WORKER=false`.
- `worker`: proceso dedicado para exportaciones.
- `postgres`: base de datos PostgreSQL.
- storage persistente para reportes: volumen local en una sola VPS o S3/R2/Azure
  cuando existan varias instancias.

## Variables

1. Copia `.env.production.example` como `.env.production`.
2. Cambia secretos reales:
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `OBSERVABILITY_TOKEN`
   - credenciales de S3/R2 o Azure, solo si se habilita ese driver.
3. Para una unica VPS se admite `FILE_STORAGE_DRIVER=local` con el volumen
   `api-uploads` incluido en los backups. Para alta disponibilidad usa `s3` o
   `azure`.
4. Conserva `TZ=America/Lima`, `TRUST_PROXY_HOPS=1` y publica los puertos
   loopback solo detras del proxy TLS. No expongas directamente `3000` o `3001`.
5. Si la VPS ya usa esos puertos, define `SPULSO_WEB_HOST_PORT` y
   `SPULSO_API_HOST_PORT`. Ambos continúan enlazados exclusivamente a
   `127.0.0.1`.

No uses `FILE_STORAGE_DRIVER=local` para escalar horizontalmente: dos replicas
no compartirian los mismos archivos.

## Despliegue con Docker Compose

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml config --quiet
docker compose --env-file .env.production -f docker-compose.production.yml run --rm api npm run db:migrate:deploy
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

Para ver procesos:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f api worker
```

## Worker de exportaciones

El API debe quedar con:

```env
EXPORT_JOBS_API_WORKER=false
```

El worker corre aparte:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d worker
```

Variables operativas:

- `EXPORT_JOBS_WORKER_INTERVAL_MS`: intervalo de polling.
- `EXPORT_JOBS_WORKER_BATCH_SIZE`: jobs por ciclo.
- `EXPORT_JOBS_PROCESSING_TIMEOUT_MS`: reintento de jobs trabados.
- `EXPORT_JOBS_FILE_RETENTION_DAYS`: retencion de archivos generados.
- `EXPORT_JOBS_CLEANUP_INTERVAL_MS`: limpieza de archivos vencidos.

## Storage externo

### S3 o Cloudflare R2

```env
FILE_STORAGE_DRIVER=s3
FILE_STORAGE_S3_BUCKET=spulso-exportaciones
FILE_STORAGE_S3_REGION=auto
FILE_STORAGE_S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
FILE_STORAGE_S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Azure Blob Storage

```env
FILE_STORAGE_DRIVER=azure
FILE_STORAGE_AZURE_CONNECTION_STRING=...
FILE_STORAGE_AZURE_CONTAINER=exportaciones
```

Las descargas siguen pasando por el API para mantener permisos y auditoria.

## Observabilidad y alertas

`GET /health` queda para healthcheck simple.

`GET /health/metrics` requiere:

```http
x-observability-token: <OBSERVABILITY_TOKEN>
```

El endpoint entrega:

- conteos de exportaciones por estado;
- conteos por tipo;
- antiguedad del job pendiente mas antiguo;
- completados y fallidos en ultimas 24 horas;
- driver de storage activo;
- parametros del worker.

### Checker de alertas

Ejecucion manual:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm observability-check
```

Ejecucion con Node local:

```bash
OBSERVABILITY_METRICS_URL=https://api.tu-dominio.com/health/metrics \
OBSERVABILITY_TOKEN=... \
npm --prefix apps/api run observability:check
```

Umbrales:

- `EXPORT_ALERT_MAX_PENDING_AGE_MS`: por defecto `600000`.
- `EXPORT_ALERT_MAX_FAILED_24H`: por defecto `0`.
- `EXPORT_ALERT_MAX_PROCESSING`: por defecto `20`.

Si detecta alerta, el comando termina con codigo `2` y emite JSON. Esto se puede
conectar a cron, Uptime Kuma, Better Stack, GitHub Actions programado o el
monitor del proveedor cloud.

Ejemplo cron cada 5 minutos:

```cron
*/5 * * * * cd /opt/spulso && docker compose --env-file .env.production -f docker-compose.production.yml run --rm observability-check
```

El repositorio tambien incluye `ops/monitoring/spulso-health-check.sh` y sus
unidades systemd. El endpoint externo recomendado es
`https://spulso.altaterraresources.com.pe/health`.

## Backups verificados

Instala `ops/backup/spulso-backup.sh` como
`/usr/local/sbin/spulso-backup`, copia las unidades de `ops/systemd` y activa
`spulso-backup.timer`. Cada ejecucion crea dump custom de PostgreSQL, archivo de
uploads, checksums y validacion de lectura. Configura `SPULSO_RCLONE_REMOTE` en
`/etc/spulso/backup.env` para la copia fuera de la VPS; sin este destino el
backup local no protege contra perdida total del servidor.

Prueba de restauracion desechable:

```bash
/usr/local/sbin/spulso-restore-verify /var/backups/spulso/FECHA/postgres.dump
```

## Correo y antivirus

En produccion `EMAIL_DELIVERY_MODE=smtp`: si SMTP no esta completo, la cola no
se marca como enviada. Todas las cargas pasan por ClamAV (`MALWARE_SCAN_MODE`)
y fallan cerradas si el analizador no responde. Las pruebas de aceptacion deben
incluir un mensaje SMTP real, un PDF limpio y el archivo EICAR.

## Checklist antes de liberar

- `npm --prefix apps/api run lint`
- `npm --prefix apps/api run build`
- `npm --prefix apps/api run test:e2e`
- `npm --prefix apps/api run test:load:exports` solo contra una base aislada de preproduccion
- `npm --prefix apps/web run lint`
- `npm --prefix apps/web run build`
- `npm --prefix apps/web run test:e2e`
- `npm audit --prefix apps/api`
- `npm audit --prefix apps/web`
- ejecutar Playwright contra preproduccion con `PLAYWRIGHT_BASE_URL=https://...`
  y una base aislada; nunca sembrar datos demo en produccion.

## Checklist de plataforma

- TLS configurado en proxy o load balancer.
- proxy inverso (por ejemplo, nginx) con limites de cuerpo, tiempo y tasa;
  desactivar buffering si se usan respuestas en streaming.
- puertos `3000` y `3001` enlazados a `127.0.0.1`, no a todas las interfaces.
- `CORS_ORIGINS` solo con dominios reales.
- backups de PostgreSQL y del volumen `api-uploads` probados con restore cuando
  se use storage local.
- `OBSERVABILITY_TOKEN` largo y no reutilizado.
- storage externo con lifecycle policy acorde a `EXPORT_JOBS_FILE_RETENTION_DAYS`.
- logs centralizados para `api` y `worker`.
- alertas activas sobre el checker de observabilidad.
- repositorio y workflow de CI realmente versionados desde una raiz comun.
