# Auditoria de preproduccion SPulso - 2026-08-21

## Dictamen

El codigo queda como candidato a preproduccion despues de las correcciones y
pruebas descritas abajo. Todavia no se autoriza produccion ni operacion en campo:
primero deben cerrarse los bloqueos de plataforma, integraciones externas y
aceptacion operativa indicados al final.

## Hallazgos corregidos

### Seguridad, autenticacion y roles

- Se agrego el permiso `exports.manage` y se aislaron las exportaciones por
  usuario y tenant.
- Se impidio modificar o degradar roles privilegiados sin autorizacion.
- Empleados, asistencia, solicitudes, documentos y archivos aplican alcance por
  tenant, empresa, equipo y responsable.
- Las cargas y descargas pasan por rutas protegidas; se bloquearon traversal,
  nombres predecibles, tamanos excesivos y archivos incompatibles con su firma.
- Se reforzo el PIN obligatorio de asistencia y sus flujos de cambio.
- Se neutralizaron formulas en todas las exportaciones CSV.
- Se elimino la confianza directa en `X-Forwarded-For` del registro de firmas,
  se cambiaron nombres aleatorios debiles y se cerro una comparacion de prefijo
  que podia permitir salir del directorio al construir archivos ZIP.
- Las extensiones almacenadas ahora se derivan del MIME cuya firma fue validada
  y la foto del portal tiene el mismo limite seguro de 5 MB que el resto del
  sistema.
- Se corrigio la confianza en proxy y la identificacion de IP para evitar eludir
  limites de tasa mediante encabezados falsificados.
- Se bloquearon semillas de demostracion cuando `NODE_ENV=production`.
- Se elimino el secreto JWT de fallback que coincidia con una configuracion
  local; la API ahora exige `JWT_SECRET` en todos los entornos.

### Funcionalidad y estabilidad

- Se implemento geocerca configurable en base de datos, API y web.
- Se corrigio la perdida de sesion causada por prefetch de Next.js: un fallo de
  red temporal ya no elimina una sesion valida.
- La validacion de sesion usa cache acotado, timeout y respuesta temporal 503.
- El almacenamiento ahora falla al iniciar si el driver o sus credenciales son
  invalidos; no cae silenciosamente a disco local.
- El test de carga ahora calcula p95 solamente sobre latencias de endpoints y
  valida el tiempo total por separado.
- Se corrigio el encabezado administrativo en tablet: a 768 px el boton del
  menu se superponia al titulo. Se agrego una prueba geometrica de regresion y
  una configuracion Playwright especifica para tablet.

### Dependencias, build y despliegue

- Next.js, React y Prisma se actualizaron y se regenero Prisma de forma limpia.
- Se aislaron las instalaciones de API y web para evitar dependencias hoisted y
  auditorias ambiguas.
- Las imagenes Docker de API y web quedaron reproducibles; web usa salida
  `standalone` y API incluye OpenSSL y Prisma Client generado.
- Docker Compose admite un archivo de entorno explicito, storage local compartido
  entre API y worker y healthchecks.
- Se corrigio la URL interna del API usada por el proxy web dentro de Docker.
- Se consolido API y web en un unico repositorio Git en la raiz. Los metadatos
  Git anidados se conservaron fuera del proyecto como respaldo recuperable.
- El repositorio se publico en GitHub y el workflow CI de API y web termino
  correctamente sobre el commit de correccion `5c98615`.

## Evidencia de verificacion

- Migraciones desde base vacia: 31 aplicadas correctamente.
- API E2E: 20/20 pruebas aprobadas.
- API unitarias: 11/11 pruebas aprobadas, sin manejadores abiertos.
- Navegador contra el stack Docker: 18/18 pruebas aprobadas en escritorio,
  movil y tablet, con autenticacion, roles, filtros, paginacion, CSV,
  exportaciones en segundo plano, notificaciones y portal del trabajador.
- Carga de exportaciones: 20/20 completadas; p95 209 ms, total 1.640 s.
- Inspeccion visual y de overflow: 390, 768, 1440 y 1920 px sin desbordamiento
  horizontal ni errores o advertencias de consola.
- Lint y build de API y web: aprobados.
- Auditoria de dependencias de produccion: 0 vulnerabilidades en raiz, API y web.
- Healthcheck del API y carga HTTP de la web en contenedores: HTTP 200.
- GitHub Actions CI #2: trabajos API y web aprobados en un checkout limpio.

## Bloqueos antes de produccion

1. Crear secretos reales y rotables, dominios, TLS, firewall y proxy inverso;
   validar `TRUST_PROXY_HOPS` contra la topologia real.
2. Configurar backups de PostgreSQL y archivos y demostrar una restauracion.
3. Configurar el proveedor real de correo y antivirus/escaneo de documentos. El
   codigo no puede sustituir esas integraciones externas.
4. Definir si recuperacion de contrasena, MFA y rotacion/refresh de sesion son
   requisitos obligatorios del lanzamiento.
5. Validar legalmente la firma/aceptacion documental y definir comentarios de
   aprobacion/rechazo si el proceso los exige.
6. Cargar coordenadas y radios reales de geocercas; la funcion debe permanecer
   deshabilitada donde esos datos no esten aprobados.
7. Ejecutar staging en la VPS con datos anonimizados y luego UAT con usuarios de
   cada rol antes de abrir produccion o enviarlo a campo.

## Estado de los datos de prueba

Los contenedores de prueba se detuvieron y eliminaron sin borrar volumenes. Las
bases aisladas y los volumenes de prueba se conservaron deliberadamente para no
realizar una eliminacion destructiva sin autorizacion.
