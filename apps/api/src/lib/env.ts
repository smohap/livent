import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/*
 * dotenv's default reads .env from process.cwd(). The host may launch the
 * compiled entry point from the repository root rather than from apps/api, so
 * resolve the file relative to this module and fall back to the working
 * directory. Neither call overwrites a variable the platform already set.
 */
const HERE = dirname(fileURLToPath(import.meta.url));

/** dist/lib/env.js -> apps/api */
export const API_ROOT = resolve(HERE, '../..');

config({ path: resolve(API_ROOT, '.env') });
config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DEV_SECRET = 'evyent-dev-secret-change-me';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', DEV_SECRET),
  webOrigin: required('WEB_ORIGIN', 'http://localhost:5173'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
};

// Fail at boot rather than serving traffic signed with a public secret.
if (env.isProd && env.jwtSecret === DEV_SECRET) {
  throw new Error('JWT_SECRET must be set to a real secret in production.');
}
