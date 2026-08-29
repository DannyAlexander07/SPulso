import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';

type RateLimitRule = {
  limit: number;
  windowMs: number;
};

type RateLimitIdentity = {
  limit: number;
  value: string;
};

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_BUCKETS = 20_000;

export function getTrustProxySetting() {
  const hops = Number(process.env.TRUST_PROXY_HOPS ?? 0);

  if (!Number.isInteger(hops) || hops < 0 || hops > 3) {
    throw new Error('TRUST_PROXY_HOPS debe ser un entero entre 0 y 3.');
  }

  return hops === 0 ? false : hops;
}

export function getCorsOrigins() {
  const rawOrigins =
    process.env.CORS_ORIGINS ?? process.env.WEB_URL ?? 'http://localhost:3000';

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => origin !== '*');

  if (origins.length === 0) {
    return ['http://localhost:3000'];
  }

  return origins;
}

export function createRateLimitMiddleware() {
  return (request: Request, response: Response, next: NextFunction) => {
    const rule = getRateLimitRule(request.path);
    const suffix = `${request.method}:${normalizeRateLimitPath(request.path)}`;
    const identities = getRateLimitIdentities(request, rule);
    const now = Date.now();
    ensureBucketCapacity(now);

    const buckets = identities.map((identity) => {
      const key = `${identity.value}:${suffix}`;
      const current = requestBuckets.get(key);
      const bucket =
        !current || current.resetAt <= now
          ? { count: 1, resetAt: now + rule.windowMs }
          : { count: current.count + 1, resetAt: current.resetAt };
      requestBuckets.set(key, bucket);
      return { bucket, limit: identity.limit };
    });
    const blockedEntry = buckets.find(
      ({ bucket, limit }) => bucket.count > limit,
    );
    const remaining = Math.min(
      ...buckets.map(({ bucket, limit }) => Math.max(limit - bucket.count, 0)),
    );
    const resetAt =
      blockedEntry?.bucket.resetAt ??
      Math.max(...buckets.map(({ bucket }) => bucket.resetAt));

    setRateLimitHeaders(response, rule.limit, remaining, resetAt);

    if (blockedEntry) {
      response.setHeader(
        'Retry-After',
        Math.ceil((blockedEntry.bucket.resetAt - now) / 1000),
      );
      return response.status(429).json({
        message: 'Demasiadas solicitudes. Intenta nuevamente en unos segundos.',
        statusCode: 429,
      });
    }

    return next();
  };
}

export function blockSuspiciousPayloads() {
  return (request: Request, response: Response, next: NextFunction) => {
    const contentType = request.headers['content-type'] ?? '';

    if (Array.isArray(contentType)) {
      return next();
    }

    if (
      request.method !== 'GET' &&
      contentType.includes('multipart/form-data') &&
      !isAllowedMultipartPath(request.path)
    ) {
      return response.status(415).json({
        message: 'Carga de archivos aun no habilitada para esta ruta.',
        statusCode: 415,
      });
    }

    return next();
  };
}

function isAllowedMultipartPath(path: string) {
  const normalizedPath = path.replace(/\/+$/, '');

  return [
    '/archivos/comunicados',
    '/archivos/documentos',
    '/archivos/usuarios',
    '/files/announcements',
    '/files/documents',
    '/files/users',
    '/portal/foto/archivo',
    '/portal/photo/file',
    '/trabajadores/importaciones',
    '/employees/imports',
  ].includes(normalizedPath);
}

function getRateLimitRule(path: string): RateLimitRule {
  if (path === '/auth/login') {
    return {
      limit: positiveIntegerEnv('AUTH_RATE_LIMIT', 8),
      windowMs: 60_000,
    };
  }

  if (path === '/auth/me') {
    return {
      limit: positiveIntegerEnv('SESSION_RATE_LIMIT', 120),
      windowMs: 60_000,
    };
  }

  if (
    path === '/asistencia/marcacion-personal' ||
    path === '/attendance/self-mark'
  ) {
    return {
      limit: positiveIntegerEnv('SELF_ATTENDANCE_RATE_LIMIT', 20),
      windowMs: 60_000,
    };
  }

  if (
    path === '/trabajadores/actualizar-pin-marcacion' ||
    path === '/employees/self-attendance-pin'
  ) {
    return {
      limit: positiveIntegerEnv('SELF_PIN_RATE_LIMIT', 10),
      windowMs: 60_000,
    };
  }

  if (path === '/archivos/documentos' || path === '/files/documents') {
    return {
      limit: positiveIntegerEnv('DOCUMENT_UPLOAD_RATE_LIMIT', 6),
      windowMs: 60_000,
    };
  }

  if (
    [
      '/archivos/comunicados',
      '/files/announcements',
      '/archivos/usuarios',
      '/files/users',
      '/portal/foto/archivo',
      '/portal/photo/file',
    ].includes(path)
  ) {
    return {
      limit: positiveIntegerEnv('MEDIA_UPLOAD_RATE_LIMIT', 10),
      windowMs: 60_000,
    };
  }

  if (path === '/exportaciones' || path === '/export-jobs') {
    return {
      limit: positiveIntegerEnv('EXPORT_CREATE_RATE_LIMIT', 5),
      windowMs: 60_000,
    };
  }

  if (path === '/trabajadores/importaciones' || path === '/employees/imports') {
    return {
      limit: positiveIntegerEnv('EMPLOYEE_IMPORT_RATE_LIMIT', 3),
      windowMs: 60_000,
    };
  }

  if (path === '/documentos/exportar/zip' || path === '/documents/export/zip') {
    return {
      limit: positiveIntegerEnv('DOCUMENT_ZIP_RATE_LIMIT', 2),
      windowMs: 60_000,
    };
  }

  if (/^\/portal\/(documentos|documents)\/[^/]+\/(firmar|sign)$/.test(path)) {
    return {
      limit: positiveIntegerEnv('DOCUMENT_SIGN_RATE_LIMIT', 5),
      windowMs: 60_000,
    };
  }

  return { limit: positiveIntegerEnv('API_RATE_LIMIT', 600), windowMs: 60_000 };
}

function normalizeRateLimitPath(path: string) {
  return path
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
      '/:id',
    )
    .replace(/\/[A-Za-z0-9_-]{16,}(?=\/|$)/g, '/:id');
}

function getClientIp(request: Request) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function getRateLimitIdentities(
  request: Request,
  rule: RateLimitRule,
): RateLimitIdentity[] {
  const body = request.body as Record<string, unknown> | undefined;
  const publicAccountPath = isPublicAccountRateLimitPath(request.path);
  const accountIdentifier =
    request.path === '/auth/login'
      ? normalizeIdentity(body?.email)
      : publicAccountPath
        ? [
            normalizeIdentity(body?.tenantSlug),
            normalizeIdentity(body?.companySlug),
            normalizeIdentity(body?.identifier),
          ]
            .filter(Boolean)
            .join(':')
        : null;

  if (request.path === '/auth/login' || publicAccountPath) {
    const identities: RateLimitIdentity[] = [
      { limit: rule.limit, value: `ip:${getClientIp(request)}` },
    ];
    if (accountIdentifier) {
      identities.push({
        limit: rule.limit,
        value: `account:${fingerprint(accountIdentifier)}`,
      });
    }
    return identities;
  }

  const authorization = request.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return [
      {
        limit: rule.limit,
        value: `session:${fingerprint(authorization.slice('Bearer '.length))}`,
      },
      {
        limit: positiveIntegerEnv(
          'API_AGGREGATE_IP_RATE_LIMIT',
          Math.max(rule.limit * 10, 1_200),
        ),
        value: `ip:${getClientIp(request)}`,
      },
    ];
  }

  return [{ limit: rule.limit, value: `ip:${getClientIp(request)}` }];
}

function isPublicAccountRateLimitPath(path: string) {
  return [
    '/asistencia/marcacion-personal',
    '/attendance/self-mark',
    '/trabajadores/actualizar-pin-marcacion',
    '/employees/self-attendance-pin',
  ].includes(path);
}

function normalizeIdentity(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().slice(0, 254)
    : '';
}

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function cleanupExpiredBuckets(now: number) {
  for (const [key, bucket] of requestBuckets.entries()) {
    if (bucket.resetAt <= now) {
      requestBuckets.delete(key);
    }
  }
}

function ensureBucketCapacity(now: number) {
  cleanupExpiredBuckets(now);

  while (requestBuckets.size >= MAX_RATE_LIMIT_BUCKETS) {
    const oldestKey = requestBuckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    requestBuckets.delete(oldestKey);
  }
}

function setRateLimitHeaders(
  response: Response,
  limit: number,
  remaining: number,
  resetAt: number,
) {
  response.setHeader('RateLimit-Limit', limit);
  response.setHeader('RateLimit-Remaining', remaining);
  response.setHeader('RateLimit-Reset', Math.ceil(resetAt / 1000));
}

function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} debe ser un entero positivo.`);
  }

  return value;
}
