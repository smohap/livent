import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createApp, setMigrationState } from './app.js';
import { API_ROOT, env } from './lib/env.js';

/*
 * The host runs this file directly through Passenger, so package.json scripts
 * never execute and `prisma migrate deploy` has to happen here or the schema
 * would never be created.
 *
 * It runs *after* the server is listening, for two reasons: Passenger applies a
 * startup timeout that a slow migration could exceed, and a database problem
 * should surface as a readable status rather than a process that never binds.
 */
function migrate(): string {
  const require = createRequire(import.meta.url);
  const prismaCli = require.resolve('prisma/build/index.js');

  const output = execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    encoding: 'utf8',
    env: process.env,
    timeout: 120_000,
  });
  return output.trim().split('\n').slice(-3).join(' | ');
}

const app = createApp();

app.listen(env.port, () => {
  console.log(`Evyent listening on port ${env.port} (${env.nodeEnv})`);

  if (process.env.RUN_MIGRATIONS === 'false') {
    setMigrationState({ state: 'skipped' });
    return;
  }

  try {
    const summary = migrate();
    setMigrationState({ state: 'applied', detail: summary });
    console.log('Migrations applied.', summary);
  } catch (error) {
    const err = error as { message?: string; stderr?: string; stdout?: string };
    const detail = [err.stderr, err.stdout, err.message]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 1500);
    setMigrationState({ state: 'failed', detail });
    console.error('Database migration failed.', detail);
  }
});
