import 'dotenv/config';
import { randomInt } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import {
  AnnouncementAudienceScope,
  AnnouncementPriority,
  AnnouncementStatus,
  AttendanceStatus,
  BenefitAudienceScope,
  BenefitStatus,
  DocumentStatus,
  DocumentType,
  PrismaClient,
  RequestStatus,
  RequestType,
  UserStatus,
} from '@prisma/client';
import { rolePermissionPresets } from '../src/modules/auth/permission-matrix';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

async function main() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error(
      'El seed demo esta bloqueado en produccion. Usa migraciones y procesos de alta controlados.',
    );
  }

  const adminPassword = seedPassword(
    'DEMO_ADMIN_PASSWORD',
    'Admin1234.',
    isProduction,
  );
  const workerPassword = seedPassword(
    'DEMO_WORKER_PASSWORD',
    'Trabajador123.',
    isProduction,
  );

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'grupo-sp' },
    update: {},
    create: {
      name: 'Grupo SP',
      slug: 'grupo-sp',
    },
  });

  const companies = [
    { name: 'Grupo SP', slug: 'grupo-sp' },
    { name: 'Mood', slug: 'mood' },
    { name: 'Infinity', slug: 'infinity' },
    { name: 'Supernova', slug: 'supernova' },
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: {
        tenantId_slug: {
          tenantId: tenant.id,
          slug: company.slug,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        name: company.name,
        slug: company.slug,
      },
    });
  }

  const createdCompanies = await prisma.company.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, slug: true },
  });

  const companyBySlug = new Map(
    createdCompanies.map((company) => [company.slug, company.id]),
  );

  const roles = rolePermissionPresets;

  for (const role of roles) {
    await prisma.role.upsert({
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

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Super Admin',
      },
    },
  });

  const workerRole = await prisma.role.findUniqueOrThrow({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'Trabajador',
      },
    },
  });

  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@spulso.local' },
    update: {
      tenantId: tenant.id,
      companyId: null,
      roleId: adminRole.id,
      status: UserStatus.ACTIVE,
      passwordHash: adminPasswordHash,
      failedLoginAttempts: 0,
      loginLockedUntil: null,
      lastFailedLoginAt: null,
    },
    create: {
      tenantId: tenant.id,
      roleId: adminRole.id,
      email: 'admin@spulso.local',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'SPulso',
      status: UserStatus.ACTIVE,
    },
  });

  const employees = [
    {
      companySlug: 'grupo-sp',
      employeeCode: 'SP-001',
      documentNumber: '70000001',
      firstName: 'Alejandro',
      lastName: 'Salazar',
      jobTitle: 'Administrador General',
      area: 'Direccion',
    },
    {
      companySlug: 'mood',
      employeeCode: 'MO-001',
      documentNumber: '70000002',
      firstName: 'Maria',
      lastName: 'Fernanda',
      jobTitle: 'Coordinadora de Operaciones',
      area: 'Operaciones',
    },
    {
      companySlug: 'mood',
      employeeCode: 'MO-002',
      documentNumber: '70000005',
      firstName: 'Lucia',
      lastName: 'Torres',
      jobTitle: 'Asistente de Operaciones',
      area: 'Operaciones',
    },
    {
      companySlug: 'mood',
      employeeCode: 'MO-003',
      documentNumber: '70000006',
      firstName: 'Mateo',
      lastName: 'Rivera',
      jobTitle: 'Analista de Operaciones',
      area: 'Operaciones',
    },
    {
      companySlug: 'infinity',
      employeeCode: 'IN-001',
      documentNumber: '70000003',
      firstName: 'Carlos',
      lastName: 'Ramirez',
      jobTitle: 'Supervisor',
      area: 'Ventas',
    },
    {
      companySlug: 'supernova',
      employeeCode: 'SU-001',
      documentNumber: '70000004',
      firstName: 'Diego',
      lastName: 'Vargas',
      jobTitle: 'Analista',
      area: 'Marketing',
    },
  ];

  const issuedPins = new Set<string>();

  for (const employee of employees) {
    const companyId = companyBySlug.get(employee.companySlug);

    if (!companyId) {
      continue;
    }

    let initialAttendancePin = '';
    do {
      initialAttendancePin = String(randomInt(100_000, 1_000_000));
    } while (issuedPins.has(initialAttendancePin));
    issuedPins.add(initialAttendancePin);
    const attendancePinHash = await bcrypt.hash(initialAttendancePin, 10);

    await prisma.employee.upsert({
      where: {
        companyId_employeeCode: {
          companyId,
          employeeCode: employee.employeeCode,
        },
      },
      update: {
        documentNumber: employee.documentNumber,
        firstName: employee.firstName,
        lastName: employee.lastName,
        jobTitle: employee.jobTitle,
        area: employee.area,
      },
      create: {
        tenantId: tenant.id,
        companyId,
        documentNumber: employee.documentNumber,
        employeeCode: employee.employeeCode,
        attendancePinHash,
        attendancePinChangeRequired: true,
        firstName: employee.firstName,
        lastName: employee.lastName,
        jobTitle: employee.jobTitle,
        area: employee.area,
        hireDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  }

  const seededEmployees = await prisma.employee.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      companyId: true,
      employeeCode: true,
    },
  });

  const employeeByCodeForOrg = new Map(
    seededEmployees.map((employee) => [employee.employeeCode, employee]),
  );

  const organizationSeeds = [
    {
      companySlug: 'grupo-sp',
      employeeCode: 'SP-001',
      area: 'Direccion',
      position: 'Administrador General',
      team: 'Direccion corporativa',
    },
    {
      companySlug: 'mood',
      employeeCode: 'MO-001',
      area: 'Operaciones',
      position: 'Coordinadora de Operaciones',
      team: 'Operacion Mood',
    },
    {
      companySlug: 'mood',
      employeeCode: 'MO-002',
      leaderEmployeeCode: 'MO-001',
      area: 'Operaciones',
      position: 'Asistente de Operaciones',
      team: 'Operacion Mood',
    },
    {
      companySlug: 'mood',
      employeeCode: 'MO-003',
      leaderEmployeeCode: 'MO-001',
      area: 'Operaciones',
      position: 'Analista de Operaciones',
      team: 'Operacion Mood',
    },
    {
      companySlug: 'infinity',
      employeeCode: 'IN-001',
      area: 'Ventas',
      position: 'Supervisor',
      team: 'Ventas Infinity',
    },
    {
      companySlug: 'supernova',
      employeeCode: 'SU-001',
      area: 'Marketing',
      position: 'Analista',
      team: 'Marketing Supernova',
    },
  ];

  for (const item of organizationSeeds) {
    const companyId = companyBySlug.get(item.companySlug);
    const employee = employeeByCodeForOrg.get(item.employeeCode);

    if (!companyId || !employee) {
      continue;
    }

    const leaderEmployee = employeeByCodeForOrg.get(
      item.leaderEmployeeCode ?? item.employeeCode,
    );
    const leaderEmployeeId = leaderEmployee?.id ?? employee.id;

    const area = await prisma.area.upsert({
      where: {
        companyId_slug: {
          companyId,
          slug: toSlug(item.area),
        },
      },
      update: {
        name: item.area,
      },
      create: {
        tenantId: tenant.id,
        companyId,
        name: item.area,
        slug: toSlug(item.area),
      },
    });

    const positionSlug = toSlug(item.position);
    const existingPosition = await prisma.jobPosition.findFirst({
      where: {
        tenantId: tenant.id,
        companyId,
        scope: 'COMPANY',
        slug: positionSlug,
      },
    });
    const position = existingPosition
      ? await prisma.jobPosition.update({
          where: { id: existingPosition.id },
          data: {
            name: item.position,
            areaId: area.id,
          },
        })
      : await prisma.jobPosition.create({
          data: {
            tenantId: tenant.id,
            companyId,
            areaId: area.id,
            scope: 'COMPANY',
            name: item.position,
            slug: positionSlug,
          },
        });

    const team = await prisma.workTeam.upsert({
      where: {
        companyId_slug: {
          companyId,
          slug: toSlug(item.team),
        },
      },
      update: {
        name: item.team,
        areaId: area.id,
        leaderEmployeeId,
      },
      create: {
        tenantId: tenant.id,
        companyId,
        areaId: area.id,
        leaderEmployeeId,
        name: item.team,
        slug: toSlug(item.team),
      },
    });

    await prisma.employee.update({
      where: { id: employee.id },
      data: {
        areaId: area.id,
        positionId: position.id,
        teamId: team.id,
      },
    });
  }

  const workerEmployee = await prisma.employee.findFirst({
    where: {
      tenantId: tenant.id,
      employeeCode: 'MO-001',
    },
    select: {
      id: true,
      companyId: true,
      firstName: true,
      lastName: true,
    },
  });

  if (workerEmployee) {
    const workerPasswordHash = await bcrypt.hash(workerPassword, 12);
    const workerUser = await prisma.user.upsert({
      where: { email: 'trabajador@spulso.local' },
      update: {
        tenantId: tenant.id,
        companyId: workerEmployee.companyId,
        roleId: workerRole.id,
        firstName: workerEmployee.firstName,
        lastName: workerEmployee.lastName,
        status: UserStatus.ACTIVE,
        passwordHash: workerPasswordHash,
        failedLoginAttempts: 0,
        loginLockedUntil: null,
        lastFailedLoginAt: null,
      },
      create: {
        tenantId: tenant.id,
        companyId: workerEmployee.companyId,
        roleId: workerRole.id,
        email: 'trabajador@spulso.local',
        passwordHash: workerPasswordHash,
        firstName: workerEmployee.firstName,
        lastName: workerEmployee.lastName,
        status: UserStatus.ACTIVE,
      },
    });

    await prisma.employee.update({
      where: { id: workerEmployee.id },
      data: { userId: workerUser.id },
    });
  }

  const adminEmployee = await prisma.employee.findFirst({
    where: {
      tenantId: tenant.id,
      employeeCode: 'SP-001',
    },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (adminEmployee) {
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { companyId: null },
    });

    await prisma.employee.update({
      where: { id: adminEmployee.id },
      data: { userId: adminUser.id },
    });
  }

  const attendanceByCode = new Map([
    [
      'SP-001',
      {
        status: AttendanceStatus.PRESENT,
        checkInHour: 8,
        checkInMinute: 2,
      },
    ],
    [
      'MO-001',
      {
        status: AttendanceStatus.PRESENT,
        checkInHour: 8,
        checkInMinute: 12,
      },
    ],
    [
      'IN-001',
      {
        status: AttendanceStatus.LATE,
        checkInHour: 9,
        checkInMinute: 8,
      },
    ],
    [
      'SU-001',
      {
        status: AttendanceStatus.ON_LEAVE,
        checkInHour: null,
        checkInMinute: null,
      },
    ],
  ]);

  const workDate = startOfToday();

  for (const employee of seededEmployees) {
    if (!employee.employeeCode) {
      continue;
    }

    const attendance = attendanceByCode.get(employee.employeeCode);

    if (!attendance) {
      continue;
    }

    let checkIn: Date | null = null;

    if (
      typeof attendance.checkInHour === 'number' &&
      typeof attendance.checkInMinute === 'number'
    ) {
      checkIn = new Date(workDate);
      checkIn.setHours(attendance.checkInHour, attendance.checkInMinute, 0, 0);
    }

    await prisma.attendanceRecord.upsert({
      where: {
        employeeId_workDate: {
          employeeId: employee.id,
          workDate,
        },
      },
      update: {
        status: attendance.status,
        checkIn,
        checkOut: null,
        notes: null,
        source: 'seed',
      },
      create: {
        tenantId: tenant.id,
        companyId: employee.companyId,
        employeeId: employee.id,
        workDate,
        status: attendance.status,
        checkIn,
        source: 'seed',
      },
    });
  }

  const employeeByCode = new Map(
    seededEmployees.map((employee) => [employee.employeeCode, employee]),
  );

  const requests = [
    {
      employeeCode: 'MO-001',
      type: RequestType.VACATION,
      status: RequestStatus.PENDING,
      title: 'Vacaciones',
      description: 'Solicitud de vacaciones por 3 dias.',
      startOffsetDays: 5,
      durationDays: 3,
    },
    {
      employeeCode: 'IN-001',
      type: RequestType.PERMISSION,
      status: RequestStatus.PENDING,
      title: 'Permiso personal',
      description: 'Permiso por tramite documentario.',
      startOffsetDays: 1,
      durationDays: 1,
    },
    {
      employeeCode: 'SU-001',
      type: RequestType.REMOTE_WORK,
      status: RequestStatus.APPROVED,
      title: 'Trabajo remoto',
      description: 'Trabajo remoto aprobado por coordinacion.',
      startOffsetDays: 2,
      durationDays: 1,
    },
  ];

  for (const request of requests) {
    const employee = employeeByCode.get(request.employeeCode);

    if (!employee) {
      continue;
    }

    const startDate = new Date(workDate);
    startDate.setDate(startDate.getDate() + request.startOffsetDays);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + request.durationDays - 1);

    await prisma.employeeRequest.upsert({
      where: {
        id: `${request.employeeCode}-${request.type}`.toLowerCase(),
      },
      update: {
        status: request.status,
        title: request.title,
        description: request.description,
        startDate,
        endDate,
        decidedAt:
          request.status === RequestStatus.APPROVED ? new Date() : null,
      },
      create: {
        id: `${request.employeeCode}-${request.type}`.toLowerCase(),
        tenantId: tenant.id,
        companyId: employee.companyId,
        employeeId: employee.id,
        type: request.type,
        status: request.status,
        title: request.title,
        description: request.description,
        startDate,
        endDate,
        decidedAt:
          request.status === RequestStatus.APPROVED ? new Date() : null,
      },
    });
  }

  const documents = [
    {
      employeeCode: 'SP-001',
      type: DocumentType.CONTRACT,
      status: DocumentStatus.SIGNED,
      title: 'Contrato laboral',
    },
    {
      employeeCode: 'MO-001',
      type: DocumentType.PAYSLIP,
      status: DocumentStatus.DRAFT,
      title: 'Boleta de pago',
    },
    {
      employeeCode: 'IN-001',
      type: DocumentType.POLICY,
      status: DocumentStatus.PENDING_SIGNATURE,
      title: 'Politica interna',
    },
    {
      employeeCode: 'SU-001',
      type: DocumentType.CERTIFICATE,
      status: DocumentStatus.SIGNED,
      title: 'Certificado laboral',
    },
  ];

  for (const document of documents) {
    const employee = employeeByCode.get(document.employeeCode);

    if (!employee) {
      continue;
    }

    await prisma.employeeDocument.upsert({
      where: {
        id: `${document.employeeCode}-${document.type}`.toLowerCase(),
      },
      update: {
        type: document.type,
        status: document.status,
        title: document.title,
        issuedAt: new Date(),
      },
      create: {
        id: `${document.employeeCode}-${document.type}`.toLowerCase(),
        tenantId: tenant.id,
        companyId: employee.companyId,
        employeeId: employee.id,
        type: document.type,
        status: document.status,
        title: document.title,
        issuedAt: new Date(),
      },
    });
  }

  const moodCompanyId = companyBySlug.get('mood');
  const infinityCompanyId = companyBySlug.get('infinity');
  const supernovaCompanyId = companyBySlug.get('supernova');

  const benefits = [
    {
      id: 'benefit-grupo-cultura',
      title: 'Entradas y sorteos internos',
      category: 'Cultura',
      description:
        'Campanas de entradas, sorteos y experiencias para trabajadores del grupo.',
      status: BenefitStatus.ACTIVE,
      audienceScope: BenefitAudienceScope.ALL,
      isHighlighted: true,
      actionLabel: 'Ver campanas',
      actionUrl: '/beneficios',
      companyIds: [],
    },
    {
      id: 'benefit-mood-infinity-supernova',
      title: 'Descuentos corporativos',
      category: 'Convenios',
      description:
        'Beneficios disponibles para Mood, Infinity y Supernova con control de segmentacion por empresa.',
      status: BenefitStatus.ACTIVE,
      audienceScope: BenefitAudienceScope.COMPANIES,
      isHighlighted: false,
      actionLabel: 'Solicitar informacion',
      actionUrl: 'mailto:rrhh@gruposp.pe',
      companyIds: [moodCompanyId, infinityCompanyId, supernovaCompanyId].filter(
        Boolean,
      ) as string[],
    },
  ];

  for (const benefitSeed of benefits) {
    const benefit = await prisma.benefit.upsert({
      where: { id: benefitSeed.id },
      update: {
        title: benefitSeed.title,
        category: benefitSeed.category,
        description: benefitSeed.description,
        status: benefitSeed.status,
        audienceScope: benefitSeed.audienceScope,
        isHighlighted: benefitSeed.isHighlighted,
        actionLabel: benefitSeed.actionLabel,
        actionUrl: benefitSeed.actionUrl,
      },
      create: {
        id: benefitSeed.id,
        tenantId: tenant.id,
        title: benefitSeed.title,
        category: benefitSeed.category,
        description: benefitSeed.description,
        status: benefitSeed.status,
        audienceScope: benefitSeed.audienceScope,
        isHighlighted: benefitSeed.isHighlighted,
        actionLabel: benefitSeed.actionLabel,
        actionUrl: benefitSeed.actionUrl,
      },
    });

    await prisma.benefitAudience.deleteMany({
      where: { benefitId: benefit.id },
    });

    if (benefitSeed.audienceScope === BenefitAudienceScope.COMPANIES) {
      await prisma.benefitAudience.createMany({
        data: benefitSeed.companyIds.map((companyId) => ({
          tenantId: tenant.id,
          benefitId: benefit.id,
          companyId,
        })),
      });
    }
  }

  const announcements = [
    {
      id: 'announcement-grupo-bienvenida',
      title: 'Bienvenida a SPulso',
      message:
        'Desde este portal centralizaremos avisos, beneficios, documentos y solicitudes para que todos trabajen con informacion clara.',
      status: AnnouncementStatus.PUBLISHED,
      priority: AnnouncementPriority.IMPORTANT,
      audienceScope: AnnouncementAudienceScope.ALL,
      isPinned: true,
      sendEmail: false,
      companyIds: [],
    },
    {
      id: 'announcement-mood-infinity-supernova-campana',
      title: 'Campana interna de beneficios',
      message:
        'Mood, Infinity y Supernova tendran beneficios segmentados por empresa y equipos. RRHH publicara nuevas oportunidades desde este modulo.',
      status: AnnouncementStatus.PUBLISHED,
      priority: AnnouncementPriority.NORMAL,
      audienceScope: AnnouncementAudienceScope.COMPANIES,
      isPinned: false,
      sendEmail: false,
      companyIds: [moodCompanyId, infinityCompanyId, supernovaCompanyId].filter(
        Boolean,
      ) as string[],
    },
  ];

  for (const announcementSeed of announcements) {
    const announcement = await prisma.announcement.upsert({
      where: { id: announcementSeed.id },
      update: {
        title: announcementSeed.title,
        message: announcementSeed.message,
        status: announcementSeed.status,
        priority: announcementSeed.priority,
        audienceScope: announcementSeed.audienceScope,
        isPinned: announcementSeed.isPinned,
        sendEmail: announcementSeed.sendEmail,
        publishAt: new Date(),
      },
      create: {
        id: announcementSeed.id,
        tenantId: tenant.id,
        title: announcementSeed.title,
        message: announcementSeed.message,
        status: announcementSeed.status,
        priority: announcementSeed.priority,
        audienceScope: announcementSeed.audienceScope,
        isPinned: announcementSeed.isPinned,
        sendEmail: announcementSeed.sendEmail,
        publishAt: new Date(),
      },
    });

    await prisma.announcementAudience.deleteMany({
      where: { announcementId: announcement.id },
    });

    if (
      announcementSeed.audienceScope === AnnouncementAudienceScope.COMPANIES
    ) {
      await prisma.announcementAudience.createMany({
        data: announcementSeed.companyIds.map((companyId) => ({
          tenantId: tenant.id,
          announcementId: announcement.id,
          companyId,
        })),
      });
    }
  }

  console.log(
    'Seed completed: Grupo SP, companies, roles, admin user, employees, attendance, requests, documents, organization, benefits, and announcements created.',
  );
}

function seedPassword(
  environmentName: 'DEMO_ADMIN_PASSWORD' | 'DEMO_WORKER_PASSWORD',
  developmentDefault: string,
  isProduction: boolean,
) {
  const configured = process.env[environmentName]?.trim();

  if (!isProduction) {
    return configured || developmentDefault;
  }

  const knownFixturePasswords = new Set([
    'Admin1234.',
    'Trabajador123.',
    'Rrhh1234.',
  ]);
  if (
    !configured ||
    configured.length < 16 ||
    knownFixturePasswords.has(configured) ||
    !/[a-z]/.test(configured) ||
    !/[A-Z]/.test(configured) ||
    !/\d/.test(configured) ||
    !/[^A-Za-z0-9]/.test(configured)
  ) {
    throw new Error(
      `${environmentName} debe configurarse en produccion con al menos 16 caracteres, mayuscula, minuscula, numero y simbolo; no se aceptan credenciales demo.`,
    );
  }

  return configured;
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
