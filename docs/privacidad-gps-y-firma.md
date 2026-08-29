# Aviso operativo de GPS y firma electronica

Documento tecnico para revision legal peruana; no sustituye la opinion del
asesor ni debe publicarse sin aprobacion de la empresa.

## GPS de asistencia

SPulso solicita la ubicacion solo cuando el trabajador pulsa entrada o salida.
No ejecuta seguimiento continuo. En cada marca almacena coordenadas, fecha,
empresa, trabajador, version del aviso y momento del consentimiento. La empresa
debe definir finalidad, base legal, plazo de conservacion, responsables,
procedimiento de derechos ARCO y canal de contacto antes de campo.

Version implementada: `gps-2026-08-29`. Un cambio material exige una version
nueva y nueva aceptacion. El acceso a coordenadas queda limitado por permisos y
empresa; los enlaces de mapa no deben compartirse fuera de los responsables.

## Firma de documentos

La evidencia actual conserva hash SHA-256 del contenido, texto de aceptacion,
fecha, usuario, IP y agente de usuario, y vuelve inmutable el documento firmado.
Antes de usarla para documentos laborales vinculantes, legal debe aprobar el
texto de consentimiento, el nivel de firma requerido, identidad, retencion y
procedimiento de impugnacion. Si se exige firma digital con certificado, debe
integrarse un proveedor acreditado; la evidencia actual no debe presentarse
como certificado digital.

