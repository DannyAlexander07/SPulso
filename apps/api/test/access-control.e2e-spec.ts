import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcryptjs';
import { AppModule } from './../src/app.module';
import { SecurityValidationPipe } from './../src/security/security-validation.pipe';
import { ExportJobsService } from './../src/modules/export-jobs/export-jobs.service';
import { PrismaService } from './../src/database/prisma.service';

type CompanyBody = { id: string; slug: string };
type CursorPageBody = {
  data: Array<{ id: string }>;
  meta: {
    hasNextPage: boolean;
    mode: 'cursor' | 'offset';
    nextCursor: string | null;
    total: number | null;
    totalPages: number | null;
  };
};
type EmployeeBody = { company: { id: string }; id: string };
type ErrorBody = { message: string };
type ExportJobBody = {
  errorMessage: string | null;
  fileName: string | null;
  id: string;
  rowCount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  type: 'EMPLOYEES' | 'DOCUMENTS' | 'REQUESTS' | 'USERS';
};
type LoginBody = { accessToken: string };
type MetricsBody = {
  database: 'ok';
  exportJobs: {
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    last24Hours: { completed: number; failed: number };
    pending: {
      oldestAgeMs: number;
      oldestCreatedAt: string | null;
      oldestJobId: string | null;
    };
    storage: { driver: string; retentionDays: number };
    worker: {
      apiWorkerEnabled: boolean;
      batchSize: number;
      intervalMs: number;
    };
  };
  status: 'ok';
  timestamp: string;
};
type OrganizationBody = {
  areas: Array<{ company: { id: string }; id: string; name: string }>;
  employees: Array<{ areaRef: { id: string } | null }>;
};
type EmployeeProfileBody = {
  employee: { company: { id: string }; id: string };
  timelineEvents: Array<{ title: string; type: string }>;
};
type PortalProfileBody = { employee: { id: string } };
type RoleBody = { id: string; name: string };
type UsersRolesBody = RoleBody[];
type EmployeesPageBody = { data: EmployeeBody[] };
type IdBody = { id: string };

describe('Accesos y seguridad basica (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let workerToken: string;
  let moodHrToken: string;
  let moodCompanyId: string;
  let infinityCompanyId: string;
  let rrhhRoleId: string;
  let superAdminRoleId: string;
  let exportJobsService: ExportJobsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new SecurityValidationPipe());
    await app.init();
    exportJobsService = app.get(ExportJobsService);
    prisma = app.get(PrismaService);

    adminToken = await login('admin@spulso.local', 'Admin1234.');
    workerToken = await login('trabajador@spulso.local', 'Trabajador123.');
    const roles = await request(app.getHttpServer())
      .get('/usuarios/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const rolesBody = roles.body as UsersRolesBody;
    const rrhhRole = rolesBody.find((role) => role.name === 'RRHH');
    const superAdminRole = rolesBody.find(
      (role) => role.name === 'Super Admin',
    );

    const companies = await request(app.getHttpServer())
      .get('/empresas')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const companiesBody = companies.body as CompanyBody[];
    moodCompanyId = companiesBody.find(
      (company) => company.slug === 'mood',
    )?.id;
    infinityCompanyId = companiesBody.find(
      (company) => company.slug === 'infinity',
    )?.id;

    expect(rrhhRole?.id).toEqual(expect.any(String));
    expect(superAdminRole?.id).toEqual(expect.any(String));
    expect(moodCompanyId).toEqual(expect.any(String));
    expect(infinityCompanyId).toEqual(expect.any(String));
    await prisma.employee.updateMany({
      where: { companyId: moodCompanyId, documentNumber: '70000002' },
      data: {
        attendancePinHash: await bcrypt.hash('839274', 10),
        attendancePinChangeRequired: false,
        attendancePinFailedAttempts: 0,
        attendancePinLockedUntil: null,
      },
    });
    superAdminRoleId = String(superAdminRole?.id);
    rrhhRoleId = String(rrhhRole?.id);

    const hrEmail = `rrhh-mood-${Date.now()}@spulso.local`;
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accessMode: 'admin',
        companyId: moodCompanyId,
        email: hrEmail,
        firstName: 'RRHH',
        lastName: 'Mood',
        password: 'Rrhh1234.',
        roleId: rrhhRole.id,
      })
      .expect(201);

    moodHrToken = await login(hrEmail, 'Rrhh1234.');
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const body = response.body as LoginBody;
    expect(body.accessToken).toEqual(expect.any(String));
    return body.accessToken;
  }

  async function waitForExportJob(jobId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await exportJobsService.processPendingJobs();
      const response = await request(app.getHttpServer())
        .get(`/exportaciones/${jobId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const body = response.body as ExportJobBody;

      if (body.status === 'COMPLETED' || body.status === 'FAILED') {
        return body;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    throw new Error('La exportacion no termino dentro del tiempo esperado.');
  }

  it('bloquea modulos administrativos sin token', async () => {
    await request(app.getHttpServer()).get('/trabajadores').expect(401);
    await request(app.getHttpServer())
      .get('/uploads/documentos/archivo.pdf')
      .expect(401);
  });

  it('expone metricas operativas de exportaciones', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/metrics')
      .expect(200);
    const body = response.body as MetricsBody;

    expect(body.status).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.exportJobs.byStatus).toHaveProperty('PENDING');
    expect(body.exportJobs.byStatus).toHaveProperty('PROCESSING');
    expect(body.exportJobs.byStatus).toHaveProperty('COMPLETED');
    expect(body.exportJobs.byStatus).toHaveProperty('FAILED');
    expect(body.exportJobs.byType).toHaveProperty('EMPLOYEES');
    expect(body.exportJobs.storage.driver).toEqual(expect.any(String));
    expect(body.exportJobs.worker.batchSize).toEqual(expect.any(Number));
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it('bloquea acceso directo del trabajador a rutas administrativas', async () => {
    await request(app.getHttpServer())
      .get('/usuarios/roles')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/trabajadores')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);

    for (const path of [
      '/beneficios',
      '/comunicados',
      '/documentos',
      '/documentos/exportar/zip',
      '/notificaciones',
    ]) {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(403);
    }

    await request(app.getHttpServer())
      .post('/solicitudes')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({})
      .expect(403);
  });

  it('reserva el estado firmado al flujo de firma y vuelve inmutable la evidencia', async () => {
    const profile = await request(app.getHttpServer())
      .get('/portal/perfil')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    const employeeId = (profile.body as PortalProfileBody).employee.id;

    await request(app.getHttpServer())
      .post('/documentos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ employeeId, status: 'SIGNED', title: 'Firma fabricada' })
      .expect(400);

    const uploaded = await request(app.getHttpServer())
      .post('/archivos/documentos')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from('%PDF-1.4\nSPulso\n%%EOF'), {
        contentType: 'application/pdf',
        filename: 'evidencia.pdf',
      })
      .expect(201);
    const uploadedBody = uploaded.body as { url: string };
    expect(uploadedBody.url).toContain('/uploads/documentos/');

    const created = await request(app.getHttpServer())
      .post('/documentos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        fileName: 'evidencia.pdf',
        fileUrl: uploadedBody.url,
        mimeType: 'application/pdf',
        requiresSignature: true,
        status: 'PENDING_SIGNATURE',
        title: `Evidencia firmable ${Date.now()}`,
      })
      .expect(201);
    const createdBody = created.body as IdBody;

    const signed = await request(app.getHttpServer())
      .patch(`/portal/documentos/${createdBody.id}/firmar`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ signatureText: 'Acepto el documento' })
      .expect(200);
    const signedBody = signed.body as {
      signedContentHash: string;
      status: string;
    };
    expect(signedBody.status).toBe('SIGNED');
    expect(signedBody.signedContentHash).toMatch(/^[a-f0-9]{64}$/);

    await request(app.getHttpServer())
      .patch(`/documentos/${createdBody.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Alteracion posterior' })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/documentos/${createdBody.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .post('/documentos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        employeeId,
        fileUrl: '/uploads/documentos/otro-tenant--archivo.pdf',
        title: 'Archivo sin pertenencia',
      })
      .expect(400);
  });

  it('permite al administrador entrar a modulos protegidos', async () => {
    const usersResponse = await request(app.getHttpServer())
      .get('/usuarios/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const usersBody = usersResponse.body as UsersRolesBody;
    expect(Array.isArray(usersBody)).toBe(true);

    const employeesResponse = await request(app.getHttpServer())
      .get('/trabajadores')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const employeesBody = employeesResponse.body as EmployeesPageBody;
    expect(Array.isArray(employeesBody.data)).toBe(true);
  });

  it('permite al trabajador entrar a su portal', async () => {
    const response = await request(app.getHttpServer())
      .get('/portal/perfil')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);

    const body = response.body as PortalProfileBody;
    expect(body.employee).toBeDefined();
  });

  it('limita usuarios administrativos no globales a su empresa', async () => {
    const scopedResponse = await request(app.getHttpServer())
      .get('/trabajadores')
      .set('Authorization', `Bearer ${moodHrToken}`)
      .expect(200);

    const scopedBody = scopedResponse.body as EmployeesPageBody;
    expect(scopedBody.data.length).toBeGreaterThan(0);
    expect(
      scopedBody.data.every(
        (employee) => employee.company.id === moodCompanyId,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/trabajadores?companyId=${infinityCompanyId}`)
      .set('Authorization', `Bearer ${moodHrToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/asistencia/hoy?companyId=${infinityCompanyId}`)
      .set('Authorization', `Bearer ${moodHrToken}`)
      .expect(403);
  });

  it('bloquea mutaciones cruzadas de trabajadores, organizacion y audiencias', async () => {
    const infinityEmployees = await request(app.getHttpServer())
      .get(`/trabajadores?companyId=${infinityCompanyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const infinityEmployee = (infinityEmployees.body as EmployeesPageBody)
      .data[0];

    expect(infinityEmployee?.id).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .patch(`/trabajadores/${infinityEmployee.id}`)
      .set('Authorization', `Bearer ${moodHrToken}`)
      .send({ firstName: 'Cambio ilegal' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/organizacion/areas')
      .set('Authorization', `Bearer ${moodHrToken}`)
      .send({ companyId: infinityCompanyId, name: 'Area fuera de alcance' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/organizacion/cargos')
      .set('Authorization', `Bearer ${moodHrToken}`)
      .send({ name: 'Cargo global ilegal', scope: 'GROUP' })
      .expect(400);

    const announcement = await request(app.getHttpServer())
      .post('/comunicados')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        audienceScope: 'ALL',
        message: 'Comunicado global de prueba de autorizacion.',
        title: `Comunicado global ${Date.now()}`,
      })
      .expect(201);
    const announcementBody = announcement.body as IdBody;

    await request(app.getHttpServer())
      .patch(`/comunicados/${announcementBody.id}`)
      .set('Authorization', `Bearer ${moodHrToken}`)
      .send({ title: 'Cambio ilegal' })
      .expect(400);

    const benefit = await request(app.getHttpServer())
      .post('/beneficios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        audienceScope: 'ALL',
        category: 'Seguridad',
        description: 'Beneficio global de prueba de autorizacion.',
        title: `Beneficio global ${Date.now()}`,
      })
      .expect(201);
    const benefitBody = benefit.body as IdBody;

    await request(app.getHttpServer())
      .patch(`/beneficios/${benefitBody.id}`)
      .set('Authorization', `Bearer ${moodHrToken}`)
      .send({ title: 'Cambio ilegal' })
      .expect(400);

    const rules = await request(app.getHttpServer())
      .get('/automatizaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const rule = (rules.body as IdBody[])[0];

    expect(rule?.id).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .patch(`/automatizaciones/${rule.id}`)
      .set('Authorization', `Bearer ${moodHrToken}`)
      .send({ enabled: false })
      .expect(403);
  });

  it('impide que un administrador de empresa escale roles o privilegios globales', async () => {
    const roleName = `Gestor local ${Date.now()}`;
    const roleResponse = await request(app.getHttpServer())
      .post('/usuarios/roles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: roleName,
        permissions: ['users.manage'],
      })
      .expect(201);
    const localRole = roleResponse.body as RoleBody;
    const localEmail = `gestor-local-${Date.now()}@spulso.local`;

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accessMode: 'admin',
        companyId: moodCompanyId,
        email: localEmail,
        firstName: 'Gestor',
        lastName: 'Local',
        password: 'Gestor1234.',
        roleId: localRole.id,
      })
      .expect(201);

    const localToken = await login(localEmail, 'Gestor1234.');

    await request(app.getHttpServer())
      .post('/usuarios/roles')
      .set('Authorization', `Bearer ${localToken}`)
      .send({ name: 'Escalada', permissions: ['users.manage'] })
      .expect(403);

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${localToken}`)
      .send({
        accessMode: 'admin',
        email: `global-${Date.now()}@spulso.local`,
        firstName: 'Global',
        lastName: 'Ilegal',
        password: 'Global1234.',
        roleId: superAdminRoleId,
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${localToken}`)
      .send({
        accessMode: 'admin',
        companyId: moodCompanyId,
        email: `rrhh-escalado-${Date.now()}@spulso.local`,
        firstName: 'RRHH',
        lastName: 'Escalado',
        password: 'Escalado1234.',
        roleId: rrhhRoleId,
      })
      .expect(403);
  });

  it('valida preferencias de tema y payloads peligrosos', async () => {
    await request(app.getHttpServer())
      .patch('/auth/theme')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ themePreference: 'cosmic' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@spulso.local',
        password: 'Admin1234.',
        constructor: { prototype: { admin: true } },
      })
      .expect(400);
  });

  it('rechaza formularios administrativos malformados', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: 'correo-no-valido',
        password: 'Admin1234.',
        firstName: 'Ana',
        lastName: 'Torres',
        roleId: 'rol-inexistente',
      })
      .expect(400)
      .expect(({ body }: { body: ErrorBody }) => {
        expect(String(body.message)).toContain('correo');
      });

    await request(app.getHttpServer())
      .post('/trabajadores')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyId: 'empresa-inexistente',
        firstName: 'A',
        lastName: 'Torres',
      })
      .expect(400)
      .expect(({ body }: { body: ErrorBody }) => {
        expect(String(body.message)).toContain('nombre');
      });
  });

  it('protege cambios estructurales con historial relacionado', async () => {
    const organization = await request(app.getHttpServer())
      .get('/organizacion')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const organizationBody = organization.body as OrganizationBody;
    const usedArea = organizationBody.areas.find((area) =>
      organizationBody.employees.some(
        (employee) => employee.areaRef?.id === area.id,
      ),
    );
    const targetCompanyId =
      usedArea?.company.id === moodCompanyId
        ? infinityCompanyId
        : moodCompanyId;

    expect(usedArea?.id).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .patch(`/organizacion/areas/${usedArea?.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ companyId: targetCompanyId })
      .expect(409)
      .expect(({ body }: { body: { code?: string; message?: unknown } }) => {
        const payload =
          typeof body.message === 'object' && body.message !== null
            ? (body.message as { code?: string; impacts?: unknown[] })
            : body;

        expect(payload.code).toBe('STRUCTURAL_IMPACT');
        expect(Array.isArray(payload.impacts)).toBe(true);
      });
  });

  it('registra transferencia controlada con evento historico', async () => {
    const employees = await request(app.getHttpServer())
      .get(`/trabajadores?companyId=${moodCompanyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const employeesBody = employees.body as EmployeesPageBody;
    const employee = employeesBody.data[0];

    expect(employee?.id).toEqual(expect.any(String));

    const transferred = await request(app.getHttpServer())
      .post(`/trabajadores/${employee.id}/transferir`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        companyId: infinityCompanyId,
        effectiveDate: '2026-06-25',
        reason: 'Transferencia e2e de control historico.',
      })
      .expect(201);
    const transferredBody = transferred.body as EmployeeBody;

    expect(transferredBody.company.id).toBe(infinityCompanyId);

    const profile = await request(app.getHttpServer())
      .get(`/trabajadores/${employee.id}/perfil`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const profileBody = profile.body as EmployeeProfileBody;

    expect(profileBody.employee.company.id).toBe(infinityCompanyId);
    expect(profileBody.timelineEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Transferencia laboral',
          type: 'TRANSFERRED',
        }),
      ]),
    );
  });

  it('exige GPS real en marcacion personal', async () => {
    await request(app.getHttpServer())
      .post('/asistencia/marcacion-personal')
      .send({
        tenantSlug: 'grupo-sp',
        companySlug: 'mood',
        identifier: '70000002',
        pin: '839274',
        action: 'CHECK_IN',
      })
      .expect(400)
      .expect(({ body }: { body: ErrorBody }) => {
        expect(String(body.message)).toContain('GPS');
      });
  });

  it('rechaza PIN debil y marcacion fuera de la geocerca', async () => {
    await request(app.getHttpServer())
      .post('/trabajadores/actualizar-pin-marcacion')
      .send({
        tenantSlug: 'grupo-sp',
        companySlug: 'mood',
        identifier: '70000002',
        currentPin: '839274',
        newPin: '9876',
      })
      .expect(400);

    await prisma.company.update({
      where: { id: moodCompanyId },
      data: {
        attendanceRadiusMeters: 100,
        enforceAttendanceGeofence: true,
        officeLatitude: -12.0464,
        officeLongitude: -77.0428,
      },
    });

    try {
      await request(app.getHttpServer())
        .post('/asistencia/marcacion-personal')
        .send({
          tenantSlug: 'grupo-sp',
          companySlug: 'mood',
          identifier: '70000002',
          pin: '839274',
          action: 'CHECK_IN',
          latitude: -16.409,
          longitude: -71.5375,
        })
        .expect(400)
        .expect(({ body }: { body: ErrorBody }) => {
          expect(String(body.message)).toContain('zona autorizada');
        });
    } finally {
      await prisma.company.update({
        where: { id: moodCompanyId },
        data: { enforceAttendanceGeofence: false },
      });
    }
  });

  it('bloquea temporalmente un PIN tras intentos fallidos distribuidos', async () => {
    const employee = await prisma.employee.findFirstOrThrow({
      where: { companyId: moodCompanyId, documentNumber: '70000002' },
      select: { id: true },
    });

    try {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await request(app.getHttpServer())
          .post('/asistencia/marcacion-personal')
          .send({
            action: 'CHECK_IN',
            companySlug: 'mood',
            identifier: '70000002',
            latitude: -12.0464,
            longitude: -77.0428,
            pin: '000001',
            tenantSlug: 'grupo-sp',
          })
          .expect(400);
      }

      await request(app.getHttpServer())
        .post('/asistencia/marcacion-personal')
        .send({
          action: 'CHECK_IN',
          companySlug: 'mood',
          identifier: '70000002',
          latitude: -12.0464,
          longitude: -77.0428,
          pin: '839274',
          tenantSlug: 'grupo-sp',
        })
        .expect(400);

      const locked = await prisma.employee.findUniqueOrThrow({
        where: { id: employee.id },
        select: { attendancePinLockedUntil: true },
      });
      expect(locked.attendancePinLockedUntil?.getTime()).toBeGreaterThan(
        Date.now(),
      );
    } finally {
      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          attendancePinFailedAttempts: 0,
          attendancePinLockedUntil: null,
        },
      });
    }
  });

  it('serializa intentos concurrentes de PIN antes de validar bcrypt', async () => {
    const employee = await prisma.employee.findFirstOrThrow({
      where: { companyId: moodCompanyId, documentNumber: '70000002' },
      select: { id: true },
    });

    try {
      const attempts = await Promise.all(
        Array.from({ length: 12 }, (_item, index) =>
          request(app.getHttpServer())
            .post('/asistencia/marcacion-personal')
            .send({
              action: 'CHECK_IN',
              companySlug: 'mood',
              identifier: '70000002',
              latitude: -12.0464,
              longitude: -77.0428,
              pin: String(100_000 + index),
              tenantSlug: 'grupo-sp',
            }),
        ),
      );
      expect(attempts.every((response) => response.status === 400)).toBe(true);

      const locked = await prisma.employee.findUniqueOrThrow({
        where: { id: employee.id },
        select: { attendancePinLockedUntil: true },
      });
      expect(locked.attendancePinLockedUntil?.getTime()).toBeGreaterThan(
        Date.now(),
      );
    } finally {
      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          attendancePinFailedAttempts: 0,
          attendancePinLockedUntil: null,
        },
      });
    }
  });

  it('exige empresa en marcacion personal publica', async () => {
    await request(app.getHttpServer())
      .post('/asistencia/marcacion-personal')
      .send({
        identifier: '70000002',
        pin: '839274',
        action: 'CHECK_IN',
      })
      .expect(400)
      .expect(({ body }: { body: ErrorBody }) => {
        expect(String(body.message)).toContain('empresa');
      });
  });

  it('limita rangos de asistencia para evitar consultas masivas', async () => {
    await request(app.getHttpServer())
      .get('/asistencia/rango?from=2026-01-01&to=2026-03-15')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400)
      .expect(({ body }: { body: ErrorBody }) => {
        expect(String(body.message)).toContain('31 dias');
      });
  });

  it('soporta paginacion por cursor en modulos grandes', async () => {
    const firstPage = await request(app.getHttpServer())
      .get('/trabajadores?pageSize=5&pagination=cursor')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const firstPageBody = firstPage.body as CursorPageBody;
    expect(firstPageBody.data).toHaveLength(5);
    expect(firstPageBody.meta.mode).toBe('cursor');
    expect(firstPageBody.meta.total).toBeNull();
    expect(firstPageBody.meta.totalPages).toBeNull();
    expect(firstPageBody.meta.nextCursor).toEqual(expect.any(String));

    const cursor = firstPageBody.data.at(-1)?.id;
    expect(cursor).toEqual(expect.any(String));
    const secondPage = await request(app.getHttpServer())
      .get(`/trabajadores?pageSize=5&cursor=${cursor}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const secondPageBody = secondPage.body as CursorPageBody;
    expect(secondPageBody.meta.mode).toBe('cursor');
    expect(secondPageBody.meta.total).toBeNull();
    expect(secondPageBody.meta.totalPages).toBeNull();
    expect(secondPageBody.meta).toHaveProperty('hasNextPage');
    expect(secondPageBody.meta).toHaveProperty('nextCursor');
    expect(secondPageBody.data.some((employee) => employee.id === cursor)).toBe(
      false,
    );
  });

  it('genera y descarga exportaciones en segundo plano con permisos', async () => {
    await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ filters: {}, type: 'EMPLOYEES' })
      .expect(403);

    const created = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ filters: { status: 'ACTIVE' }, type: 'EMPLOYEES' })
      .expect(201);
    const createdBody = created.body as ExportJobBody;

    await request(app.getHttpServer())
      .get(`/exportaciones/${createdBody.id}`)
      .set('Authorization', `Bearer ${moodHrToken}`)
      .expect(404);

    expect(createdBody.id).toEqual(expect.any(String));
    expect(createdBody.type).toBe('EMPLOYEES');
    expect(['PENDING', 'PROCESSING']).toContain(createdBody.status);

    const completed = await waitForExportJob(createdBody.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.fileName).toMatch(/^spulso-trabajadores-/);
    expect(completed.rowCount).toBeGreaterThan(0);
    expect(completed.errorMessage).toBeNull();

    await request(app.getHttpServer())
      .get(`/exportaciones/${createdBody.id}/descargar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect('content-type', /text\/csv|application\/octet-stream/)
      .expect(({ text }) => {
        expect(text).toContain('"Nombres";');
        expect(text).toContain('"Empresa";');
      });
  });

  it('reclama cada exportacion pendiente una sola vez', async () => {
    const first = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        filters: { search: 'reclamo-primero', status: 'ACTIVE' },
        type: 'EMPLOYEES',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        filters: { search: 'reclamo-primero', status: 'ACTIVE' },
        type: 'EMPLOYEES',
      })
      .expect(400);

    const second = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        filters: { search: 'reclamo-segundo', status: 'ACTIVE' },
        type: 'EMPLOYEES',
      })
      .expect(201);
    const firstBody = first.body as ExportJobBody;
    const secondBody = second.body as ExportJobBody;

    const claimed = await Promise.all([
      exportJobsService.claimNextPendingJobId(),
      exportJobsService.claimNextPendingJobId(),
    ]);

    expect(new Set(claimed).size).toBe(2);
    expect(claimed).toEqual(
      expect.arrayContaining([firstBody.id, secondBody.id]),
    );

    await Promise.all(
      claimed.map((jobId) => exportJobsService.processJob(String(jobId))),
    );

    const completed = await Promise.all([
      waitForExportJob(firstBody.id),
      waitForExportJob(secondBody.id),
    ]);

    expect(completed.every((job) => job.status === 'COMPLETED')).toBe(true);
  });

  it('limpia archivos de exportaciones vencidas por retencion', async () => {
    const created = await request(app.getHttpServer())
      .post('/exportaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        filters: { search: 'retencion-vencida', status: 'ACTIVE' },
        type: 'EMPLOYEES',
      })
      .expect(201);
    const createdBody = created.body as ExportJobBody;
    const completed = await waitForExportJob(createdBody.id);

    expect(completed.status).toBe('COMPLETED');

    await prisma.exportJob.update({
      where: { id: createdBody.id },
      data: { completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    });

    const removed = await exportJobsService.cleanupExpiredFiles(1);
    expect(removed).toBeGreaterThanOrEqual(1);

    await request(app.getHttpServer())
      .get(`/exportaciones/${createdBody.id}/descargar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('revoca el token en logout y no solo borra la cookie del navegador', async () => {
    const email = `sesion-revocable-${Date.now()}@spulso.local`;
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        accessMode: 'admin',
        companyId: moodCompanyId,
        email,
        firstName: 'Sesion',
        lastName: 'Revocable',
        password: 'Sesion1234.',
        roleId: rrhhRoleId,
      })
      .expect(201);
    const token = await login(email, 'Sesion1234.');

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });
});
