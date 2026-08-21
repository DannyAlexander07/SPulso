import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import {
  CompanyStatus,
  PrismaClient,
  TenantStatus,
  UserStatus,
} from '@prisma/client';
import { rolePermissionPresets } from '../src/modules/auth/permission-matrix';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const baseCompanies = [
  { name: 'Grupo SP', slug: 'grupo-sp' },
  { name: 'Mood', slug: 'mood' },
  { name: 'Infinity', slug: 'infinity' },
  { name: 'Supernova', slug: 'supernova' },
] as const;

const privilegedRoleNames = ['Super Admin', 'Admin Grupo'];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('reset:demo esta bloqueado permanentemente en produccion.');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no esta configurado.');
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'grupo-sp' },
    update: {
      name: 'Grupo SP',
      status: TenantStatus.ACTIVE,
    },
    create: {
      name: 'Grupo SP',
      slug: 'grupo-sp',
      status: TenantStatus.ACTIVE,
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.announcementEmailDelivery.deleteMany({
      where: { tenantId: tenant.id },
    });
    await tx.announcementRead.deleteMany({ where: { tenantId: tenant.id } });
    await tx.announcementAudience.deleteMany({
      where: { tenantId: tenant.id },
    });
    await tx.announcement.deleteMany({ where: { tenantId: tenant.id } });

    await tx.benefitAudience.deleteMany({ where: { tenantId: tenant.id } });
    await tx.benefit.deleteMany({ where: { tenantId: tenant.id } });

    await tx.notification.deleteMany({ where: { tenantId: tenant.id } });
    await tx.auditLog.deleteMany({ where: { tenantId: tenant.id } });
    await tx.attendanceRecord.deleteMany({ where: { tenantId: tenant.id } });
    await tx.employeeRequest.deleteMany({ where: { tenantId: tenant.id } });
    await tx.employeeDocument.deleteMany({ where: { tenantId: tenant.id } });
    await tx.employeeClientAssignment.deleteMany({
      where: { tenantId: tenant.id },
    });

    await tx.workTeam.updateMany({
      where: { tenantId: tenant.id },
      data: { leaderEmployeeId: null },
    });
    await tx.employee.updateMany({
      where: { tenantId: tenant.id },
      data: {
        areaId: null,
        managerId: null,
        positionId: null,
        teamId: null,
        userId: null,
      },
    });

    await tx.user.deleteMany({
      where: {
        NOT: {
          role: {
            name: { in: privilegedRoleNames },
          },
        },
        tenantId: tenant.id,
      },
    });
    await tx.employee.deleteMany({ where: { tenantId: tenant.id } });
    await tx.workTeam.deleteMany({ where: { tenantId: tenant.id } });
    await tx.client.deleteMany({ where: { tenantId: tenant.id } });
    await tx.jobPosition.deleteMany({ where: { tenantId: tenant.id } });
    await tx.area.deleteMany({ where: { tenantId: tenant.id } });

    const baseCompanyRecords: Array<{ id: string }> = [];

    for (const company of baseCompanies) {
      const companyRecord = await tx.company.upsert({
        where: {
          tenantId_slug: {
            tenantId: tenant.id,
            slug: company.slug,
          },
        },
        update: {
          name: company.name,
          status: CompanyStatus.ACTIVE,
        },
        create: {
          tenantId: tenant.id,
          name: company.name,
          slug: company.slug,
          status: CompanyStatus.ACTIVE,
        },
        select: { id: true },
      });

      baseCompanyRecords.push(companyRecord);
    }

    const baseCompanyIds = baseCompanyRecords.map((company) => company.id);

    await tx.automationRule.deleteMany({
      where: {
        companyId: { notIn: baseCompanyIds },
        tenantId: tenant.id,
      },
    });
    await tx.company.deleteMany({
      where: {
        id: { notIn: baseCompanyIds },
        tenantId: tenant.id,
      },
    });

    for (const role of rolePermissionPresets) {
      await tx.role.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: role.name,
          },
        },
        update: {
          description: role.description,
          permissions: [...role.permissions],
        },
        create: {
          tenantId: tenant.id,
          name: role.name,
          description: role.description,
          permissions: [...role.permissions],
        },
      });
    }

    const adminRole = await tx.role.findUniqueOrThrow({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: 'Admin Grupo',
        },
      },
      select: { id: true },
    });

    const privilegedUsers = await tx.user.count({
      where: {
        role: {
          name: { in: privilegedRoleNames },
        },
        status: UserStatus.ACTIVE,
        tenantId: tenant.id,
      },
    });

    if (privilegedUsers === 0) {
      const adminPasswordHash = await bcrypt.hash('Admin1234.', 12);

      await tx.user.upsert({
        where: { email: 'admin@spulso.local' },
        update: {
          avatarUrl: null,
          companyId: null,
          firstName: 'Admin',
          lastName: 'SPulso',
          passwordHash: adminPasswordHash,
          roleId: adminRole.id,
          status: UserStatus.ACTIVE,
          tenantId: tenant.id,
        },
        create: {
          email: 'admin@spulso.local',
          avatarUrl: null,
          firstName: 'Admin',
          lastName: 'SPulso',
          passwordHash: adminPasswordHash,
          roleId: adminRole.id,
          status: UserStatus.ACTIVE,
          tenantId: tenant.id,
        },
      });
    }
  });

  const [
    companies,
    roles,
    users,
    employees,
    attendanceRecords,
    requests,
    documents,
    benefits,
    announcements,
    notifications,
    automationRules,
    auditLogs,
    areas,
    jobPositions,
    workTeams,
    clients,
    employeeClientAssignments,
  ] = await Promise.all([
    prisma.company.count({ where: { tenantId: tenant.id } }),
    prisma.role.count({ where: { tenantId: tenant.id } }),
    prisma.user.count({ where: { tenantId: tenant.id } }),
    prisma.employee.count({ where: { tenantId: tenant.id } }),
    prisma.attendanceRecord.count({ where: { tenantId: tenant.id } }),
    prisma.employeeRequest.count({ where: { tenantId: tenant.id } }),
    prisma.employeeDocument.count({ where: { tenantId: tenant.id } }),
    prisma.benefit.count({ where: { tenantId: tenant.id } }),
    prisma.announcement.count({ where: { tenantId: tenant.id } }),
    prisma.notification.count({ where: { tenantId: tenant.id } }),
    prisma.automationRule.count({ where: { tenantId: tenant.id } }),
    prisma.auditLog.count({ where: { tenantId: tenant.id } }),
    prisma.area.count({ where: { tenantId: tenant.id } }),
    prisma.jobPosition.count({ where: { tenantId: tenant.id } }),
    prisma.workTeam.count({ where: { tenantId: tenant.id } }),
    prisma.client.count({ where: { tenantId: tenant.id } }),
    prisma.employeeClientAssignment.count({ where: { tenantId: tenant.id } }),
  ]);

  console.log('SPulso quedo limpio para pruebas reales.');
  console.table({
    'empresas base': companies,
    roles,
    usuarios: users,
    trabajadores: employees,
    asistencia: attendanceRecords,
    solicitudes: requests,
    documentos: documents,
    beneficios: benefits,
    comunicados: announcements,
    notificaciones: notifications,
    automatizaciones: automationRules,
    auditoria: auditLogs,
    areas,
    cargos: jobPositions,
    equipos: workTeams,
    clientes: clients,
    asignacionesCliente: employeeClientAssignments,
  });
  console.log(
    'Usuarios privilegiados conservados. Si no existia ninguno, se creo admin@spulso.local / Admin1234.',
  );
}

main()
  .catch((error) => {
    console.error('No se pudo limpiar la data de prueba.');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
