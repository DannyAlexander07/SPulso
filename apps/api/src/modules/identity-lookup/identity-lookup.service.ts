import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

const baseUrl = 'https://peruapi.com/api';
const cacheTtlMs = 24 * 60 * 60 * 1000;

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

  async lookupDocument(documentNumber: string) {
    const token = process.env.PERU_API_TOKEN?.trim();
    const numero = String(documentNumber ?? '').trim();

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

    const cached = this.cache.get(numero);
    if (cached && cached.expiresAt > Date.now()) {
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

      this.cache.set(numero, {
        expiresAt: Date.now() + cacheTtlMs,
        value: result,
      });

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

    this.cache.set(numero, {
      expiresAt: Date.now() + cacheTtlMs,
      value: result,
    });

    return result;
  }
}
