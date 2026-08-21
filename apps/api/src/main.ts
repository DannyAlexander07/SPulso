import 'dotenv/config';
import { json, urlencoded } from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  blockSuspiciousPayloads,
  createRateLimitMiddleware,
  getCorsOrigins,
  getTrustProxySetting,
} from './security/http-security';
import { getJwtSecret } from './security/jwt-secret';
import { SecurityValidationPipe } from './security/security-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3001;
  const server = app.getHttpAdapter().getInstance() as unknown as Express;

  getJwtSecret();

  server.disable('x-powered-by');
  server.set('trust proxy', getTrustProxySetting());

  app.enableCors({
    credentials: true,
    origin: getCorsOrigins(),
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-origin' } }));
  app.use(json({ limit: process.env.JSON_BODY_LIMIT ?? '256kb' }));
  app.use(
    urlencoded({
      extended: false,
      limit: process.env.FORM_BODY_LIMIT ?? '64kb',
    }),
  );
  app.use(blockSuspiciousPayloads());
  app.use(createRateLimitMiddleware());
  app.useGlobalPipes(new SecurityValidationPipe());

  await app.listen(port);
  console.log(`SPulso API running on http://localhost:${port}`);
}
void bootstrap();
