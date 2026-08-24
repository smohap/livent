# Contributing to livent

## Getting set up

```bash
npm run setup
npm run dev
```

`npm run setup` installs dependencies, applies the Prisma schema to a local SQLite
database and seeds the demo event. If npm blocks install scripts, run
`npm approve-scripts @prisma/client @prisma/engines prisma esbuild` once.

## Before you open a PR

```bash
npm run typecheck
npm test
npm run build
```

All three must pass. There is no lint step yet; match the surrounding style.

## Where things go

- A new organiser screen: a page in `apps/web/src/pages/app/`, a route in
  `apps/web/src/App.tsx`, and an entry in the `NAV` array in `EventShell.tsx`.
- A new API module: a router in `apps/api/src/routes/`, mounted in `apps/api/src/app.ts`.
  Scope it with `requireAuth`, `requireEventAccess` and a `requireCapability(...)`.
- A new capability: add it to `CAPABILITIES` in `apps/api/src/lib/rbac.ts` and grant it
  in the `MATRIX` for the roles that should have it.
- Schema changes: edit `apps/api/prisma/schema.prisma`, then `npm run db:push`.

## Conventions

- **Derive money, don't store it twice.** A category's `committed` figure is computed
  from approved invoices everywhere it appears. Adding a second source of truth for the
  same number is how the dashboard and the finance page start disagreeing.
- **Guest-facing handlers scope to the token.** Everything under `/api/public/me/:token`
  must resolve the guest from the token and constrain every query to that guest's own
  event. Never trust an id in the body.
- **Never store card data.** Payment goes through a provider; only the tokenised
  reference is persisted.
- **Fail loudly, not silently.** The seating engine reports who it could not seat and
  why. Prefer that shape over swallowing an edge case.
- **Comments explain why.** The code already says what it does.

## Design system

Strict grayscale. No colour tokens, no coloured accents. Depth comes from the two glass
tiers in `apps/web/src/index.css`, never from hue. Don't add `border-*` classes to glass
surfaces - the masked `::before` gradient is the border.
