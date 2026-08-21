import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

function prismaLogLevels(): Prisma.LogLevel[] {
  if (process.env.NODE_ENV === 'production') {
    return ['error'];
  }

  if (process.env.PRISMA_LOG_QUERIES === 'true') {
    return ['query', 'warn', 'error'];
  }

  return ['warn', 'error'];
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.');
    }

    super({
      adapter: new PrismaPg({ connectionString }),
      log: prismaLogLevels(),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
