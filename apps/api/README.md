<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Background workers

Exportaciones grandes usan una cola persistente en Postgres sobre la tabla
`ExportJob`. En desarrollo el API procesa la cola en el mismo proceso por
defecto. En produccion se recomienda correr el worker separado y desactivar el
worker embebido del API:

```bash
# API
$ EXPORT_JOBS_API_WORKER=false npm run start:prod

# Worker de exportaciones
$ npm run worker:exports
```

Variables utiles:

- `PRISMA_LOG_QUERIES`: imprime SQL en consola solo si vale `true`; por defecto queda apagado para no saturar logs.
- `EXPORT_JOBS_WORKER_INTERVAL_MS`: intervalo de polling, por defecto `500`.
- `EXPORT_JOBS_WORKER_BATCH_SIZE`: cantidad de jobs por ciclo, por defecto `5`.
- `EXPORT_JOBS_PROCESSING_TIMEOUT_MS`: reintento de jobs trabados, por defecto `900000`.
- `EXPORT_JOBS_FILE_RETENTION_DAYS`: dias que se conserva el archivo generado, por defecto `30`.
- `EXPORT_JOBS_CLEANUP_INTERVAL_MS`: intervalo de limpieza de archivos vencidos, por defecto `3600000`.

El endpoint `GET /health/metrics` expone estado agregado de la cola:
conteos por estado/tipo, antiguedad del job pendiente mas antiguo, jobs
completados/fallidos en las ultimas 24 horas, driver de storage y parametros
activos del worker. Los ciclos con trabajo real se registran como logs JSON con
eventos `export_jobs.worker_cycle` y `export_jobs.cleanup_cycle`.

En produccion define `OBSERVABILITY_TOKEN` y envia el mismo valor en el header
`x-observability-token` para consultar metricas.

La guia completa de despliegue y alertas esta en `../../docs/production.md`.

## File storage

Por defecto los reportes se guardan localmente bajo `uploads/exportaciones`.
Para produccion se puede mover a storage externo sin cambiar la API:

```bash
# Local
FILE_STORAGE_DRIVER=local
FILE_STORAGE_LOCAL_ROOT=uploads

# S3 compatible, tambien valido para Cloudflare R2
FILE_STORAGE_DRIVER=s3
FILE_STORAGE_S3_BUCKET=spulso-exportaciones
FILE_STORAGE_S3_REGION=auto
FILE_STORAGE_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
FILE_STORAGE_S3_FORCE_PATH_STYLE=true
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Azure Blob Storage
FILE_STORAGE_DRIVER=azure
FILE_STORAGE_AZURE_CONNECTION_STRING=...
FILE_STORAGE_AZURE_CONTAINER=exportaciones
```

Las descargas pasan por el API para mantener autenticacion, permisos y auditoria
en SPulso, aunque el archivo viva en S3/R2/Azure.

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# export jobs, paginacion e indices bajo carga local
$ npm run test:load:exports

# test coverage
$ npm run test:cov
```

La prueba de carga usa valores conservadores por defecto. Para subir presion:

```bash
EXPORT_LOAD_JOB_MULTIPLIER=10 EXPORT_LOAD_MAX_P95_MS=4000 npm run test:load:exports
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
