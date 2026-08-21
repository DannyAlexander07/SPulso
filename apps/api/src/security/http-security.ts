import type { NextFunction, Request, Response } from 'express';

type RateLimitRule = {
  limit: number;
  windowMs: number;
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
    const key = `${getClientIp(request)}:${request.method}:${normalizeRateLimitPath(request.path)}`;
    const now = Date.now();
    const bucket = requestBuckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      ensureBucketCapacity(now);
      requestBuckets.set(key, { count: 1, resetAt: now + rule.windowMs });
      setRateLimitHeaders(
        response,
        rule.limit,
        rule.limit - 1,
        now + rule.windowMs,
      );
      return next();
    }

    bucket.count += 1;
    setRateLimitHeaders(
      response,
      rule.limit,
      Math.max(rule.limit - bucket.count, 0),
      bucket.resetAt,
    );

    if (bucket.count > rule.limit) {
      response.setHeader(
        'Retry-After',
        Math.ceil((bucket.resetAt - now) / 1000),
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
