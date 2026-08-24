import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET', 'livent-dev-secret-change-me'),
  webOrigin: required('WEB_ORIGIN', 'http://localhost:5173'),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',
};

if (env.isProd && env.jwtSecret === 'livent-dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set to a real secret in production.');
}
