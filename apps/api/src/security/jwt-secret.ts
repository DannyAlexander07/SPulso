import type { Algorithm, SignOptions, VerifyOptions } from 'jsonwebtoken';

const jwtAlgorithm: Algorithm = 'HS256';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new Error('JWT_SECRET es obligatorio.');
  }

  if (process.env.NODE_ENV === 'production') {
    const normalized = secret.toLowerCase();
    const forbiddenSecrets = new Set([
      'change-me',
      'change-me-in-production',
      'changeme',
      'cambia-esto-por-un-secreto-largo-y-unico',
      'secret',
      'spulso-secret',
      'spulso-secret-key',
    ]);

    if (secret.length < 32 || forbiddenSecrets.has(normalized)) {
      throw new Error(
        'JWT_SECRET debe tener al menos 32 caracteres y no puede ser un valor de ejemplo en produccion.',
      );
    }
  }

  return secret;
}

export function getJwtSignOptions(): SignOptions {
  return {
    algorithm: jwtAlgorithm,
    audience: process.env.JWT_AUDIENCE ?? 'spulso-web',
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'],
    issuer: process.env.JWT_ISSUER ?? 'spulso-api',
  };
}

export function getJwtVerifyOptions(): VerifyOptions {
  return {
    algorithms: [jwtAlgorithm],
    audience: process.env.JWT_AUDIENCE ?? 'spulso-web',
    issuer: process.env.JWT_ISSUER ?? 'spulso-api',
  };
}
