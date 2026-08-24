import { createApp, setMigrationState } from './app.js';
import { applyMigrations } from './services/schema-bootstrap.js';
import { boot } from './lib/bootlog.js';
import { API_ROOT, env } from './lib/env.js';

process.on('uncaughtException', (error) => {
  boot('uncaughtException', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => boot('unhandledRejection', reason));

boot('module-loaded', {
  node: process.version,
  cwd: process.cwd(),
  apiRoot: API_ROOT,
  port: env.port,
  envPort: process.env.PORT ?? null,
  nodeEnv: env.nodeEnv,
  hasDbUrl: Boolean(process.env.DATABASE_URL),
});

const app = createApp();
boot('app-created');

const server = app.listen(env.port, () => {
  boot('listening', { address: server.address() });

  if (process.env.RUN_MIGRATIONS === 'false') {
    setMigrationState({ state: 'skipped' });
    return;
  }

  applyMigrations()
    .then((summary) => {
      setMigrationState({ state: 'applied', detail: summary });
      boot('migrations-applied', summary);
    })
    .catch((error: unknown) => {
      const detail = (error instanceof Error ? error.message : String(error)).slice(0, 1500);
      setMigrationState({ state: 'failed', detail });
      boot('migrations-failed', detail);
    });
});
