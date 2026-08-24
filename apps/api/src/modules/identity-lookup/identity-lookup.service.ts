import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { assertCompanyAccess } from '../auth/access-scope';
import type { AuthUser } from '../auth/jwt-auth.guard';

const baseUrl = 'https://peruapi.com/api';
const cacheTtlMs = 24 * 60 * 60 * 1000;
const maxCacheEntries = 1000;

type PeruApiResponse = {
  code?: string;
  mensaje?: string;
  dni?: string;
  cliente?: string;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  ruc?: string;
  razon_social?: string;
  direccion?: string;
  estado?: string;
  condicion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  ubigeo?: string;
};

@Injectable()
export class IdentityLookupService {
  private readonly cache = new Map<
    string,
    { expiresAt: number; value: Record<string, unknown> }
  >();
  private readonly lookupBudgets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async lookupDocument(
    actor: AuthUser,
    documentNumber: string,
    requestedCompanyId?: string,
  ) {
    const token = process.env.PERU_API_TOKEN?.trim();
    const numero = String(documentNumber ?? '').trim();
    const companyId = String(requestedCompanyId ?? '').trim();

    if (!companyId) {
      throw new BadRequestException(
        'Selecciona la empresa antes de consultar el documento.',
      );
    }
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!company) {
      throw new BadRequestException('La empresa seleccionada no existe.');
    }
    assertCompanyAccess(actor, company.id);
    this.consumeLookupBudget(actor);

    if (!token) {
      throw new InternalServerErrorException(
        'Configuracion de API faltante en el servidor.',
      );
    }

    if (!/^\d+$/.test(numero)) {
      throw new BadRequestException('El documento solo debe contener digitos.');
    }

    const isDni = numero.length === 8;
    const isRuc = numero.length === 11;

    if (!isDni && !isRuc) {
      throw new BadRequestException(
        'Formato invalido: usa 8 digitos para DNI o 11 para RUC.',
      );
    }

    const cacheKey = `${actor.tenantId}:${numero}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      await this.auditLookup(actor, companyId, numero, isRuc, true);
      return cached.value;
    }

    const endpoint = isRuc
      ? `/ruc/${numero}?summary=0`
      : `/dni/${numero}?summary=0`;

    let response: Response;
    try {
      response = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SPulso/1.0',
          'X-API-KEY': token,
        },
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ServiceUnavailableException(
          'El servidor de SUNAT/RENIEC esta demorando. Intenta de nuevo.',
        );
      }

      throw new ServiceUnavailableException(
        'Error de conexion con el proveedor de identidad.',
      );
    }

    let data: PeruApiResponse;
    try {
      data = (await response.json()) as PeruApiResponse;
    } catch {
      throw new ServiceUnavailableException(
        'El servicio de RENIEC/SUNAT esta temporalmente fuera de servicio.',
      );
    }

    const externalCode = data.code ?? String(response.status);

    if (!response.ok || externalCode !== '200') {
      if (response.status === 401 || externalCode === '401') {
        throw new UnauthorizedException('Token invalido o IP no autorizada.');
      }

      if (response.status === 404 || externalCode === '404') {
        throw new NotFoundException('Documento no encontrado en padrones.');
      }

      if (response.status === 429 || externalCode === '429') {
        throw new ServiceUnavailableException(
          'Limite de consultas excedido. Intenta mas tarde.',
        );
      }

      throw new ServiceUnavailableException(
        data.mensaje ?? 'Error en API externa.',
      );
    }

    if (isRuc) {
      const result = {
        condicion: data.condicion ?? '',
        departamento: data.departamento ?? '',
        direccion: data.direccion ?? '',
        distrito: data.distrito ?? '',
        estado: data.estado ?? '',
        nombre: data.razon_social ?? '',
        numero: data.ruc ?? numero,
        provincia: data.provincia ?? '',
        success: true,
        tipo: 'RUC',
      };

      this.remember(cacheKey, result);
      await this.auditLookup(actor, companyId, numero, true, false);

      return result;
    }

    const result = {
      apellidoMaterno: data.apellido_materno ?? '',
      apellidoPaterno: data.apellido_paterno ?? '',
      departamento: data.departamento ?? '',
      direccion: data.direccion ?? '',
      distrito: data.distrito ?? '',
      nombre: data.cliente ?? '',
      nombres: data.nombres ?? '',
      numero: data.dni ?? numero,
      provincia: data.provincia ?? '',
      success: true,
      tipo: 'DNI',
      ubigeo: data.ubigeo ?? '',
    };

    this.remember(cacheKey, result);
    await this.auditLookup(actor, companyId, numero, false, false);

    return result;
  }

  private remember(key: string, value: Record<string, unknown>) {
    const now = Date.now();
    for (const [cachedKey, cached] of this.cache) {
      if (cached.expiresAt <= now) this.cache.delete(cachedKey);
    }

    while (this.cache.size >= maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, { expiresAt: now + cacheTtlMs, value });
  }

  private consumeLookupBudget(actor: AuthUser) {
    const now = Date.now();
    for (const [key, budget] of this.lookupBudgets) {
      if (budget.resetAt <= now) this.lookupBudgets.delete(key);
    }
    const key = `${actor.tenantId}:${actor.sub}`;
    const current = this.lookupBudgets.get(key);
    if (!current || current.resetAt <= now) {
      this.lookupBudgets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
      return;
    }
    current.count += 1;
    if (current.count > 30) {
      throw new ServiceUnavailableException(
        'Alcanzaste el limite horario de consultas de identidad.',
      );
    }
  }

  private auditLookup(
    actor: AuthUser,
    companyId: string,
    documentNumber: string,
    isRuc: boolean,
    cacheHit: boolean,
  ) {
    const documentFingerprint = createHash('sha256')
      .update(`${actor.tenantId}:${documentNumber}`)
      .digest('hex');
    return this.auditService.write({
      tenantId: actor.tenantId,
      companyId,
      actorType: 'user',
      actorLabel: actor.email,
      action: 'identity.document_lookup',
      entityType: 'IdentityLookup',
      entityId: documentFingerprint,
      summary: `Se consulto un ${isRuc ? 'RUC' : 'DNI'} para un alta o actualizacion laboral.`,
      after: { cacheHit, companyId, documentType: isRuc ? 'RUC' : 'DNI' },
    });
  }
}
