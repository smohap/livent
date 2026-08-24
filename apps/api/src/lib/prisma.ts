import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

/*
 * Prisma 7 executes queries through a driver adapter rather than a native
 * engine. The MariaDB adapter speaks to both MariaDB and MySQL and is pure
 * JavaScript, which is what makes this run on Hostinger's shared tier.
 */
const adapter = new PrismaMariaDb(env.databaseUrl);

export const prisma = new PrismaClient({
  adapter,
  log: env.isProd ? ['error'] : ['warn', 'error'],
});
