# Base de datos

SPulso usa PostgreSQL con Prisma.

## Entidades actuales

- Tenant.
- Company.
- User.
- Role.
- Employee.
- Area.
- JobPosition.
- WorkTeam.
- AttendanceRecord.
- EmployeeRequest.
- EmployeeDocument.
- Benefit.
- BenefitAudience.
- Announcement.
- AnnouncementAudience.
- AnnouncementRead.
- AnnouncementEmailDelivery.
- Notification.
- AutomationRule.
- AuditLog.

## Principios

- Todo pertenece a un tenant.
- Las empresas viven dentro del tenant.
- Usuarios y trabajadores pueden estar conectados, pero no son lo mismo.
- Los permisos se derivan del rol del usuario.
- El portal trabajador debe derivar el trabajador desde el token, no desde parametros manipulables.
- Los beneficios y comunicados pueden segmentarse por todo el grupo, empresas o equipos.

## Pendientes de madurez

- Migraciones revisadas por ambiente.
- Backups automaticos.
- Indices para busquedas masivas.
- Historial de cambios para campos laborales criticos.
- Estrategia de archivado para asistencia, documentos y auditoria a gran escala.
