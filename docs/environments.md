# Environments

TapTapSell runs in three environments. Each one has its **own** database,
Redis, secrets and Sentry project. Nothing is shared between them, so a mistake
in staging can never reach production data.

| | Development | Staging | Production |
|---|---|---|---|
| `NODE_ENV` | `development` | `staging` | `production` |
| MongoDB | Local Docker replica set | Separate Atlas cluster | Separate Atlas cluster |
| Redis | Optional (memory fallback) | Required | Required |
| Secrets | `.env` files on the developer's machine | Secret manager | Secret manager |
| Sentry | Off | Its own project | Its own project |
| Demo data | `npm run seed:demo` | Never | Never |

## Domains

Production runs under `stamply.taptapsell.pk`. "by TapTapSell" on every app
links to the company site, `https://taptapsell.pk`. The hosts are also listed in
`PRODUCTION_HOSTS` in `packages/brand/src/index.ts`.

| Host | App | Set on that app | Set on the API |
|---|---|---|---|
| `stamply.taptapsell.pk` | Customer portal, home page, `/business` pages (`portal/`) | `API_BASE_URL` | — |
| `business.stamply.taptapsell.pk` | Business dashboard (`web/`) | `API_BASE_URL` | `DASHBOARD_URL` |
| `admin.stamply.taptapsell.pk` | Platform console (`admin/`) | `API_BASE_URL` | `ADMIN_URL` |
| `api.stamply.taptapsell.pk` | REST API (`api/`) | — | — |

- DNS: one record per host above, or a wildcard `*.stamply.taptapsell.pk` plus
  `stamply.taptapsell.pk`. The TLS certificate must cover both (a wildcard
  certificate does not cover the bare `stamply.taptapsell.pk`).
- `API_BASE_URL` on the three front-end servers is `https://api.stamply.taptapsell.pk/api/v1`,
  or the API's private address when they run on the same network.
- On the API: `CORS_ORIGINS=https://stamply.taptapsell.pk,https://business.stamply.taptapsell.pk,https://admin.stamply.taptapsell.pk`.
  The web apps call the API from their servers, so CORS only matters for
  browser calls; the API still requires a value in production.
- `EMAIL_FROM=Stamply <no-reply@stamply.taptapsell.pk>` needs SPF and DKIM for
  `stamply.taptapsell.pk` set up with the SMTP provider.
- Each app sets its own host-only cookies, so a session on one host is never
  sent to another.
- **The portal host is permanent once stamper tags ship**: it is written onto
  every tag (see [stamper-provisioning.md](stamper-provisioning.md)). Moving the
  other three hosts later only needs new environment values.

## What the API refuses to start without

In `staging` and `production` the API exits at start-up if:

- `REDIS_URL` is missing,
- `CORS_ORIGINS` is empty,
- `DASHBOARD_URL` or `ADMIN_URL` is not a public `https://` address (they go
  into emails and printed stamper labels),
- email is not configured to really send (`EMAIL_TRANSPORT=smtp` with `SMTP_URL`;
  development prints emails, including sign-in codes, to the console),
- `INTERNAL_API_SECRET` is missing (32+ characters; the same value must be set
  on the dashboard and console servers, which use it to pass on each user's
  real IP address — without it every user shares the servers' rate limits),
- `MFA_ENCRYPTION_KEY` is missing (32 random bytes, base64; it encrypts two-step
  verification secrets at rest — losing it means every user must set up two-step
  verification again),
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are the same value.

In every environment both JWT secrets must be at least 32 characters, and
`SENTRY_DSN`, when set, must be a valid URL.

## Client addresses

The dashboard, console and customer portal call the API from their own servers. They forward
each user's IP address and browser with `INTERNAL_API_SECRET`. Set
`CLIENT_IP_HEADER` on those servers to the header your host fills in with the
real client address (for example `cf-connecting-ip` behind Cloudflare). Without
it they use the last `X-Forwarded-For` entry, which is only right when exactly
one trusted proxy sits in front of them. Never use the first entry: the
browser controls it.

## Processes

Each environment runs the API and at least one worker (`dist/worker.js`, or
`npm run worker --workspace=api`). Without a worker, owner and reward emails
stay queued in `outbox_messages` and scheduled jobs do not run. Several workers
are safe when Redis is configured. Messages that fail six times are marked
`DEAD` and kept for review.

## Uploaded files

Payment receipts that owners upload are saved under `STORAGE_DIR` (default
`./storage`, ignored by git). Until object storage (S3 or R2) is set up, staging
and production must point it at a persistent, backed-up disk that only the API
can read. Each API server needs the same disk, so run a single API instance or
use shared storage. Invoice PDFs are not stored: they are generated each time
from the invoice record.

## Secrets

- Never commit real secrets. Only `.env.example` files are tracked; CI scans
  every push for leaked secrets.
- Generate each secret separately, per environment:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

- `JWT_REFRESH_SECRET` is validated but not yet used: refresh tokens are random
  strings stored hashed in the database, not signed tokens. Rotating
  `JWT_ACCESS_SECRET` invalidates current access tokens; clients recover by
  refreshing.
- The Super Admin is created per environment with `npm run seed:admin`, using
  credentials held only in that environment's secret manager.
