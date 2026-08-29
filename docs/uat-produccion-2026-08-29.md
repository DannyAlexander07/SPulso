# UAT y salida controlada de SPulso

Esta matriz separa lo que puede verificarse automaticamente de lo que debe
aceptar una persona responsable de negocio. Ningun resultado local o de staging
autoriza por si solo la salida a campo.

## Criterios de entrada

- Migraciones aplicadas sobre copia restaurada de staging sin duplicados de DNI
  ni correo personal.
- Backup de PostgreSQL y `api-uploads` creado, validado y restaurado en un
  contenedor desechable.
- ClamAV disponible y prueba EICAR rechazada; un PDF limpio debe ser aceptado.
- `/health` publico responde por HTTPS y el monitor registra exitos cada cinco
  minutos.
- SMTP real configurado y un comunicado de prueba llega a un correo controlado.
- Cuentas demo eliminadas o rotadas; no se comparte una misma cuenta entre
  evaluadores.

## Matriz de seis roles

Cada evaluador registra fecha, empresa, caso, resultado, captura o ID de
auditoria y observacion. Un acceso no autorizado es bloqueo de salida.

| Rol | Debe poder | Debe quedar bloqueado |
| --- | --- | --- |
| Super Admin | Administrar empresas, usuarios, roles, auditoria y todo el grupo | Acciones fuera del tenant |
| Admin Grupo | Operar todas las empresas del grupo | Otro tenant y secretos de infraestructura |
| RRHH | Personas, importacion Excel, organizacion, asistencia, documentos y cultura | Crear o elevar usuarios si no posee `users.manage` |
| Gerencia | Consultar reportes, documentos autorizados y auditoria | Modificar fichas, roles o configuracion |
| Jefe de Area | Consultar equipo y aprobar solicitudes dentro de alcance | Ver o modificar trabajadores ajenos |
| Trabajador | Portal propio, marcacion, solicitudes, documentos y beneficios | Toda ruta administrativa y datos de otros trabajadores |

## Casos obligatorios por modulo

1. Importar un Excel mixto: valido, DNI duplicado, correo duplicado, fecha
   imposible, area inexistente y fila sin apellido.
2. Confirmar que las filas validas se crean y las demas aparecen en `Bandeja de
   pendientes` con campo exacto, conflicto y enlace a la ficha existente.
3. Cerrar el navegador durante una carga y reabrir: el lote debe conservarse.
4. Corregir cada fila en el modal, ingresar nuevamente el PIN y confirmar
   auditoria, linea de tiempo y ficha completa.
5. Intentar subir el mismo archivo: debe abrir el lote ya guardado, no duplicar
   personas.
6. Probar asistencia de entrada y salida con GPS, consentimiento, geocerca,
   PIN incorrecto, PIN bloqueado y fecha local Lima.
7. Crear, aprobar y rechazar solicitudes; validar alcance de jefe y empresa.
8. Subir PDF e imagen limpia, EICAR y extension falsificada; validar permisos de
   descarga y evidencia de firma inmutable.
9. Publicar comunicado segmentado y validar cola SMTP real, fallos y reintento.
10. Revisar responsive en 360x800, 390x844, 768x1024, 1366x768 y 1920x1080,
    teclado, foco, Escape, scroll de modales y tablas.

## Criterio de salida

- Cero defectos criticos o altos abiertos.
- Cero cruces de tenant, empresa o rol.
- Restauracion demostrada con fecha y checksum.
- Carga representativa dentro de los umbrales acordados y sin errores 5xx.
- Firma de aceptacion de RRHH, operaciones y responsable de datos personales.

