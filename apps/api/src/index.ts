import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createApp } from './app.js';
import { API_ROOT, env } from './lib/env.js';

/*
 * Apply pending migrations before serving. This lives here rather than only in
 * the npm start script because the host may launch the compiled entry point
 * directly, in which case package.json scripts never run and the schema would
 * silently never be created.
 *
 * `migrate deploy` is idempotent: it applies what is outstanding and is a no-op
 * once the database is current.
 */
function migrate(): void {
  const require = createRequire(import.meta.url);
  const prismaCli = require.resolve('prisma/build/index.js');

  console.log('Applying database migrations...');
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: API_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

if (process.env.RUN_MIGRATIONS !== 'false') {
  try {
    migrate();
  } catch (error) {
    // A broken schema means every request fails, so surface it and stop rather
    // than serving a half-working app.
    console.error('Database migration failed. Refusing to start.', error);
    process.exit(1);
  }
}

const app = createApp();

app.listen(env.port, () => {
  console.log(`Evyent listening on port ${env.port} (${env.nodeEnv})`);
});
