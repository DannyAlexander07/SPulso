import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  EmployeeImportBatchStatus,
  EmployeeImportRowStatus,
  EmployeeStatus,
  EmployeeTimelineEventType,
  Prisma,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Workbook, type Cell } from 'exceljs';
import { basename, extname } from 'path';
import * as yauzl from 'yauzl';
import { PrismaService } from '../../database/prisma.service';
import {
  assertCompanyAccess,
  hasGlobalCompanyAccess,
  scopedCompanyId,
} from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';
import { MalwareScanService } from '../../security/malware-scan.service';

const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 10 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 300;
const MAX_ROWS = 1_000;
const MAX_COLUMNS = 14;
const IMPORTED_PII_RETENTION_DAYS = 30;
const PENDING_PII_RETENTION_DAYS = 90;

const importFields = [
  'firstName',
  'lastName',
  'documentNumber',
  'personalEmail',
  'phoneMobile',
  'address',
  'area',
  'position',
  'team',
  'managerReference',
  'hireDate',
  'employeeCode',
] as const;

type ImportField = (typeof importFields)[number];
type ImportRowData = Record<ImportField, string>;
type ImportErrorField = ImportField | 'attendancePin' | 'row';

type ImportRowError = {
  field: ImportErrorField;
  code: string;
  message: string;
  conflict?: {
    employeeId: string;
    employeeName: string;
    companyName: string;
  };
};

type ParsedRow = {
  rowNumber: number;
  rawData: ImportRowData;
  attendancePin: string;
  parseErrors: ImportRowError[];
};

type PreparedEmployee = {
  tenantId: string;
  companyId: string;
  areaId: string;
  positionId: string;
  teamId: string | null;
  managerId: string | null;
  firstName: string;
  lastName: string;
  documentNumber: string;
  personalEmail: string | null;
  phoneMobile: string | null;
  address: string | null;
  hireDate: Date | null;
  employeeCode: string | null;
  attendancePin: string;
};

type UpdateImportRowInput = {
  version?: unknown;
  data?: Partial<Record<ImportField, unknown>>;
  attendancePin?: unknown;
};

const headerAliases: Record<string, ImportField | 'attendancePin'> = {
  nombres: 'firstName',
  nombre: 'firstName',
  apellidos: 'lastName',
  apellido: 'lastName',
  dni: 'documentNumber',
  dni_documento: 'documentNumber',
  documento: 'documentNumber',
  numero_documento: 'documentNumber',
  correo_personal: 'personalEmail',
  correo: 'personalEmail',
  email: 'personalEmail',
  celular: 'phoneMobile',
  telefono: 'phoneMobile',
  direccion: 'address',
  area: 'area',
  cargo: 'position',
  equipo: 'team',
  jefe_dni_o_codigo: 'managerReference',
  jefe: 'managerReference',
  fecha_ingreso: 'hireDate',
  fecha_de_ingreso: 'hireDate',
  ingreso: 'hireDate',
  codigo_trabajador: 'employeeCode',
  codigo_interno: 'employeeCode',
  codigo: 'employeeCode',
  pin_marcacion: 'attendancePin',
  pin_de_marcacion: 'attendancePin',
  pin: 'attendancePin',
};

@Injectable()
export class EmployeeImportsService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly malwareScan: MalwareScanService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.cleanupTimer = setInterval(
      () => void this.redactExpiredRows().catch(() => undefined),
      6 * 60 * 60 * 1000,
    );
    this.cleanupTimer.unref();
    void this.redactExpiredRows().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async buildTemplate(companyName?: string) {
    const workbook = new Workbook();
    workbook.creator = 'SPulso';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Trabajadores', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'Nombres', key: 'firstName', width: 22 },
      { header: 'Apellidos', key: 'lastName', width: 24 },
      { header: 'DNI', key: 'documentNumber', width: 16 },
      { header: 'Correo personal', key: 'personalEmail', width: 30 },
      { header: 'Celular', key: 'phoneMobile', width: 18 },
      { header: 'Dirección', key: 'address', width: 34 },
      { header: 'Área', key: 'area', width: 22 },
      { header: 'Cargo', key: 'position', width: 24 },
      { header: 'Equipo', key: 'team', width: 22 },
      { header: 'Jefe DNI o código', key: 'managerReference', width: 22 },
      { header: 'Fecha ingreso', key: 'hireDate', width: 17 },
      { header: 'Código trabajador', key: 'employeeCode', width: 20 },
      { header: 'PIN marcación', key: 'attendancePin', width: 18 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' },
    };
    sheet.getRow(1).height = 24;
    sheet.autoFilter = { from: 'A1', to: 'M1' };
    sheet.getColumn(3).numFmt = '@';
    sheet.getColumn(12).numFmt = '@';
    sheet.getColumn(13).numFmt = '@';

    const instructions = workbook.addWorksheet('Instrucciones');
    instructions.columns = [{ width: 120 }];
    [
      'Plantilla de importación masiva de trabajadores SPulso',
      `Empresa seleccionada: ${companyName ?? 'se define antes de subir el archivo'}`,
      'Obligatorios: nombres, apellidos, DNI, área, cargo y PIN de marcación.',
      'El PIN debe tener 6 a 8 dígitos y no se guarda en texto plano.',
      'DNI, código y PIN deben mantenerse como texto para conservar ceros iniciales.',
      'No uses fórmulas, macros, enlaces externos ni cambies los encabezados.',
      'Las filas correctas se crean; las incompletas quedan en Bandeja de pendientes.',
      'La importación solo crea fichas laborales. Los accesos de usuario se crean desde Usuarios y roles.',
    ].forEach((value, index) => {
      instructions.getCell(index + 1, 1).value = value;
    });
    instructions.getCell(1, 1).font = { bold: true, size: 14 };

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async upload(
    actor: AuthUser,
    companyIdValue: unknown,
    file?: Express.Multer.File,
  ) {
    const companyId = this.requireString(
      companyIdValue,
      'Selecciona la empresa.',
    );
    assertCompanyAccess(actor, companyId);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId: actor.tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
    });

    if (!company) {
      throw new BadRequestException(
        'La empresa seleccionada no existe o no está activa.',
      );
    }

    this.assertWorkbookFile(file);
    await this.malwareScan.scanBuffer(file!.buffer);
    await preflightXlsxArchive(file!.buffer);
    const fileHash = createHash('sha256').update(file!.buffer).digest('hex');
    const existing = await this.findExistingBatch(actor, companyId, fileHash);
    if (existing) {
      return { ...(await this.get(actor, existing.id)), duplicateUpload: true };
    }

    const parsedRows = await this.parseWorkbook(file!.buffer);
    if (parsedRows.length === 0) {
      throw new BadRequestException(
        'El Excel no contiene trabajadores para importar.',
      );
    }

    const originalFileName = safeFileName(file!.originalname);
    let batchId: string;

    try {
      const batch = await this.prisma.$transaction(async (tx) => {
        const created = await tx.employeeImportBatch.create({
          data: {
            tenantId: actor.tenantId,
            companyId,
            createdByUserId: actor.sub,
            originalFileName,
            fileHash,
            status: EmployeeImportBatchStatus.PROCESSING,
            totalRows: parsedRows.length,
            pendingRows: parsedRows.length,
          },
          select: { id: true },
        });

        await tx.employeeImportRow.createMany({
          data: parsedRows.map((row) => ({
            batchId: created.id,
            rowNumber: row.rowNumber,
            status: EmployeeImportRowStatus.PENDING,
            rawData: toJson(row.rawData),
            errors: toJson(row.parseErrors),
          })),
        });

        return created;
      });
      batchId = batch.id;
    } catch (error) {
      if (isUniqueConflict(error)) {
        const concurrent = await this.findExistingBatch(
          actor,
          companyId,
          fileHash,
        );
        if (concurrent) {
          return {
            ...(await this.get(actor, concurrent.id)),
            duplicateUpload: true,
          };
        }
      }
      throw error;
    }

    const pinByRow = new Map(
      parsedRows.map((row) => [row.rowNumber, row.attendancePin]),
    );
    for (const pass of [1, 2]) {
      const rows = await this.prisma.employeeImportRow.findMany({
        where: { batchId, status: EmployeeImportRowStatus.PENDING },
        orderBy: { rowNumber: 'asc' },
        select: { id: true, rowNumber: true },
      });

      for (const row of rows) {
        await this.processRow(
          actor,
          batchId,
          row.id,
          pinByRow.get(row.rowNumber),
          pass === 2,
        );
      }
    }

    await this.writeBatchAudit(actor, batchId, companyId, originalFileName);
    return { ...(await this.get(actor, batchId)), duplicateUpload: false };
  }

  async list(actor: AuthUser) {
    await this.redactExpiredRows(actor.tenantId);
    const companyId = scopedCompanyId(actor);
    return this.prisma.employeeImportBatch.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(companyId ? { companyId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: batchSummarySelect,
    });
  }

  async get(actor: AuthUser, batchIdValue: unknown) {
    const batchId = this.requireString(
      batchIdValue,
      'La importación es obligatoria.',
    );
    await this.redactExpiredRows(actor.tenantId);
    const companyId = scopedCompanyId(actor);
    const batch = await this.prisma.employeeImportBatch.findFirst({
      where: {
        id: batchId,
        tenantId: actor.tenantId,
        ...(companyId ? { companyId } : {}),
      },
      select: {
        ...batchSummarySelect,
        rows: {
          orderBy: { rowNumber: 'asc' },
          select: importRowSelect,
        },
      },
    });

    if (!batch) {
      throw new NotFoundException('La importación no existe.');
    }
    assertCompanyAccess(actor, batch.company.id);
    return batch;
  }

  async updateRow(
    actor: AuthUser,
    batchIdValue: unknown,
    rowIdValue: unknown,
    input: UpdateImportRowInput,
  ) {
    const batchId = this.requireString(
      batchIdValue,
      'La importación es obligatoria.',
    );
    const rowId = this.requireString(rowIdValue, 'La fila es obligatoria.');
    const version = Number(input.version);
    if (!Number.isInteger(version) || version < 0) {
      throw new BadRequestException('La versión de la fila no es válida.');
    }

    const current = await this.findAuthorizedRow(actor, batchId, rowId);
    if (current.status === EmployeeImportRowStatus.IMPORTED) {
      throw new ConflictException(
        'La fila ya fue importada y no puede modificarse.',
      );
    }
    if (current.status === EmployeeImportRowStatus.SKIPPED) {
      throw new ConflictException(
        'La fila fue omitida. Restáurala antes de corregirla.',
      );
    }

    const patch = normalizePatch(input.data);
    const merged = { ...asImportRowData(current.rawData), ...patch };
    const changed = await this.prisma.employeeImportRow.updateMany({
      where: { id: rowId, batchId, version },
      data: {
        rawData: toJson(merged),
        normalizedData: Prisma.JsonNull,
        errors: toJson([]),
        status: EmployeeImportRowStatus.PENDING,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) {
      throw new ConflictException(
        'La fila cambió en otra ventana. Recarga e inténtalo otra vez.',
      );
    }
    await this.recountBatch(this.prisma, batchId);
    await this.processRow(
      actor,
      batchId,
      rowId,
      toStringValue(input.attendancePin),
      true,
    );
    return this.get(actor, batchId);
  }

  async retry(actor: AuthUser, batchIdValue: unknown) {
    const batch = await this.get(actor, batchIdValue);
    const rows = batch.rows.filter(
      (row) =>
        row.status === EmployeeImportRowStatus.PENDING ||
        row.status === EmployeeImportRowStatus.FAILED,
    );
    for (const row of rows) {
      if (row.status === EmployeeImportRowStatus.FAILED) {
        await this.prisma.employeeImportRow.updateMany({
          where: {
            id: row.id,
            version: row.version,
            status: EmployeeImportRowStatus.FAILED,
          },
          data: {
            status: EmployeeImportRowStatus.PENDING,
            version: { increment: 1 },
          },
        });
      }
      await this.processRow(actor, batch.id, row.id, undefined, true);
    }
    return this.get(actor, batch.id);
  }

  async skip(actor: AuthUser, batchIdValue: unknown, rowIdValue: unknown) {
    const batchId = this.requireString(
      batchIdValue,
      'La importación es obligatoria.',
    );
    const rowId = this.requireString(rowIdValue, 'La fila es obligatoria.');
    const row = await this.findAuthorizedRow(actor, batchId, rowId);
    if (row.status === EmployeeImportRowStatus.IMPORTED) {
      throw new ConflictException('Una fila importada no puede omitirse.');
    }
    await this.prisma.$transaction(async (tx) => {
      const skipped = await tx.employeeImportRow.updateMany({
        where: { id: rowId, version: row.version, status: row.status },
        data: {
          status: EmployeeImportRowStatus.SKIPPED,
          version: { increment: 1 },
        },
      });
      if (skipped.count !== 1)
        throw new ConflictException(
          'La fila cambió en otra ventana. Recarga e inténtalo otra vez.',
        );
      await this.recountBatch(tx, batchId);
    });
    return this.get(actor, batchId);
  }

  private async parseWorkbook(buffer: Buffer) {
    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as never, {
      ignoreNodes: ['dataValidations', 'drawing', 'picture'],
    });
    if (workbook.worksheets.length === 0 || workbook.worksheets.length > 3) {
      throw new BadRequestException(
        'El Excel debe contener la hoja Trabajadores y, como máximo, hojas auxiliares.',
      );
    }
    const sheet =
      workbook.getWorksheet('Trabajadores') ?? workbook.worksheets[0];
    if (
      sheet.actualRowCount > MAX_ROWS + 1 ||
      sheet.actualColumnCount > MAX_COLUMNS
    ) {
      throw new BadRequestException(
        `El Excel admite hasta ${MAX_ROWS} trabajadores y ${MAX_COLUMNS} columnas.`,
      );
    }

    const headers = new Map<number, ImportField | 'attendancePin'>();
    sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
      const key = normalizeHeader(cellToText(cell));
      const field = headerAliases[key];
      if (!field) {
        throw new BadRequestException(
          `La columna "${cell.text}" no pertenece a la plantilla.`,
        );
      }
      if ([...headers.values()].includes(field)) {
        throw new BadRequestException(`La columna ${cell.text} está repetida.`);
      }
      headers.set(column, field);
    });

    for (const required of [
      'firstName',
      'lastName',
      'documentNumber',
      'area',
      'position',
      'attendancePin',
    ] as const) {
      if (![...headers.values()].includes(required)) {
        throw new BadRequestException(
          `Falta la columna obligatoria ${requiredHeaderLabel(required)}.`,
        );
      }
    }

    const rows: ParsedRow[] = [];
    for (let rowNumber = 2; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const rawData = emptyImportRowData();
      const parseErrors: ImportRowError[] = [];
      let attendancePin = '';

      for (const [column, field] of headers) {
        const cell = row.getCell(column);
        if (hasFormula(cell)) {
          parseErrors.push({
            field: field === 'attendancePin' ? 'attendancePin' : field,
            code: 'formula',
            message: 'No se permiten fórmulas en la importación.',
          });
          continue;
        }
        const value =
          field === 'hireDate' ? dateCellToText(cell) : cellToText(cell);
        if (field === 'attendancePin') attendancePin = value;
        else rawData[field] = value;
      }

      if (
        Object.values(rawData).every((value) => value === '') &&
        attendancePin === ''
      )
        continue;
      rows.push({ rowNumber, rawData, attendancePin, parseErrors });
    }
    return rows;
  }

  private async processRow(
    actor: AuthUser,
    batchId: string,
    rowId: string,
    attendancePin?: string,
    finalPass = true,
  ) {
    const row = await this.findAuthorizedRow(actor, batchId, rowId);
    if (
      row.status !== EmployeeImportRowStatus.PENDING &&
      row.status !== EmployeeImportRowStatus.FAILED
    )
      return;
    const rawData = asImportRowData(row.rawData);
    const parseErrors = asImportErrors(row.errors).filter(
      (error) => error.code === 'formula',
    );
    const result = await this.validateRow(
      actor,
      row.batch,
      rawData,
      attendancePin,
      parseErrors,
    );

    if (result.errors.length > 0 || !result.prepared) {
      const errors = [...result.errors];
      if (
        finalPass &&
        !errors.some((error) => error.field === 'attendancePin')
      ) {
        errors.push({
          field: 'attendancePin',
          code: 'reenter_required',
          message:
            'Vuelve a ingresar el PIN al corregir esta fila; SPulso no guarda PIN en texto plano.',
        });
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.employeeImportRow.updateMany({
          where: { id: rowId, version: row.version, status: row.status },
          data: {
            status: EmployeeImportRowStatus.PENDING,
            normalizedData: result.normalized
              ? toJson(result.normalized)
              : Prisma.JsonNull,
            errors: toJson(errors),
            version: { increment: 1 },
          },
        });
        await this.recountBatch(tx, batchId);
      });
      return;
    }

    try {
      await this.commitImportedRow(actor, row, result.prepared);
    } catch (error) {
      const conflict = await this.mapCommitError(
        actor,
        row.batch,
        rawData,
        error,
      );
      await this.prisma.$transaction(async (tx) => {
        await tx.employeeImportRow.updateMany({
          where: { id: rowId, version: row.version, status: row.status },
          data: {
            status: conflict
              ? EmployeeImportRowStatus.PENDING
              : EmployeeImportRowStatus.FAILED,
            normalizedData: result.normalized
              ? toJson(result.normalized)
              : Prisma.JsonNull,
            errors: toJson(
              conflict
                ? [conflict]
                : [
                    {
                      field: 'row',
                      code: 'internal_error',
                      message:
                        'La fila no pudo procesarse. Reintenta o solicita revisión técnica.',
                    },
                  ],
            ),
            version: { increment: 1 },
          },
        });
        await this.recountBatch(tx, batchId);
      });
    }
  }

  private async validateRow(
    actor: AuthUser,
    batch: {
      id: string;
      tenantId: string;
      companyId: string;
      company: { id: string; name: string; slug: string };
    },
    raw: ImportRowData,
    attendancePin: string | undefined,
    initialErrors: ImportRowError[],
  ) {
    assertCompanyAccess(actor, batch.companyId);
    const errors = [...initialErrors];
    const firstName = normalizeName(raw.firstName, 'firstName', errors);
    const lastName = normalizeName(raw.lastName, 'lastName', errors);
    const documentNumber = normalizeDocument(raw.documentNumber, errors);
    const personalEmail = normalizeEmail(raw.personalEmail, errors);
    const phoneMobile = normalizePhone(raw.phoneMobile, errors);
    const address = normalizeLabel(raw.address, 240, 'address', errors);
    const employeeCode = normalizeCode(raw.employeeCode, errors);
    const hireDate = normalizeDate(raw.hireDate, errors);
    const pin = normalizePin(attendancePin, errors);

    const [
      area,
      position,
      team,
      manager,
      duplicateDocument,
      duplicateEmail,
      duplicateCode,
    ] = await Promise.all([
      this.resolveArea(batch, raw.area),
      this.resolvePosition(batch, raw.position),
      this.resolveTeam(batch, raw.team),
      this.resolveManager(batch, raw.managerReference),
      documentNumber
        ? this.findDuplicate({
            tenantId_documentNumber: {
              tenantId: batch.tenantId,
              documentNumber,
            },
          })
        : null,
      personalEmail
        ? this.findDuplicate({
            tenantId_personalEmail: { tenantId: batch.tenantId, personalEmail },
          })
        : null,
      employeeCode
        ? this.findDuplicate({
            companyId_employeeCode: {
              companyId: batch.companyId,
              employeeCode,
            },
          })
        : null,
    ]);

    if (!area)
      errors.push({
        field: 'area',
        code: 'not_found',
        message: 'El área no existe en la empresa seleccionada.',
      });
    if (!position)
      errors.push({
        field: 'position',
        code: 'not_found',
        message: 'El cargo no existe en la empresa o el grupo.',
      });
    if (raw.team && !team)
      errors.push({
        field: 'team',
        code: 'not_found',
        message: 'El equipo no existe en la empresa seleccionada.',
      });
    if (raw.managerReference && !manager)
      errors.push({
        field: 'managerReference',
        code: 'not_found',
        message: 'No encontramos al jefe por DNI o código en esta empresa.',
      });
    if (duplicateDocument)
      errors.push(
        duplicateError(
          'documentNumber',
          'duplicate_document',
          'El DNI ya está registrado.',
          duplicateDocument,
          hasGlobalCompanyAccess(actor) ||
            actor.companyId === duplicateDocument.company.id,
        ),
      );
    if (duplicateEmail)
      errors.push(
        duplicateError(
          'personalEmail',
          'duplicate_email',
          'El correo ya está registrado.',
          duplicateEmail,
          hasGlobalCompanyAccess(actor) ||
            actor.companyId === duplicateEmail.company.id,
        ),
      );
    if (duplicateCode)
      errors.push(
        duplicateError(
          'employeeCode',
          'duplicate_code',
          'El código ya está registrado en esta empresa.',
          duplicateCode,
          true,
        ),
      );

    const normalized = {
      ...raw,
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      documentNumber: documentNumber ?? '',
      personalEmail: personalEmail ?? '',
      phoneMobile: phoneMobile ?? '',
      address: address ?? '',
      employeeCode: employeeCode ?? '',
      hireDate: hireDate ? hireDate.toISOString().slice(0, 10) : '',
      companyId: batch.companyId,
      areaId: area?.id ?? null,
      positionId: position?.id ?? null,
      teamId: team?.id ?? null,
      managerId: manager?.id ?? null,
    };

    if (
      errors.length ||
      !firstName ||
      !lastName ||
      !documentNumber ||
      !area ||
      !position ||
      !pin
    ) {
      return { errors, normalized, prepared: null };
    }
    return {
      errors,
      normalized,
      prepared: {
        tenantId: batch.tenantId,
        companyId: batch.companyId,
        areaId: area.id,
        positionId: position.id,
        teamId: team?.id ?? null,
        managerId: manager?.id ?? null,
        firstName,
        lastName,
        documentNumber,
        personalEmail,
        phoneMobile,
        address,
        hireDate,
        employeeCode,
        attendancePin: pin,
      } satisfies PreparedEmployee,
    };
  }

  private async commitImportedRow(
    actor: AuthUser,
    row: Awaited<ReturnType<EmployeeImportsService['findAuthorizedRow']>>,
    prepared: PreparedEmployee,
  ) {
    const attendancePinHash = await bcrypt.hash(prepared.attendancePin, 10);
    await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.employeeImportRow.findUnique({
          where: { id: row.id },
          select: { id: true, status: true, version: true },
        });
        if (
          !current ||
          current.version !== row.version ||
          current.status !== row.status ||
          (current.status !== EmployeeImportRowStatus.PENDING &&
            current.status !== EmployeeImportRowStatus.FAILED)
        ) {
          throw new ConflictException('La fila ya fue procesada.');
        }

        const employeeCode =
          prepared.employeeCode ??
          (await this.generateEmployeeCode(tx, row.batch.company));
        const employee = await tx.employee.create({
          data: {
            tenantId: prepared.tenantId,
            companyId: prepared.companyId,
            areaId: prepared.areaId,
            positionId: prepared.positionId,
            teamId: prepared.teamId,
            managerId: prepared.managerId,
            firstName: prepared.firstName,
            lastName: prepared.lastName,
            documentNumber: prepared.documentNumber,
            personalEmail: prepared.personalEmail,
            phoneMobile: prepared.phoneMobile,
            address: prepared.address,
            hireDate: prepared.hireDate,
            employeeCode,
            attendancePinHash,
            attendancePinChangeRequired: true,
            attendancePinFailedAttempts: 0,
            attendancePinLockedUntil: null,
            status: EmployeeStatus.ACTIVE,
          },
          select: { id: true, createdAt: true },
        });

        const snapshot = {
          id: employee.id,
          firstName: prepared.firstName,
          lastName: prepared.lastName,
          documentNumber: prepared.documentNumber,
          personalEmail: prepared.personalEmail,
          phoneMobile: prepared.phoneMobile,
          address: prepared.address,
          employeeCode,
          companyId: prepared.companyId,
          areaId: prepared.areaId,
          positionId: prepared.positionId,
          teamId: prepared.teamId,
          managerId: prepared.managerId,
          hireDate: prepared.hireDate?.toISOString().slice(0, 10) ?? null,
          importBatchId: row.batch.id,
          importRowNumber: row.rowNumber,
        };

        await tx.auditLog.create({
          data: {
            tenantId: prepared.tenantId,
            companyId: prepared.companyId,
            actorType: 'user',
            actorLabel: actor.email,
            action: 'employee.imported',
            entityType: 'Employee',
            entityId: employee.id,
            summary: `Se importó el trabajador ${prepared.firstName} ${prepared.lastName} desde Excel.`,
            after: toJson(snapshot),
          },
        });
        await tx.employeeTimelineEvent.create({
          data: {
            tenantId: prepared.tenantId,
            employeeId: employee.id,
            companyId: prepared.companyId,
            areaId: prepared.areaId,
            positionId: prepared.positionId,
            teamId: prepared.teamId,
            managerId: prepared.managerId,
            type: EmployeeTimelineEventType.HIRED,
            title: 'Ingreso importado desde Excel',
            description: `${prepared.firstName} ${prepared.lastName} ingresó a ${row.batch.company.name}.`,
            effectiveDate: prepared.hireDate ?? employee.createdAt,
            newData: toJson(snapshot),
            createdBy: actor.email,
          },
        });
        const transitioned = await tx.employeeImportRow.updateMany({
          where: {
            id: row.id,
            version: row.version,
            status: row.status,
          },
          data: {
            employeeId: employee.id,
            status: EmployeeImportRowStatus.IMPORTED,
            normalizedData: toJson(snapshot),
            errors: toJson([]),
            importedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (transitioned.count !== 1)
          throw new ConflictException('La fila cambió durante la importación.');
        await this.recountBatch(tx, row.batch.id);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async findAuthorizedRow(
    actor: AuthUser,
    batchId: string,
    rowId: string,
  ) {
    const companyId = scopedCompanyId(actor);
    const row = await this.prisma.employeeImportRow.findFirst({
      where: {
        id: rowId,
        batchId,
        batch: {
          tenantId: actor.tenantId,
          ...(companyId ? { companyId } : {}),
        },
      },
      select: {
        id: true,
        rowNumber: true,
        status: true,
        rawData: true,
        errors: true,
        version: true,
        batch: {
          select: {
            id: true,
            tenantId: true,
            companyId: true,
            company: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('La fila pendiente no existe.');
    assertCompanyAccess(actor, row.batch.companyId);
    return row;
  }

  private async recountBatch(
    tx: Prisma.TransactionClient | PrismaService,
    batchId: string,
  ) {
    const grouped = await tx.employeeImportRow.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });
    const count = (status: EmployeeImportRowStatus) =>
      grouped.find((item) => item.status === status)?._count._all ?? 0;
    const pendingRows = count(EmployeeImportRowStatus.PENDING);
    const failedRows = count(EmployeeImportRowStatus.FAILED);
    const importedRows = count(EmployeeImportRowStatus.IMPORTED);
    const skippedRows = count(EmployeeImportRowStatus.SKIPPED);
    const finished = pendingRows === 0 && failedRows === 0;
    await tx.employeeImportBatch.update({
      where: { id: batchId },
      data: {
        totalRows: pendingRows + failedRows + importedRows + skippedRows,
        pendingRows,
        failedRows,
        importedRows,
        skippedRows,
        status: finished
          ? EmployeeImportBatchStatus.COMPLETED
          : EmployeeImportBatchStatus.REVIEW_REQUIRED,
        completedAt: finished ? new Date() : null,
      },
    });
  }

  private async resolveArea(
    batch: { tenantId: string; companyId: string },
    value: string,
  ) {
    const normalized = toStringValue(value);
    if (!normalized) return null;
    return this.prisma.area.findFirst({
      where: {
        tenantId: batch.tenantId,
        companyId: batch.companyId,
        status: 'ACTIVE',
        OR: [
          { name: { equals: normalized, mode: 'insensitive' } },
          {
            slug: { equals: normalizeHeader(normalized), mode: 'insensitive' },
          },
        ],
      },
      select: { id: true, name: true },
    });
  }

  private async resolvePosition(
    batch: { tenantId: string; companyId: string },
    value: string,
  ) {
    const normalized = toStringValue(value);
    if (!normalized) return null;
    return this.prisma.jobPosition.findFirst({
      where: {
        tenantId: batch.tenantId,
        status: 'ACTIVE',
        OR: [{ companyId: batch.companyId }, { scope: 'GROUP' }],
        AND: [
          {
            OR: [
              { name: { equals: normalized, mode: 'insensitive' } },
              {
                slug: {
                  equals: normalizeHeader(normalized),
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      select: { id: true, name: true },
    });
  }

  private async resolveTeam(
    batch: { tenantId: string; companyId: string },
    value: string,
  ) {
    const normalized = toStringValue(value);
    if (!normalized) return null;
    return this.prisma.workTeam.findFirst({
      where: {
        tenantId: batch.tenantId,
        companyId: batch.companyId,
        status: 'ACTIVE',
        OR: [
          { name: { equals: normalized, mode: 'insensitive' } },
          {
            slug: { equals: normalizeHeader(normalized), mode: 'insensitive' },
          },
        ],
      },
      select: { id: true, name: true },
    });
  }

  private async resolveManager(
    batch: { tenantId: string; companyId: string },
    value: string,
  ) {
    const normalized = toStringValue(value);
    if (!normalized) return null;
    return this.prisma.employee.findFirst({
      where: {
        tenantId: batch.tenantId,
        companyId: batch.companyId,
        status: 'ACTIVE',
        OR: [
          { documentNumber: normalized.toUpperCase() },
          { employeeCode: normalized.toUpperCase() },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  private findDuplicate(where: Prisma.EmployeeWhereUniqueInput) {
    return this.prisma.employee
      .findUnique({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: { select: { id: true, name: true } },
        },
      })
      .then((employee) => (employee && employee.company ? employee : null));
  }

  private async generateEmployeeCode(
    tx: Prisma.TransactionClient,
    company: { id: string; name: string; slug: string },
  ) {
    const prefix = companyCodePrefix(company);
    const sequence = await tx.employeeCodeSequence.upsert({
      where: { companyId: company.id },
      update: { lastNumber: { increment: 1 } },
      create: { companyId: company.id, lastNumber: 1 },
      select: { lastNumber: true },
    });
    return `${prefix}-${String(sequence.lastNumber).padStart(7, '0')}`;
  }

  private async mapCommitError(
    actor: AuthUser,
    batch: { tenantId: string; companyId: string },
    raw: ImportRowData,
    error: unknown,
  ) {
    if (!isUniqueConflict(error)) return null;
    const document = normalizeDocument(raw.documentNumber, []);
    const email = normalizeEmail(raw.personalEmail, []);
    const code = normalizeCode(raw.employeeCode, []);
    const duplicate = document
      ? await this.findDuplicate({
          tenantId_documentNumber: {
            tenantId: batch.tenantId,
            documentNumber: document,
          },
        })
      : email
        ? await this.findDuplicate({
            tenantId_personalEmail: {
              tenantId: batch.tenantId,
              personalEmail: email,
            },
          })
        : code
          ? await this.findDuplicate({
              companyId_employeeCode: {
                companyId: batch.companyId,
                employeeCode: code,
              },
            })
          : null;
    return duplicate
      ? duplicateError(
          document
            ? 'documentNumber'
            : email
              ? 'personalEmail'
              : 'employeeCode',
          'duplicate_race',
          'Otro proceso registró este dato mientras se importaba.',
          duplicate,
          hasGlobalCompanyAccess(actor) ||
            actor.companyId === duplicate.company.id,
        )
      : {
          field: 'row' as const,
          code: 'duplicate_race',
          message: 'Otro proceso creó un registro equivalente. Revisa la fila.',
        };
  }

  private async findExistingBatch(
    actor: AuthUser,
    companyId: string,
    fileHash: string,
  ) {
    return this.prisma.employeeImportBatch.findFirst({
      where: { tenantId: actor.tenantId, companyId, fileHash },
      select: { id: true },
    });
  }

  private async writeBatchAudit(
    actor: AuthUser,
    batchId: string,
    companyId: string,
    fileName: string,
  ) {
    const batch = await this.prisma.employeeImportBatch.findUnique({
      where: { id: batchId },
      select: {
        importedRows: true,
        pendingRows: true,
        failedRows: true,
        skippedRows: true,
      },
    });
    if (!batch) return;
    await this.prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        companyId,
        actorType: 'user',
        actorLabel: actor.email,
        action: 'employee.import.completed',
        entityType: 'EmployeeImportBatch',
        entityId: batchId,
        summary: `Se procesó ${fileName}: ${batch.importedRows} importados y ${batch.pendingRows + batch.failedRows} pendientes.`,
        after: toJson({ ...batch, fileName }),
      },
    });
  }

  private async redactExpiredRows(tenantId?: string) {
    const importedCutoff = new Date(
      Date.now() - IMPORTED_PII_RETENTION_DAYS * 86_400_000,
    );
    const pendingCutoff = new Date(
      Date.now() - PENDING_PII_RETENTION_DAYS * 86_400_000,
    );
    await this.prisma.employeeImportRow.updateMany({
      where: {
        status: {
          in: [
            EmployeeImportRowStatus.IMPORTED,
            EmployeeImportRowStatus.SKIPPED,
          ],
        },
        updatedAt: { lt: importedCutoff },
        ...(tenantId ? { batch: { tenantId } } : {}),
      },
      data: {
        rawData: toJson({ redacted: true }),
        normalizedData: Prisma.JsonNull,
        errors: toJson([]),
      },
    });

    const expiredPending = await this.prisma.employeeImportRow.findMany({
      where: {
        status: {
          in: [EmployeeImportRowStatus.PENDING, EmployeeImportRowStatus.FAILED],
        },
        createdAt: { lt: pendingCutoff },
        ...(tenantId ? { batch: { tenantId } } : {}),
      },
      select: { batchId: true, id: true },
      take: 5_000,
    });
    if (expiredPending.length === 0) return;
    await this.prisma.employeeImportRow.updateMany({
      where: { id: { in: expiredPending.map((row) => row.id) } },
      data: {
        rawData: toJson({ redacted: true }),
        normalizedData: Prisma.JsonNull,
        errors: toJson([
          {
            field: 'row',
            code: 'expired',
            message: 'La fila venció después de 90 días sin corregirse.',
          },
        ]),
        status: EmployeeImportRowStatus.SKIPPED,
        version: { increment: 1 },
      },
    });
    for (const batchId of new Set(expiredPending.map((row) => row.batchId))) {
      await this.recountBatch(this.prisma, batchId);
    }
  }

  private assertWorkbookFile(file?: Express.Multer.File) {
    if (!file)
      throw new BadRequestException('Selecciona un archivo Excel .xlsx.');
    if (file.size <= 0 || file.size > MAX_FILE_BYTES)
      throw new BadRequestException('El Excel debe pesar como máximo 3 MB.');
    if (extname(file.originalname).toLowerCase() !== '.xlsx')
      throw new BadRequestException(
        'Solo se acepta la plantilla .xlsx; no se permiten .xls ni .xlsm.',
      );
    if (
      file.buffer.length < 4 ||
      !file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    )
      throw new BadRequestException(
        'El archivo no tiene una firma XLSX válida.',
      );
  }

  private requireString(value: unknown, message: string) {
    const normalized = toStringValue(value);
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }
}

const batchSummarySelect = {
  id: true,
  originalFileName: true,
  status: true,
  totalRows: true,
  importedRows: true,
  pendingRows: true,
  failedRows: true,
  skippedRows: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.EmployeeImportBatchSelect;

const importRowSelect = {
  id: true,
  rowNumber: true,
  status: true,
  rawData: true,
  normalizedData: true,
  errors: true,
  version: true,
  employeeId: true,
  importedAt: true,
  updatedAt: true,
} satisfies Prisma.EmployeeImportRowSelect;

function emptyImportRowData(): ImportRowData {
  return Object.fromEntries(
    importFields.map((field) => [field, '']),
  ) as ImportRowData;
}

function asImportRowData(value: Prisma.JsonValue): ImportRowData {
  const source =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    importFields.map((field) => [field, toStringValue(source[field])]),
  ) as ImportRowData;
}

function asImportErrors(value: Prisma.JsonValue): ImportRowError[] {
  return Array.isArray(value)
    ? value.filter((item): item is ImportRowError =>
        Boolean(
          item &&
          typeof item === 'object' &&
          'field' in item &&
          'message' in item,
        ),
      )
    : [];
}

function normalizePatch(value: UpdateImportRowInput['data']) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const patch: Partial<ImportRowData> = {};
  for (const field of importFields) {
    if (Object.prototype.hasOwnProperty.call(value, field))
      patch[field] = toStringValue(value[field]);
  }
  return patch;
}

function normalizeName(
  value: unknown,
  field: 'firstName' | 'lastName',
  errors: ImportRowError[],
) {
  const normalized = toStringValue(value).replace(/\s+/g, ' ');
  if (!normalized) {
    errors.push({
      field,
      code: 'required',
      message:
        field === 'firstName'
          ? 'Los nombres son obligatorios.'
          : 'Los apellidos son obligatorios.',
    });
    return null;
  }
  if (
    normalized.length < 2 ||
    normalized.length > 80 ||
    !/^[\p{L}\p{M}' .-]+$/u.test(normalized)
  ) {
    errors.push({
      field,
      code: 'invalid',
      message: 'Usa entre 2 y 80 caracteres válidos.',
    });
    return null;
  }
  return normalized;
}

function normalizeDocument(value: unknown, errors: ImportRowError[]) {
  const normalized = toStringValue(value).toUpperCase();
  if (!normalized) {
    errors.push({
      field: 'documentNumber',
      code: 'required',
      message: 'El DNI o documento es obligatorio.',
    });
    return null;
  }
  if (!/^[A-Z0-9-]{6,20}$/.test(normalized)) {
    errors.push({
      field: 'documentNumber',
      code: 'invalid',
      message: 'El documento debe tener entre 6 y 20 caracteres.',
    });
    return null;
  }
  return normalized;
}

function normalizeEmail(value: unknown, errors: ImportRowError[]) {
  const normalized = toStringValue(value).toLowerCase();
  if (!normalized) return null;
  if (
    normalized.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    errors.push({
      field: 'personalEmail',
      code: 'invalid',
      message: 'El correo personal no es válido.',
    });
    return null;
  }
  return normalized;
}

function normalizePhone(value: unknown, errors: ImportRowError[]) {
  const normalized = toStringValue(value);
  if (!normalized) return null;
  if (!/^\+?[0-9][0-9 ()-]{6,24}$/.test(normalized)) {
    errors.push({
      field: 'phoneMobile',
      code: 'invalid',
      message: 'El celular no es válido.',
    });
    return null;
  }
  return normalized;
}

function normalizeLabel(
  value: unknown,
  max: number,
  field: ImportField,
  errors: ImportRowError[],
) {
  const normalized = toStringValue(value).replace(/\s+/g, ' ');
  if (!normalized) return null;
  if (normalized.length > max || /[<>]/.test(normalized)) {
    errors.push({
      field,
      code: 'invalid',
      message:
        'El texto contiene caracteres no permitidos o es demasiado largo.',
    });
    return null;
  }
  return normalized;
}

function normalizeCode(value: unknown, errors: ImportRowError[]) {
  const normalized = toStringValue(value).toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9-]{2,24}$/.test(normalized)) {
    errors.push({
      field: 'employeeCode',
      code: 'invalid',
      message: 'El código debe tener entre 2 y 24 caracteres válidos.',
    });
    return null;
  }
  return normalized;
}

function normalizePin(value: unknown, errors: ImportRowError[]) {
  const normalized = toStringValue(value);
  if (!normalized) {
    errors.push({
      field: 'attendancePin',
      code: 'required',
      message: 'Ingresa un PIN de marcación para completar la fila.',
    });
    return null;
  }
  if (
    !/^\d{6,8}$/.test(normalized) ||
    /^(\d)\1+$/.test(normalized) ||
    ['123456', '654321', '12345678', '87654321'].includes(normalized)
  ) {
    errors.push({
      field: 'attendancePin',
      code: 'invalid',
      message: 'El PIN debe tener 6 a 8 dígitos y no ser predecible.',
    });
    return null;
  }
  return normalized;
}

function normalizeDate(value: unknown, errors: ImportRowError[]) {
  const normalized = toStringValue(value);
  if (!normalized) return null;
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const localMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!isoMatch && !localMatch) {
    errors.push({
      field: 'hireDate',
      code: 'invalid',
      message: 'Usa una fecha real en formato YYYY-MM-DD o DD/MM/YYYY.',
    });
    return null;
  }
  const year = Number(isoMatch?.[1] ?? localMatch?.[3]);
  const month = Number(isoMatch?.[2] ?? localMatch?.[2]);
  const day = Number(isoMatch?.[3] ?? localMatch?.[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    errors.push({
      field: 'hireDate',
      code: 'invalid',
      message: 'La fecha de ingreso no existe en el calendario.',
    });
    return null;
  }
  return date;
}

function duplicateError(
  field: ImportField,
  code: string,
  message: string,
  duplicate: {
    id: string;
    firstName: string;
    lastName: string;
    company: { id: string; name: string };
  },
  exposeConflict: boolean,
): ImportRowError {
  return {
    field,
    code,
    message,
    ...(exposeConflict
      ? {
          conflict: {
            employeeId: duplicate.id,
            employeeName: `${duplicate.firstName} ${duplicate.lastName}`,
            companyName: duplicate.company.name,
          },
        }
      : {}),
  };
}

function companyCodePrefix(company: { name: string; slug: string }) {
  const known: Record<string, string> = {
    'grupo-sp': 'SP',
    mood: 'MD',
    supernova: 'SN',
    infinity: 'IN',
  };
  if (known[company.slug.toLowerCase()])
    return known[company.slug.toLowerCase()];
  const words = company.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean);
  return words.length >= 2
    ? `${words[0][0]}${words[1][0]}`
    : (words[0] ?? 'TR').slice(0, 2).padEnd(2, 'X');
}

function toStringValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value).trim();
  return '';
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function cellToText(cell: Cell) {
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
    return String(value).trim();
  if (
    typeof value === 'object' &&
    'richText' in value &&
    Array.isArray(value.richText)
  )
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim();
  return cell.text.trim();
}

function dateCellToText(cell: Cell) {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  return cellToText(cell);
}

function hasFormula(cell: Cell) {
  return Boolean(
    cell.value && typeof cell.value === 'object' && 'formula' in cell.value,
  );
}

function requiredHeaderLabel(field: ImportField | 'attendancePin') {
  return (
    (
      {
        firstName: 'Nombres',
        lastName: 'Apellidos',
        documentNumber: 'DNI',
        area: 'Área',
        position: 'Cargo',
        attendancePin: 'PIN marcación',
      } as Record<string, string>
    )[field] ?? field
  );
}

function safeFileName(value: string) {
  const printableName = Array.from(basename(value))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
  return printableName.slice(0, 160) || 'trabajadores.xlsx';
}

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function preflightXlsxArchive(buffer: Buffer) {
  return new Promise<void>((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, decodeStrings: true, validateEntrySizes: true },
      (openError, zipFile) => {
        if (openError || !zipFile) {
          reject(
            new BadRequestException(
              'El archivo XLSX está dañado o no es un ZIP válido.',
            ),
          );
          return;
        }
        let entries = 0;
        let totalBytes = 0;
        let hasContentTypes = false;
        let hasWorkbook = false;
        let settled = false;
        const fail = (message: string) => {
          if (settled) return;
          settled = true;
          zipFile.close();
          reject(new BadRequestException(message));
        };
        zipFile.on('entry', (entry: yauzl.Entry) => {
          entries += 1;
          totalBytes += entry.uncompressedSize;
          const name = entry.fileName.replace(/\\/g, '/');
          if (entry.generalPurposeBitFlag & 0x1)
            return fail('No se aceptan archivos Excel cifrados.');
          if (name.includes('../') || name.startsWith('/'))
            return fail('El XLSX contiene rutas internas no permitidas.');
          if (/vbaProject\.bin$/i.test(name))
            return fail('No se aceptan macros. Usa un archivo .xlsx limpio.');
          if (/^xl\/externalLinks\//i.test(name))
            return fail('No se aceptan vínculos externos en el Excel.');
          if (
            entry.uncompressedSize > MAX_ZIP_ENTRY_BYTES ||
            totalBytes > MAX_UNCOMPRESSED_BYTES ||
            entries > MAX_ZIP_ENTRIES
          )
            return fail('El XLSX excede los límites internos seguros.');
          if (name === '[Content_Types].xml') hasContentTypes = true;
          if (name === 'xl/workbook.xml') hasWorkbook = true;
          zipFile.readEntry();
        });
        zipFile.on('end', () => {
          if (settled) return;
          settled = true;
          if (!hasContentTypes || !hasWorkbook)
            reject(
              new BadRequestException(
                'El archivo no tiene la estructura de un libro XLSX.',
              ),
            );
          else resolve();
        });
        zipFile.on('error', () =>
          fail('No se pudo validar la estructura interna del XLSX.'),
        );
        zipFile.readEntry();
      },
    );
  });
}
