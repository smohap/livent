/**
 * Creates apps/api/.env on first run.
 *
 * .env is gitignored, so a fresh clone has no DATABASE_URL and `prisma db push`
 * fails before it starts. This writes sane local defaults once and never
 * overwrites an existing file.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'apps', 'api', '.env');

if (existsSync(target)) {
  console.log('apps/api/.env already exists, leaving it alone.');
  process.exit(0);
}

const contents = [
  'DATABASE_URL="mysql://root:root@localhost:3306/evyent"',
  // Evyent uses MySQL so local development matches Hostinger production.
  'JWT_SECRET="evyent-local-dev-secret-change-me"',
  'PORT=4000',
  'WEB_ORIGIN="http://localhost:5173"',
  '',
].join('\n');

writeFileSync(target, contents, 'utf8');
console.log('Created apps/api/.env with local development defaults.');
console.log('Set a real JWT_SECRET before deploying anywhere.');
