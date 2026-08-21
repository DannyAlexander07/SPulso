const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
require('dotenv/config');

function deriveTestDatabaseUrl() {
  const explicitUrl = process.env.TEST_DATABASE_URL;

  if (explicitUrl) {
    return explicitUrl;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to derive TEST_DATABASE_URL.');
  }

  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//, '');

  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  const runId = String(process.env.E2E_RUN_ID ?? Date.now())
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 32);
  url.pathname = `/${databaseName}_e2e_${runId}`;

  return url.toString();
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function ensureDatabase(databaseUrl) {
  const targetUrl = new URL(databaseUrl);
  const databaseName = targetUrl.pathname.replace(/^\//, '');
  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  maintenanceUrl.search = '';

  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();

  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    }
  } finally {
    await client.end();
  }
}

function run(command, args, env) {
  const result = spawnSync(command, args, {
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const testDatabaseUrl = deriveTestDatabaseUrl();
  await ensureDatabase(testDatabaseUrl);

  const env = {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    NODE_ENV: 'test',
  };

  console.log(`Base E2E aislada: ${new URL(testDatabaseUrl).pathname.slice(1)}`);
  run('npx', ['prisma', 'migrate', 'deploy'], env);
  run('npx', ['ts-node', 'prisma/seed.ts'], env);
  run('npx', ['jest', '--config', './test/jest-e2e.json', '--runInBand'], env);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
