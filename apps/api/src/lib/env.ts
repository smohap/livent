import 'dotenv/config';

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
