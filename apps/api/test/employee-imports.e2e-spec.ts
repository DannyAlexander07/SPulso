import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Workbook } from 'exceljs';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/database/prisma.service';
import { SecurityValidationPipe } from './../src/security/security-validation.pipe';

type BatchBody = {
  id: string;
  importedRows: number;
  pendingRows: number;
  failedRows: number;
  rows: Array<{
    id: string;
    rowNumber: number;
    status: 'PENDING' | 'IMPORTED' | 'FAILED' | 'SKIPPED';
    version: number;
    errors: Array<{
      field: string;
      code: string;
      conflict?: {
        employeeId: string;
        employeeName: string;
        companyName: string;
      };
    }>;
  }>;
};

describe('Importacion persistente de trabajadores (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let workerToken: string;
  let companyId: string;
  let areaName: string;
  let positionName: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new SecurityValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
    adminToken = await login('admin@spulso.local', 'Admin1234.');
    workerToken = await login('trabajador@spulso.local', 'Trabajador123.');

    const company = await prisma.company.findFirstOrThrow({
      where: { slug: 'grupo-sp' },
      select: { id: true },
    });
    companyId = company.id;
    areaName = (
      await prisma.area.findFirstOrThrow({
        where: { companyId, status: 'ACTIVE' },
        select: { name: true },
      })
    ).name;
    positionName = (
      await prisma.jobPosition.findFirstOrThrow({
        where: {
          status: 'ACTIVE',
          OR: [{ companyId }, { scope: 'GROUP' }],
        },
        select: { name: true },
      })
    ).name;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return String((response.body as { accessToken: string }).accessToken);
  }

  it('reserva la importacion a employees.manage', async () => {
    await request(app.getHttpServer())
      .get('/trabajadores/importaciones/plantilla')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
  });

  it('no revela la ficha de otra empresa al detectar un DNI duplicado', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@spulso.local' },
      select: { tenantId: true },
    });
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        tenantId_name: { tenantId: admin.tenantId, name: 'RRHH' },
      },
      select: { id: true },
    });
    const email = `rrhh-scope-${Date.now()}@spulso.local`;
    await prisma.user.create({
      data: {
        companyId,
        email,
        firstName: 'RRHH',
        lastName: 'Alcance',
        passwordHash: await bcrypt.hash('Segura1234.', 10),
        roleId: role.id,
        status: 'ACTIVE',
        tenantId: admin.tenantId,
      },
    });
    const token = await login(email, 'Segura1234.');
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Trabajadores');
    sheet.addRow([
      'Nombres',
      'Apellidos',
      'DNI',
      'Correo personal',
      'Celular',
      'Dirección',
      'Área',
      'Cargo',
      'Equipo',
      'Jefe DNI o código',
      'Fecha ingreso',
      'Código trabajador',
      'PIN marcación',
    ]);
    sheet.addRow([
      'Dato',
      'Duplicado',
      '70000002',
      '',
      '',
      '',
      areaName,
      positionName,
      '',
      '',
      '2026-08-29',
      '',
      '582947',
    ]);
    const uploaded = await request(app.getHttpServer())
      .post('/trabajadores/importaciones')
      .set('Authorization', `Bearer ${token}`)
      .field('companyId', companyId)
      .attach('file', Buffer.from(await workbook.xlsx.writeBuffer()), {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `alcance-${Date.now()}.xlsx`,
      })
      .expect(201);
    const documentError = (uploaded.body as BatchBody).rows[0].errors.find(
      (error) => error.code === 'duplicate_document',
    );
    expect(documentError).toBeDefined();
    expect(documentError?.conflict).toBeUndefined();
  });

  it('persiste el lote, importa filas validas y permite corregir pendientes', async () => {
    const suffix = String(Date.now()).slice(-7);
    const firstDocument = `81${suffix}`;
    const correctedDocument = `82${suffix}`;
    const thirdDocument = `83${suffix}`;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Trabajadores');
    sheet.addRow([
      'Nombres',
      'Apellidos',
      'DNI / documento',
      'Correo personal',
      'Celular',
      'Dirección',
      'Área',
      'Cargo',
      'Equipo',
      'Jefe (DNI o código)',
      'Fecha de ingreso',
      'Código interno',
      'PIN marcación',
    ]);
    sheet.addRow([
      'Carga',
      'Valida',
      firstDocument,
      `valida-${suffix}@example.test`,
      '999111222',
      'Lima',
      areaName,
      positionName,
      '',
      '',
      '2026-08-29',
      '',
      '739284',
    ]);
    sheet.addRow([
      'Carga',
      'Duplicada',
      '70000001',
      '',
      '',
      '',
      areaName,
      positionName,
      '',
      '',
      '2026-08-29',
      '',
      '842739',
    ]);
    sheet.addRow([
      'Carga',
      '',
      thirdDocument,
      '',
      '',
      '',
      areaName,
      positionName,
      '',
      '',
      '2026-02-31',
      '',
      '928374',
    ]);
    const file = Buffer.from(await workbook.xlsx.writeBuffer());

    const uploaded = await request(app.getHttpServer())
      .post('/trabajadores/importaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('companyId', companyId)
      .attach('file', file, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `trabajadores-${suffix}.xlsx`,
      })
      .expect((response) => {
        if (response.status !== 201) {
          throw new Error(
            `Importacion rechazada: ${JSON.stringify(response.body)}`,
          );
        }
      })
      .expect(201);
    let batch = uploaded.body as BatchBody;

    expect(batch.importedRows).toBe(1);
    expect(batch.failedRows + batch.pendingRows).toBe(2);
    expect(batch.rows.find((row) => row.rowNumber === 3)?.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'documentNumber' }),
        expect.objectContaining({ field: 'attendancePin' }),
      ]),
    );
    expect(batch.rows.find((row) => row.rowNumber === 4)?.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'lastName' }),
        expect.objectContaining({ field: 'hireDate' }),
      ]),
    );

    const duplicateRow = batch.rows.find((row) => row.rowNumber === 3);
    expect(duplicateRow).toBeDefined();
    const correctedDuplicate = await request(app.getHttpServer())
      .patch(
        `/trabajadores/importaciones/${batch.id}/filas/${duplicateRow?.id}`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        attendancePin: '842739',
        data: { documentNumber: correctedDocument },
        version: duplicateRow?.version,
      })
      .expect(200);
    batch = correctedDuplicate.body as BatchBody;

    const missingRow = batch.rows.find((row) => row.rowNumber === 4);
    expect(missingRow).toBeDefined();
    const correctedMissing = await request(app.getHttpServer())
      .patch(`/trabajadores/importaciones/${batch.id}/filas/${missingRow?.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        attendancePin: '928374',
        data: { lastName: 'Corregida', hireDate: '2026-02-28' },
        version: missingRow?.version,
      })
      .expect(200);
    batch = correctedMissing.body as BatchBody;

    expect(batch.importedRows).toBe(3);
    expect(batch.failedRows).toBe(0);
    expect(batch.pendingRows).toBe(0);
    expect(
      await prisma.employee.count({
        where: {
          tenantId: (
            await prisma.company.findUniqueOrThrow({ where: { id: companyId } })
          ).tenantId,
          documentNumber: {
            in: [firstDocument, correctedDocument, thirdDocument],
          },
        },
      }),
    ).toBe(3);

    const repeated = await request(app.getHttpServer())
      .post('/trabajadores/importaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('companyId', companyId)
      .attach('file', file, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `trabajadores-${suffix}.xlsx`,
      })
      .expect(201);
    expect(
      (repeated.body as BatchBody & { duplicateUpload: boolean })
        .duplicateUpload,
    ).toBe(true);
    expect((repeated.body as BatchBody).id).toBe(batch.id);
  });

  it('bloquea temporalmente una cuenta despues de cinco intentos fallidos', async () => {
    const email = `lockout-${Date.now()}@spulso.local`;
    const admin = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@spulso.local' },
      select: { roleId: true, tenantId: true },
    });
    const passwordHash = await bcrypt.hash('Segura1234.', 10);
    const user = await prisma.user.create({
      data: {
        email,
        firstName: 'Prueba',
        lastName: 'Bloqueo',
        passwordHash,
        roleId: admin.roleId,
        status: 'ACTIVE',
        tenantId: admin.tenantId,
      },
      select: { id: true },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Errada1234.' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Segura1234.' })
      .expect(401);
    const locked = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { loginLockedUntil: true },
    });
    expect(locked.loginLockedUntil?.getTime()).toBeGreaterThan(Date.now());

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, loginLockedUntil: null },
    });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Segura1234.' })
      .expect(201);
  });

  it('acepta una sola correccion concurrente y no duplica trabajadores', async () => {
    const suffix = String(Date.now()).slice(-7);
    const documentNumber = `89${suffix}`;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Trabajadores');
    sheet.addRow([
      'Nombres',
      'Apellidos',
      'DNI',
      'Correo personal',
      'Celular',
      'Dirección',
      'Área',
      'Cargo',
      'Equipo',
      'Jefe DNI o código',
      'Fecha ingreso',
      'Código trabajador',
      'PIN marcación',
    ]);
    sheet.addRow([
      'Carrera',
      '',
      documentNumber,
      '',
      '',
      '',
      areaName,
      positionName,
      '',
      '',
      '2026-08-29',
      '',
      '672945',
    ]);
    const file = Buffer.from(await workbook.xlsx.writeBuffer());
    const uploaded = await request(app.getHttpServer())
      .post('/trabajadores/importaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('companyId', companyId)
      .attach('file', file, {
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: `concurrencia-${suffix}.xlsx`,
      })
      .expect(201);
    const batch = uploaded.body as BatchBody;
    const row = batch.rows[0];

    const corrections = await Promise.all([
      request(app.getHttpServer())
        .patch(`/trabajadores/importaciones/${batch.id}/filas/${row.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attendancePin: '672945',
          data: { lastName: 'Ganadora A' },
          version: row.version,
        }),
      request(app.getHttpServer())
        .patch(`/trabajadores/importaciones/${batch.id}/filas/${row.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attendancePin: '672945',
          data: { lastName: 'Ganadora B' },
          version: row.version,
        }),
    ]);

    expect(corrections.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const employees = await prisma.employee.findMany({
      where: { documentNumber },
      select: { lastName: true },
    });
    expect(employees).toHaveLength(1);
    expect(['Ganadora A', 'Ganadora B']).toContain(employees[0].lastName);
  });
});
