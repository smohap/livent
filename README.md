# livent

**The operating system for every event.**
Plan it. Invite. Coordinate. Pay. Experience. Remember.

Most event tools manage a single event: one date, one guest list, one RSVP form. Real
events rarely work that way. A wedding is an engagement, a mehendi, a sangeet, a
ceremony and a reception. A conference is registration, a keynote, breakout sessions
and a dinner. Each has its own guests, schedule, budget and team, yet all of it belongs
to one story told to one host and one guest list.

livent's core thesis:

> one event -> multiple phases -> multiple teams -> multiple guests -> one shared workspace

---

## Quick start

```bash
npm run setup
```

That installs dependencies, creates the SQLite database and seeds a full demo event.
Then:

```bash
npm run dev
```

- Organiser app: http://localhost:5173
- API: http://localhost:4000

Sign in to the demo workspace with:

| Email | Password | Role |
| --- | --- | --- |
| `sarah@livent.app` | `livent2026` | Owner |
| `manager@livent.app` | `livent2026` | Event manager |
| `finance@livent.app` | `livent2026` | Finance |
| `catering@livent.app` | `livent2026` | Catering team lead |

If `npm install` reports blocked install scripts, approve them once:

```bash
npm approve-scripts @prisma/client @prisma/engines prisma esbuild
```

---

## What is in the box

The build covers the PRD's MVP scope, plus the run-of-show and check-in surfaces.

### Organiser

| Screen | What it does |
| --- | --- |
| Command Centre | Guest, finance, task and ticket health across every phase, with proactive alerts |
| Phases | Add, edit and delete the phases inside a master event |
| Guests & RSVP | The multi-phase RSVP matrix: one row per guest, one column per phase |
| Seating | Rule-aware one-click table allocation, with locks and manual moves |
| Menu | Per-phase menu builder and the live caterer count |
| Tasks & Teams | Team-scoped board with dependencies that block completion |
| Budget & Invoices | Budget vs committed vs paid, and the four-step approval ladder |
| Polls & Comms | Broadcasts across in-app, email, SMS and push, plus live polls |
| Photos & Video | Branded albums with guest uploads and download controls |
| Ticketing | Ticket types, capacity and QR/code door check-in |
| Run of Show | Live event-day control room: what is on now, what is next, who owns it |
| Settings | Event details, the public site link, and role-based access |

### Guest

No account, no install. A guest opens their personalised link and gets:

- every phase they were invited to, with a per-phase yes / maybe / no
- their table number and who else is on it
- their meal choice, with dietary and allergen labels
- their tickets, the schedule, host announcements
- a monetary gift flow

Each event also gets an auto-generated public mini-site at `/e/<slug>`.

---

## The seating engine

The differentiator, and the piece worth reading first:
[`apps/api/src/services/seating.ts`](apps/api/src/services/seating.ts).

Given confirmed guests, table geometry and organiser rules, it produces an allocation
in one pass with these priorities:

1. Never violate a hard "must not sit together" rule.
2. Keep "must sit together" clusters intact on one table.
3. Respect table kinds (VIPs to VIP tables, children to children tables).
4. Keep guest groups contiguous.
5. Fill tables evenly rather than packing the first tables full.

Locked tables are immovable: their occupants leave the pool and their capacity is not
offered to anyone else. The engine is seeded, so "Regenerate" produces a genuinely
different-but-valid arrangement rather than random churn, and a given seed always
reproduces the same room.

When it cannot seat someone it says so, with the reason, rather than dropping them
silently. Covered by `apps/api/test/seating.test.ts`.

---

## Architecture

```
livent/
  apps/
    api/            Express + Prisma + SQLite, JWT auth
      prisma/       schema.prisma and the demo seed
      src/
        routes/     one router per module
        services/   seating engine, event health, templates
        lib/        prisma client, http helpers, RBAC matrix
      test/         seating engine tests
    web/            React + Vite + Tailwind + TanStack Query
      src/
        pages/      landing, auth, organiser app, guest surfaces
        components/ glass primitives and shared UI
        lib/        api client, types, formatting
  docs/             the source PRD and mockup
```

Seven foundational objects underpin the schema: **Event, Phase, People, Teams, Tasks,
Money, Experience**. Everything else (RSVP, seating, menus, tickets, media, invoices)
attaches to one of them.

Two details worth knowing:

- **`committed` is always derived** from approved invoices, in both the finance module
  and the health rollup, so the dashboard and the budget page can never disagree.
- **Guests authenticate by opaque token**, not by login. `Guest.accessToken` powers both
  the invitation and the portal, and every guest-facing handler scopes strictly to that
  token's own event.

### Commands

| Command | Does |
| --- | --- |
| `npm run dev` | API and web together |
| `npm run build` | Type-check and build both |
| `npm run typecheck` | Type-check both |
| `npm test` | Seating engine tests |
| `npm run db:push` | Apply the schema |
| `npm run db:seed` | Rebuild the demo event |
| `npm run db:studio -w @livent/api` | Prisma Studio |

---

## Roles

RBAC is enforced per event, with a capability matrix in
[`apps/api/src/lib/rbac.ts`](apps/api/src/lib/rbac.ts) and row-level narrowing in the
route handlers (a team lead sees only their own team's board).

`owner` - `manager` - `team_lead` - `team_member` - `finance` - `vendor` - `sponsor` -
`checkin`

---

## Security notes

- Passwords are bcrypt hashed; login returns the same message whether or not the account
  exists, so the endpoint cannot enumerate accounts.
- **No card data is ever stored.** `Gift.providerRef` holds a tokenised reference from a
  payment provider (Stripe/Adyen). The gift flow records intent; a production deployment
  completes payment with the provider before posting the token here.
- Set a real `JWT_SECRET` in production - the API refuses to boot with the dev default
  when `NODE_ENV=production`.

---

## Not built yet

Deliberately out of MVP scope, per the PRD's phasing: sponsorship and the sponsor
portal, the vendor portal, accommodation and transport modules, WhatsApp delivery,
speaker and exhibitor management, badge printing, and the Phase 3 AI assistant and
marketplace. The rules-based alert engine in
[`apps/api/src/services/insights.ts`](apps/api/src/services/insights.ts) is the
foundation the AI operations layer is meant to sit on.

Notification channels are recorded on each broadcast but no email/SMS/push worker is
wired up - delivery is modelled, not sent.

---

## Design

Strict grayscale liquid-glass, over a looping video on the landing page and drifting
monochrome fields inside the app. Two glass tiers (`.liquid-glass`,
`.liquid-glass-strong`) defined in [`apps/web/src/index.css`](apps/web/src/index.css);
the hairline edge is a masked `::before` gradient rather than a border, which is what
makes panels read as glass rather than as cards. Poppins throughout, Source Serif 4
italic reserved for emphasis inside headings.

The source PRD and mockup live in [`docs/`](docs/).
