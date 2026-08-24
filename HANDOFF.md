# Evyent - handoff

Read this first. It captures the state, the constraints that are expensive to
rediscover, and the work still outstanding.

**Repo:** https://github.com/smohap/livent (repository still named `livent`;
the *application* was renamed to Evyent)
**Live:** https://evyent.com
**Stack:** npm workspaces. `apps/api` Express + Prisma 7 + MySQL. `apps/web`
React + Vite + Tailwind. The API serves the built SPA, so it is one origin.

---

## Do this first (one manual step, then the app works)

The database rejects the web server's own connections. In **hPanel -> Databases
-> Remote MySQL**:

1. **Add `194.59.164.13`** - the account's server (`srv1518`). Without it every
   database call fails with `pool timeout: failed to retrieve a connection`.
2. **Remove `149.19.26.103`** - a developer IP added temporarily to apply
   migrations.

No redeploy needed. Verify:

```bash
curl https://evyent.com/health
```

`migration.state` should read `applied`. The schema (31 tables) is already
created, so it should report already-up-to-date.

---

## Constraints that cost real time to find

Do not undo these without reading why.

| Constraint | Why |
| --- | --- |
| **Prisma 7, never 6** | Prisma 6's Rust query engine panics with `timer has gone away` on every query here. v7 has no Rust engine - it compiles queries in TypeScript and runs them through `@prisma/adapter-mariadb`, which is plain JS. |
| **Database host is `srv1518.hstgr.io`** | MySQL is *not* co-located. `localhost` on the web server is a different MySQL instance and fails authentication. |
| **Migrations run from a whitelisted dev machine** | `prisma migrate deploy` spawns a native schema-engine binary; the host denies it (`EACCES`). Run it locally against the remote host instead. |
| **Deploy as `app_type: express`** | Deploying as `other` builds fine and then serves nothing, because Hostinger starts no persistent process. Symptom is Hostinger's own 404 on every route. |
| **`entry_file: apps/api/dist/index.js`** | Passenger runs this file directly. `npm start` never executes, so nothing in package.json scripts happens in production. |
| **`.env` resolved relative to the module** | Passenger's working directory is the repo root, not `apps/api`, so `dotenv`'s default lookup misses. See `apps/api/src/lib/env.ts`. |

Full detail in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Deploy procedure

Secrets live in `.deploy/secrets.env` (gitignored, never committed). The archive
is git-tracked files plus a generated `apps/api/.env`.

1. `npm run typecheck && npm test && npm run build`
2. Build a zip of `git ls-files` (excluding `docs/` and any `dist/`), adding
   `apps/api/.env` and `.env` from `.deploy/secrets.env`
3. Get upload credentials from the hosting API, PUT the zip to `public_html`
   over TUS (credentials expire in ~6h; regenerate on 403)
4. Start a Node build with the settings in the table above

Hostinger's API returns intermittent 500s, especially on upload-credential and
remote-connection endpoints. Retrying usually works.

---

## Outstanding work

In suggested order. Items 1-2 are functional and unblock the owner; 3-4 are
self-contained; 5 is its own pass.

1. **Admin panel.** Platform-level admin, distinct from the existing per-event
   RBAC in `apps/api/src/lib/rbac.ts`. `siddhartha.mohapatra@gmail.com` is the
   first admin; admins can promote others. Needs a `User.isAdmin` (or role)
   column plus a migration.
2. **Google sign-in.** Alongside the existing email/password. Requires a Google
   OAuth client; the owner supplies the credentials into the server `.env` -
   do not put them in the repo.
3. **Footer**, styled like joinza.io's but in Evyent's design. Must state the
   product is **a product of AIDO Technologies Ltd**.
4. **Pricing page** modelled on joinza.io/pricing, splitting existing features
   across **Free / Plus / Pro**.
5. **Light green tint.** DECIDED: a *tint*, not a light theme. Keep the dark
   liquid-glass aesthetic and make the app pages match the landing page rather
   than diverge from it - the landing keeps its video background, and the app's
   ambient blobs (`apps/web/src/components/Ambient.tsx`) pick up a soft green
   cast. This is a small change; do not rebuild the palette as a light theme.
6. **Back to landing** from login/signup. The logo already links to `/`; add an
   explicit affordance.

### Known gaps, unrelated to the above

- Ten API endpoints have no UI, including **seating rules** (the headline
  differentiator) and the run-sheet editor. See the repo history for the list.
- No file upload, no payment provider, no email/SMS. Photo upload needs object
  storage - shared hosting has no durable disk.
- Money is `Float`. Fine for display, wrong for accounting; move to `Decimal`
  before real invoices.
- Tests cover the seating engine only (7 tests). No API or frontend tests, no CI.
- The demo seed creates accounts with a known password and refuses to run
  against a non-local database without `SEED_CONFIRM=yes`. It has **not** been
  run against production.

### Security follow-ups

- Rotate the database password in hPanel; the current one passed through an
  assisted session.
- Remove the developer IP from Remote MySQL (see step 1).
