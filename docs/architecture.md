# Arquitectura de SPulso

## Capas

- `apps/web`: interfaz web del panel administrativo y portal trabajador.
- `apps/api`: API NestJS con modulos por dominio.
- `apps/api/prisma`: modelo de datos Prisma y seed inicial.
- `packages`: espacio reservado para tipos, validaciones y configuracion compartida.
- `apps/mobile`: espacio reservado para Flutter/Dart.

## Modulos principales

- Identidad y acceso: `auth`, `users`, roles y permisos.
- Multiempresa: `companies`, tenant, empresas y reglas.
- Personas: `employees`, areas, cargos y equipos.
- Tiempo: `attendance`, marcacion, asistencia y reportes.
- Flujos: `requests`, aprobaciones y estados.
- Archivo: `documents`, firma, vencimientos y certificados.
- Cultura: `announcements`, `benefits`, `notifications`.
- Sistema: `automations`, `audit`.
- Portal trabajador: `portal`.

## Decision importante

SPulso usa un solo login. Despues de autenticarse:

- Si solo tiene permisos administrativos, entra al panel administrativo.
- Si solo tiene ficha de trabajador, entra al portal trabajador.
- Si tiene ambos accesos, entra a `/seleccionar-panel`.

## Regla de crecimiento

Cada nuevo modulo debe tener:

- API propia dentro de `apps/api/src/modules`.
- Feature propio dentro de `apps/web/features`.
- Ruta en español.
- Permisos claros.
- Auditoria para acciones sensibles.
- Filtros, paginacion y estados de carga si maneja listas.

## Produccion

Las exportaciones en segundo plano se operan con un proceso `worker` separado
del API. El API queda con `EXPORT_JOBS_API_WORKER=false` y el worker ejecuta
`npm run worker:exports`.

Los archivos generados deben ir a storage externo (`s3`/R2 o `azure`) para no
depender del disco local del contenedor. La salud operativa se consulta en
`/health/metrics` usando `OBSERVABILITY_TOKEN`.
