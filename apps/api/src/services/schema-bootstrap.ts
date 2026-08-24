import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma } from '../lib/prisma.js';
import { API_ROOT } from '../lib/env.js';

/*
 * Applies pending migrations without the Prisma schema engine.
 *
 * `prisma migrate deploy` shells out to a native schema-engine binary. On
 * Hostinger's shared tier that spawn is denied (EACCES), so the normal path
 * cannot run at all. The query engine is an in-process library and works fine,
 * so migrations are applied as raw SQL through it instead.
 *
 * Rows are recorded in Prisma's own `_prisma_migrations` ledger using the same
 * checksum scheme, so the database stays consistent with the migrations
 * directory and a future `migrate deploy` on a less restricted host sees the
 * correct state rather than trying to re-apply everything.
 */

const MIGRATIONS = ['0_init'];

const LEDGER = `CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
  \`id\` VARCHAR(36) NOT NULL,
  \`checksum\` VARCHAR(64) NOT NULL,
  \`finished_at\` DATETIME(3) NULL,
  \`migration_name\` VARCHAR(255) NOT NULL,
  \`logs\` TEXT NULL,
  \`rolled_back_at\` DATETIME(3) NULL,
  \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`applied_steps_count\` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`;

/** Splits a migration file into executable statements. */
function statements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function applyMigrations(): Promise<string> {
  await prisma.$executeRawUnsafe(LEDGER);

  const done = await prisma.$queryRawUnsafe<Array<{ migration_name: string }>>(
    'SELECT migration_name FROM `_prisma_migrations` WHERE finished_at IS NOT NULL',
  );
  const applied = new Set(done.map((row) => row.migration_name));

  const ran: string[] = [];

  for (const name of MIGRATIONS) {
    if (applied.has(name)) continue;

    const path = join(API_ROOT, 'prisma', 'migrations', name, 'migration.sql');
    const sql = readFileSync(path, 'utf8');
    const parts = statements(sql);

    for (const statement of parts) {
      await prisma.$executeRawUnsafe(statement);
    }

    await prisma.$executeRawUnsafe(
      'INSERT INTO `_prisma_migrations` (`id`, `checksum`, `migration_name`, `finished_at`, `applied_steps_count`) VALUES (?, ?, ?, NOW(3), ?)',
      crypto.randomUUID(),
      createHash('sha256').update(sql).digest('hex'),
      name,
      parts.length,
    );

    ran.push(`${name} (${parts.length} statements)`);
  }

  return ran.length === 0 ? 'already up to date' : `applied ${ran.join(', ')}`;
}
