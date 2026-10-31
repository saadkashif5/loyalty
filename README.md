# TapTapSell Loyalty

NFC-first digital loyalty platform for Pakistani businesses. See [PRD.md](PRD.md) for the original product definition, [ROADMAP.md](ROADMAP.md) for the current phased plan and [TODO.md](TODO.md) for the detailed checklist.

## Repository layout

```
taptapsell-loyalty/
├── api/          Node.js + TypeScript REST API (modular monolith)
├── web/          Next.js business dashboard (owners, managers, staff)
├── admin/        Next.js platform console (TapTapSell team only)
├── portal/       Next.js customer portal (opened by tapping a stamper)
├── mobile/       React Native (Expo) customer app
├── packages/
│   ├── constants/    roles, permissions, statuses shared across apps
│   ├── types/        shared API response types
│   └── validation/   zod schemas shared by API and clients
└── docs/         provisioning and environment guides
```

`api`, `web`, `admin`, `portal` and `packages/*` are npm workspaces. `mobile` is kept outside the
workspace set so Metro resolves its dependencies without symlink workarounds.

## Getting started

```bash
npm install
docker compose up -d --wait            # MongoDB replica set on :27017, Redis on :6379
cp api/.env.example api/.env           # then fill in real values
npm run seed:admin --workspace=api     # needs SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD
npm run seed:demo --workspace=api      # demo café, stamper DEMO01, three customers
npm run dev:api
npm run dev:web                        # business dashboard on :3000
npm run dev:admin                      # platform console on :3001
npm run dev:portal                     # customer portal on :3002
```

Sign in to the console at `http://localhost:3001` as the Super Admin; it asks
for two-step verification to be set up first. Businesses join by invitation:
**Businesses → Invite a business** creates the business and gives you a link
for its owner, who accepts it on the business dashboard.

Customers open the portal by tapping a stamper (`/t/<stamper id>?m=...`, see
[docs/stamper-provisioning.md](docs/stamper-provisioning.md)) and sign in with a
code sent to their email. In development the email is printed in the API's
console instead of being sent.

The API requires MongoDB. Transactions are used for the stamp flow, so the
database must be a replica set — MongoDB Atlas is one by default; a local
standalone `mongod` is not. Redis is optional in development (rate limits fall
back to memory) and required in staging and production. See
[docs/environments.md](docs/environments.md).

## Everyday commands

| Command | What it does |
|---|---|
| `npm run lint` | ESLint across `api`, `web` and `packages` |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run typecheck` | TypeScript in every workspace |
| `npm test` | Integration tests (needs `docker compose up -d`) |
| `npm run build:api` / `build:web` / `build:admin` / `build:portal` | Production builds |
| `npm run jobs --workspace=api` | Scheduled jobs: subscription lifecycle and reminders, reward expiry (schedule it, e.g. hourly) |

A pre-commit hook runs ESLint and Prettier on staged files. CI runs all of the
above plus a dependency audit, secret scanning and CodeQL on every push and
pull request.

## Running tests

```bash
docker compose up -d          # single-node MongoDB replica set on :27017
npm test --workspace=api
```

Set `MONGODB_TEST_URI` to point the suite at a different cluster.

## Architecture notes

- **The backend is the source of truth.** NFC tags and QR codes carry only a
  public device identifier. They never carry stamp counts, reward state, or
  credentials, and the client never decides whether a stamp is valid.
- **Business authorization is per-business.** Roles live in `business_members`,
  scoped to `(userId, businessId)`. There is deliberately no global `user.role`
  driving business access — one person can be an owner, a manager elsewhere, and
  a customer, all at once.
- **The stamp transaction is atomic.** Stamp creation, progress increment, and
  reward unlock commit together, and an `Idempotency-Key` makes retries safe.
