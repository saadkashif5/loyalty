# TapTapSell Loyalty

NFC-first digital loyalty platform for Pakistani businesses. See [PRD.md](PRD.md) for the full product definition and [TODO.md](TODO.md) for the implementation checklist.

## Repository layout

```
taptapsell-loyalty/
├── api/          Node.js + TypeScript REST API (modular monolith)
├── web/          Next.js business & platform admin dashboard
├── mobile/       React Native (Expo) customer app
├── packages/
│   ├── constants/    roles, permissions, statuses shared across apps
│   ├── types/        shared API response types
│   └── validation/   zod schemas shared by API and clients
└── docs/
```

`api`, `web` and `packages/*` are npm workspaces. `mobile` is kept outside the
workspace set so Metro resolves its dependencies without symlink workarounds.

## Getting started

```bash
npm install
cp api/.env.example api/.env   # then fill in real values
npm run dev:api
```

The API requires MongoDB. Transactions are used for the stamp flow, so the
database must be a replica set — MongoDB Atlas is one by default; a local
standalone `mongod` is not.

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
