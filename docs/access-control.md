# Matriz de permisos de SPulso

Esta matriz define los permisos base por rol. Los roles pueden ajustarse desde el modulo
Usuarios y roles, pero estos perfiles sirven como punto de partida seguro.

## Roles base

| Rol | Uso principal | Alcance recomendado |
| --- | --- | --- |
| Super Admin | Control total del SaaS y configuracion global. | Plataforma completa. |
| Admin Grupo | Administracion completa del grupo empresarial. | Todas las empresas del tenant. |
| RRHH | Operacion diaria de recursos humanos. | Personas, asistencia, documentos, cultura y automatizaciones. |
| Gerencia | Lectura ejecutiva y seguimiento. | Informacion general sin editar datos criticos. |
| Jefe de Area | Gestion de equipo y aprobaciones. | Personas y solicitudes bajo su responsabilidad. |
| Trabajador | Portal personal del colaborador. | Ficha propia, solicitudes, documentos, beneficios y comunicados. |

## Permisos por modulo

| Modulo | Permiso | Que habilita |
| --- | --- | --- |
| Empresas | `companies.manage` | Crear, editar y consultar empresas del grupo. |
| Trabajadores | `employees.view` | Ver directorio y perfiles laborales. |
| Trabajadores | `employees.manage` | Crear y editar trabajadores. |
| Organizacion | `organization.view` | Ver areas, cargos, equipos y responsables. |
| Organizacion | `organization.manage` | Crear y editar areas, cargos y equipos. |
| Asistencia | `attendance.view` | Ver marcas, tardanzas, permisos y reportes. |
| Asistencia | `attendance.manage` | Registrar o corregir asistencia desde administracion. |
| Asistencia | `attendance.mark` | Marcar entrada y salida propia desde portal. |
| Solicitudes | `requests.view` | Ver solicitudes y estados. |
| Solicitudes | `requests.create` | Crear solicitudes propias o administrativas. |
| Solicitudes | `requests.approve` | Aprobar o rechazar solicitudes. |
| Documentos | `documents.view` | Ver documentos visibles. |
| Documentos | `documents.manage` | Crear, editar y administrar documentos. |
| Beneficios | `benefits.view` | Ver beneficios disponibles. |
| Beneficios | `benefits.manage` | Crear y segmentar beneficios. |
| Comunicados | `announcements.view` | Ver comunicados. |
| Comunicados | `announcements.manage` | Crear, editar, publicar y preparar envios. |
| Notificaciones | `notifications.view` | Ver alertas y notificaciones. |
| Notificaciones | `notifications.manage` | Gestionar reglas o estados de notificaciones. |
| Automatizaciones | `automations.view` | Ver reglas inteligentes y ejecuciones. |
| Automatizaciones | `automations.manage` | Configurar automatizaciones. |
| Usuarios y roles | `users.manage` | Crear usuarios, asignar roles y modificar permisos. |
| Auditoria | `audit.view` | Revisar trazabilidad del sistema. |

## Matriz final por rol

| Modulo | Super Admin | Admin Grupo | RRHH | Gerencia | Jefe de Area | Trabajador |
| --- | --- | --- | --- | --- | --- | --- |
| Empresas | Gestiona | Gestiona | Gestiona | Sin acceso | Sin acceso | Sin acceso |
| Trabajadores | Gestiona | Gestiona | Gestiona | Ve | Ve | Sin acceso admin |
| Organizacion | Gestiona | Gestiona | Gestiona | Ve | Ve | Sin acceso admin |
| Asistencia | Gestiona | Gestiona | Gestiona | Ve | Ve | Marca propia |
| Solicitudes | Gestiona y aprueba | Gestiona y aprueba | Gestiona y aprueba | Ve | Crea y aprueba | Crea propias |
| Documentos | Gestiona | Gestiona | Gestiona | Ve | Ve | Ve propios en portal |
| Beneficios | Gestiona | Gestiona | Gestiona | Ve | Ve | Ve segmentados |
| Comunicados | Gestiona | Gestiona | Gestiona | Ve | Ve | Ve segmentados |
| Notificaciones | Gestiona | Gestiona | Gestiona | Ve | Ve | Ve propias |
| Automatizaciones | Gestiona | Gestiona | Gestiona | Ve | Sin acceso | Sin acceso |
| Usuarios y roles | Gestiona | Gestiona | Sin acceso | Sin acceso | Sin acceso | Sin acceso |
| Auditoria | Ve | Ve | Ve | Ve | Sin acceso | Sin acceso |

## Reglas de seguridad

- El menu solo muestra modulos si el usuario tiene permisos.
- El API vuelve a validar permisos con `JwtAuthGuard` y `PermissionsGuard`.
- El portal trabajador no depende de permisos administrativos: valida que el recurso pertenezca al trabajador autenticado.
- Los roles son editables, pero solo usuarios con `users.manage` pueden cambiarlos.
- Para produccion, los permisos deben probarse por ruta directa, no solo por visibilidad del menu.
