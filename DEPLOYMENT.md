# Deploying Evyent to Hostinger

Production target is **Hostinger Business Web Hosting** (shared CloudLinux). That
shapes several decisions in this repo, so read this before changing them.

## What the host gives you, and what it does not

| | |
| --- | --- |
| Database | MySQL / MariaDB. **No PostgreSQL.** |
| Runtime | Node.js under Phusion Passenger |
| Containers | None. No Docker, no root. |
| Process model | Passenger runs the startup file directly |

Three consequences worth internalising:

1. **Passenger never runs `npm start`.** It executes `PassengerStartupFile`
   directly, so anything you put in a package.json script does not happen in
   production. That is why `prisma migrate deploy` runs from `src/index.ts`.
2. **The working directory is the app root, not `apps/api`.** `dotenv` reads
   `.env` from `process.cwd()`, so `lib/env.ts` resolves the file relative to
   its own module instead.
3. **The app root sits outside the document root**, at
   `~/domains/evyent.com/hbuilds/current/nodejs`. The hosting API can only read
   files under `public_html`, so the process log is not reachable through it.
   `/health` reports migration state for this reason.

## Current environment

| | |
| --- | --- |
| Domain | evyent.com |
| Hosting account | `u812134288` |
| Database | `u812134288_evyent` on `localhost:3306` |
| Node | 20 |
| App root | `~/domains/evyent.com/hbuilds/current/nodejs` |
| Startup file | `apps/api/dist/index.js` |

The app connects to MySQL over `localhost` because it runs on the same machine.
Do not switch to the external host (`srv1518.hstgr.io`) unless you also enable
remote MySQL access, which exposes the database to the internet.

## Deploying

The archive is built from git-tracked files plus a generated `.env`. The `.env`
holds the database password and JWT secret and is **never committed** — it exists
only inside the deployment artifact and in `.deploy/`, which is gitignored.

```bash
npm run typecheck && npm test && npm run build
```

Then build the archive (source only — the host runs `npm install` and
`npm run build` itself), upload it to `public_html` over TUS using credentials
from the hosting API, and start a Node build with these settings:

| Setting | Value |
| --- | --- |
| `app_type` | `express` |
| `entry_file` | `apps/api/dist/index.js` |
| `build_script` | `build` |
| `node_version` | `20` |

`app_type` matters. Deploying as `other` builds successfully and then serves
nothing, because Hostinger does not start a persistent server process for it —
the symptom is Hostinger's own 404 page on every route.

## Database on the shared tier

Prisma 6 executed queries through a Rust engine that panicked with
`PANIC: timer has gone away` on every query here, because Hostinger's shared
tier is a process-constrained CloudLinux environment. **Prisma 7 fixes this**:
it has no Rust query engine, compiling queries in TypeScript and running them
through `@prisma/adapter-mariadb`, which is plain JavaScript. Do not downgrade.

Two further constraints found the same way:

- `prisma migrate deploy` cannot run *on the host*: it spawns a native
  schema-engine binary and the spawn is denied (`EACCES`). Apply migrations from
  a machine with remote database access instead, as described below.
- **MySQL is not co-located with the app.** The database host is
  `srv1518.hstgr.io`. `localhost` on the web server is a *different* MySQL
  instance and will fail authentication.

### Remote access is required, including for the app

The database only accepts connections from whitelisted hosts. That list must
include the web server's own outbound IP, or the app gets:

```
pool timeout: failed to retrieve a connection from pool after 10000ms
```

Manage the list under hPanel -> Databases -> Remote MySQL. The account is on
`srv1518` (194.59.164.13), which is the address to add for the application
itself. Remove any temporary developer IPs when finished.

### Applying migrations

From a machine whose IP is whitelisted:

```bash
DATABASE_URL="mysql://<user>:<password>@srv1518.hstgr.io:3306/<database>"   npx prisma migrate deploy
```

## Verifying a deploy

```bash
curl https://evyent.com/health
```

```json
{ "ok": true, "service": "evyent-api", "migration": { "state": "applied" } }
```

`migration.state` is the thing to read:

| State | Meaning |
| --- | --- |
| `applied` | Schema is current |
| `skipped` | `RUN_MIGRATIONS=false` was set |
| `failed` | `detail` carries the error; `/health` returns 503 |
| `pending` | Still running, or it hung |

Then check that the SPA and a deep link both return HTML, and that an unknown
API path returns JSON rather than the SPA:

```bash
curl -o /dev/null -w "%{http_code}\n" https://evyent.com/login
curl https://evyent.com/api/nope
```

## Rolling back

Hostinger keeps previous builds under `hbuilds/`. Redeploying an earlier archive
is the rollback path. Migrations are not reversed automatically — a schema change
that must be undone needs its own forward migration.

## Before real users

This deployment is a test environment. Outstanding items:

- **The seed creates accounts with a known password.** It refuses to run against
  a non-local database without `SEED_CONFIRM=yes`. If you have seeded the demo
  event here, delete those accounts before the site is public.
- **Rotate the database password** in hPanel. The current one was generated
  during an assisted session.
- **Money is stored as `Float`.** Fine for display, wrong for accounting at
  scale. Move to `Decimal` before this handles real invoices.
- **No file upload, no payment provider, no email/SMS.** Photo upload needs
  object storage, not the local filesystem — shared hosting gives you no durable
  disk you should depend on.
- **Cold starts.** Passenger stops idle processes, so the first request after a
  quiet period is slow. Noticeable when a guest opens an invitation link.

## When to leave shared hosting

Move to a Hostinger VPS when you need Docker, PostgreSQL, a persistent disk, a
background worker for notifications, or predictable performance under load.
Nothing in the application code assumes shared hosting; only this document does.
