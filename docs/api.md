# API SPulso

Base local: `http://localhost:3001`.

## Salud

- `GET /health`: estado de API y base de datos.
- `GET /health/metrics`: metricas operativas. En produccion requiere header
  `x-observability-token`.

## Autenticacion

- `POST /auth/login`: inicia sesion.
- `GET /auth/me`: valida token y retorna usuario publico.

## Convencion de rutas

Se priorizan rutas en español:

- `/empresas`
- `/trabajadores`
- `/asistencia`
- `/solicitudes`
- `/documentos`
- `/usuarios`
- `/organizacion`
- `/beneficios`
- `/comunicados`
- `/notificaciones`
- `/automatizaciones`
- `/auditoria`
- `/portal/*`

Algunas rutas inglesas existen como compatibilidad tecnica, pero el producto debe mostrar nombres en español.

## Seguridad

Las rutas administrativas deben usar JWT y permisos. Las rutas del portal deben validar que el recurso pertenece al trabajador autenticado.
