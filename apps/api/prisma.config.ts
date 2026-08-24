import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * CLI-side configuration (migrate, generate). The running app does not read
 * this file: it connects through the driver adapter in src/lib/prisma.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
