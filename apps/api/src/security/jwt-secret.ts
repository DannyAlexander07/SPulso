import type { Algorithm, SignOptions, VerifyOptions } from 'jsonwebtoken';

const jwtAlgorithm: Algorithm = 'HS256';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret) {
    return secret;
  }

  throw new Error('JWT_SECRET es obligatorio.');
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
