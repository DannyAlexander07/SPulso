# SPulso

Plataforma de gestion humana multiempresa para Grupo SP, Mood, Infinity, Supernova y futuras empresas del grupo.

## Stack actual

- Web: Next.js, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons.
- API: NestJS, Prisma, PostgreSQL.
- Mobile: Flutter/Dart planificado despues de estabilizar web y API.

## Como levantar el proyecto

Desde la raiz:

```bash
npm run dev
```

Esto levanta:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`

Si el puerto `3001` esta ocupado, ya existe otra API corriendo. Cierra esa terminal o mata el proceso antes de levantar otra instancia.

## Espacios del producto

- Panel administrativo: operaciones de RRHH, empresas, trabajadores, asistencia, solicitudes, documentos, roles, comunicados, beneficios, automatizaciones y auditoria.
- Portal trabajador: marcacion, documentos, solicitudes, beneficios, comunicados, ficha laboral y equipo.
- Selector de panel: aparece cuando un usuario tiene acceso administrativo y tambien trabajador.

## Prioridad actual

Antes de mobile:

1. QA visual y responsive de todos los modulos web.
2. CRUDs consistentes con modales, filtros, paginacion y exportacion.
3. Seguridad de rutas, permisos, inputs y archivos.
4. Pruebas funcionales de login, permisos, portal y admin.
5. Documentacion tecnica y operativa.

## Produccion

La guia operativa esta en [`docs/production.md`](docs/production.md). Incluye
Docker Compose, API y worker separados, storage externo, variables de entorno y
alertas sobre `/health/metrics`.
