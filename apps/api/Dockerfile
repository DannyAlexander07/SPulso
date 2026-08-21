FROM node:22.17.0-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api ./
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate && npm run build

FROM base AS runtime

WORKDIR /app/apps/api
ENV NODE_ENV=production
COPY apps/api/package*.json ./
COPY apps/api/prisma ./prisma
COPY apps/api/prisma.config.ts ./prisma.config.ts
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm ci --omit=dev \
    && DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate \
    && npm cache clean --force
COPY --from=build /app/apps/api/dist ./dist

EXPOSE 3001
CMD ["npm", "run", "start:prod"]
