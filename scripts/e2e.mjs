// Each run gets its own database. The normal development/production data is never reset.
import nextEnv from '@next/env';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, unlink } from 'node:fs/promises';

nextEnv.loadEnvConfig(process.cwd());
const database = `svr_test_${Date.now()}_${randomBytes(3).toString('hex')}`;
const source = process.env.NEON_DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!source?.startsWith('postgres')) throw new Error('A development Postgres connection is required.');
const admin = new pg.Pool({ connectionString: source, max: 1 });
const url = new URL(source);
url.pathname = `/${database}`;
const env = { ...process.env, NEON_DATABASE_URL: url.href, NEON_DATABASE_URL_UNPOOLED: url.href,
  DATABASE_URL: url.href, APP_WACHTWOORD: randomBytes(24).toString('hex'),
  AUTH_SECRET: randomBytes(48).toString('hex'), E2E_BASE_URL: 'http://localhost:3101', NEXT_TELEMETRY_DISABLED: '1' };
let server;
let created = false;
function run(file, args, options = {}) {
  const child = spawn(process.execPath, [file, ...args], { env, stdio: 'inherit', ...options });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${file}`)));
  });
}
try {
  await admin.query(`CREATE DATABASE "${database}"`);
  created = true;
  await mkdir('.vercel', { recursive: true });
  await writeFile('.vercel/e2e-env.json', JSON.stringify({ database, env: {
    NEON_DATABASE_URL: url.href, NEON_DATABASE_URL_UNPOOLED: url.href, DATABASE_URL: url.href,
    APP_WACHTWOORD: env.APP_WACHTWOORD, AUTH_SECRET: env.AUTH_SECRET, E2E_BASE_URL: env.E2E_BASE_URL,
  }}));
  await run('scripts/migrate.mjs', []);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--port', '3101'], { env, stdio: 'inherit' });
  await Promise.race([
    new Promise((_, reject) => server.on('exit', code => reject(new Error(`Server stopped (${code})`)))),
    (async () => {
      for (let n = 0; n < 120; n++) {
        try { if ((await fetch(`${env.E2E_BASE_URL}/inloggen`)).ok) return; } catch { /* starting */ }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('Test server did not start.');
    })(),
  ]);
  console.log(`Isolated test server ready: ${env.E2E_BASE_URL}`);
  if (process.argv.includes('--serve')) {
    await new Promise((resolve, reject) => {
      process.once('SIGINT', resolve);
      process.once('SIGTERM', resolve);
      process.stdin.on('data', chunk => { if (chunk.toString().trim() === 'stop') resolve(); });
      server.once('exit', code => reject(new Error(`Test server stopped (${code}).`)));
    });
    process.stdin.pause();
  } else {
    await run('node_modules/@playwright/test/cli.js', ['test', ...process.argv.slice(2)]);
  }
} finally {
  if (server?.pid) {
    if (process.platform === 'win32') await new Promise(resolve => {
      spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }).on('exit', resolve);
    });
    else server.kill('SIGTERM');
  }
  if (created) {
    // Only the unique database created above can be removed by this run.
    if (!/^svr_test_\d+_[a-f0-9]{6}$/.test(database)) throw new Error('Unsafe test database name.');
    await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await unlink('.vercel/e2e-env.json').catch(() => {});
  }
  await admin.end();
}
