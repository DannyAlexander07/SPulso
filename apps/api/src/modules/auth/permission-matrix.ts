type PermissionDefinition = {
  description: string;
  key: string;
  label: string;
};

type PermissionGroup = {
  module: string;
  permissions: readonly PermissionDefinition[];
};

export const permissionMatrix = [
  {
    module: 'Empresas',
    permissions: [
      {
        key: 'companies.manage',
        label: 'Gestionar empresas',
        description: 'Crear, editar y revisar empresas del grupo.',
      },
    ],
  },
  {
    module: 'Trabajadores',
    permissions: [
      {
        key: 'employees.view',
        label: 'Ver trabajadores',
        description: 'Consultar directorio y perfiles laborales.',
      },
      {
        key: 'employees.manage',
        label: 'Gestionar trabajadores',
        description: 'Crear, editar y actualizar fichas laborales.',
      },
    ],
  },
  {
    module: 'Organizacion',
    permissions: [
      {
        key: 'organization.view',
        label: 'Ver organizacion',
        description: 'Consultar areas, cargos, equipos y responsables.',
      },
      {
        key: 'organization.manage',
        label: 'Gestionar organizacion',
        description: 'Crear y editar areas, cargos y equipos.',
      },
    ],
  },
  {
    module: 'Asistencia',
    permissions: [
      {
        key: 'attendance.view',
        label: 'Ver asistencia',
        description: 'Consultar marcas, tardanzas, permisos y reportes.',
      },
      {
        key: 'attendance.manage',
        label: 'Gestionar asistencia',
        description: 'Registrar o corregir asistencia administrativa.',
      },
      {
        key: 'attendance.mark',
        label: 'Marcar asistencia propia',
        description: 'Registrar entrada y salida desde el portal trabajador.',
      },
    ],
  },
  {
    module: 'Solicitudes',
    permissions: [
      {
        key: 'requests.view',
        label: 'Ver solicitudes',
        description: 'Consultar solicitudes y estados de aprobacion.',
      },
      {
        key: 'requests.create',
        label: 'Crear solicitudes',
        description: 'Solicitar vacaciones, permisos, remoto u otros casos.',
      },
      {
        key: 'requests.approve',
        label: 'Aprobar solicitudes',
        description: 'Aprobar o rechazar solicitudes pendientes.',
      },
    ],
  },
  {
    module: 'Documentos',
    permissions: [
      {
        key: 'documents.view',
        label: 'Ver documentos',
        description: 'Consultar documentos laborales visibles.',
      },
      {
        key: 'documents.manage',
        label: 'Gestionar documentos',
        description: 'Crear, editar, publicar y administrar documentos.',
      },
    ],
  },
  {
    module: 'Beneficios',
    permissions: [
      {
        key: 'benefits.view',
        label: 'Ver beneficios',
        description: 'Consultar beneficios disponibles por audiencia.',
      },
      {
        key: 'benefits.manage',
        label: 'Gestionar beneficios',
        description: 'Crear y segmentar beneficios por empresa o equipo.',
      },
    ],
  },
  {
    module: 'Comunicados',
    permissions: [
      {
        key: 'announcements.view',
        label: 'Ver comunicados',
        description: 'Consultar comunicados y segmentaciones.',
      },
      {
        key: 'announcements.manage',
        label: 'Gestionar comunicados',
        description: 'Crear, editar, publicar y preparar envios.',
      },
    ],
  },
  {
    module: 'Notificaciones',
    permissions: [
      {
        key: 'notifications.view',
        label: 'Ver notificaciones',
        description: 'Consultar alertas y bandeja de notificaciones.',
      },
      {
        key: 'notifications.manage',
        label: 'Gestionar notificaciones',
        description: 'Administrar reglas o estados de notificaciones.',
      },
    ],
  },
  {
    module: 'Automatizaciones',
    permissions: [
      {
        key: 'automations.view',
        label: 'Ver automatizaciones',
        description: 'Consultar reglas inteligentes y ejecuciones.',
      },
      {
        key: 'automations.manage',
        label: 'Gestionar automatizaciones',
        description: 'Configurar automatizaciones y acciones del sistema.',
      },
    ],
  },
  {
    module: 'Exportaciones',
    permissions: [
      {
        key: 'exports.manage',
        label: 'Gestionar exportaciones',
        description:
          'Generar, consultar y descargar exportaciones de datos autorizados.',
      },
    ],
  },
  {
    module: 'Usuarios y roles',
    permissions: [
      {
        key: 'users.manage',
        label: 'Gestionar usuarios y roles',
        description: 'Crear usuarios, asignar roles y modificar permisos.',
      },
    ],
  },
  {
    module: 'Auditoria',
    permissions: [
      {
        key: 'audit.view',
        label: 'Ver auditoria',
        description: 'Revisar trazabilidad de cambios sensibles.',
      },
    ],
  },
] as const satisfies readonly PermissionGroup[];

export type PermissionKey =
  (typeof permissionMatrix)[number]['permissions'][number]['key'];

type RolePermissionPreset = {
  description: string;
  name: string;
  permissions: PermissionKey[];
};

function collectValidPermissions() {
  const permissions: PermissionKey[] = [];

  for (const group of permissionMatrix) {
    const groupPermissions = group.permissions as readonly {
      key: PermissionKey;
    }[];

    for (const permission of groupPermissions) {
      permissions.push(permission.key);
    }
  }

  return permissions;
}

export const validPermissions: PermissionKey[] = collectValidPermissions();

export const rolePermissionPresets: RolePermissionPreset[] = [
  {
    name: 'Super Admin',
    description: 'Control total del SaaS y configuracion global.',
    permissions: [...validPermissions],
  },
  {
    name: 'Admin Grupo',
    description: 'Administra todas las empresas del grupo.',
    permissions: [...validPermissions],
  },
  {
    name: 'RRHH',
    description:
      'Gestiona personas, asistencia, cultura, documentos y roles operativos.',
    permissions: validPermissions.filter(
      (permission) => permission !== 'users.manage',
    ),
  },
  {
    name: 'Gerencia',
    description:
      'Consulta informacion ejecutiva sin modificar configuracion critica.',
    permissions: [
      'employees.view',
      'organization.view',
      'attendance.view',
      'requests.view',
      'documents.view',
      'benefits.view',
      'announcements.view',
      'notifications.view',
      'automations.view',
      'exports.manage',
      'audit.view',
    ],
  },
  {
    name: 'Jefe de Area',
    description: 'Aprueba solicitudes y revisa informacion de su equipo.',
    permissions: [
      'employees.view',
      'organization.view',
      'attendance.view',
      'requests.view',
      'requests.create',
      'requests.approve',
      'documents.view',
      'benefits.view',
      'announcements.view',
      'notifications.view',
      'exports.manage',
    ],
  },
  {
    name: 'Trabajador',
    description:
      'Accede a su portal, ficha, solicitudes, documentos y beneficios.',
    permissions: [
      'attendance.mark',
      'requests.create',
      'documents.view',
      'benefits.view',
      'announcements.view',
      'notifications.view',
    ],
  },
] as const;
