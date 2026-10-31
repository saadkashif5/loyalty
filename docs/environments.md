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

## What the API refuses to start without

In `staging` and `production` the API exits at start-up if:

- `REDIS_URL` is missing,
- `CORS_ORIGINS` is empty,
- `MFA_ENCRYPTION_KEY` is missing (32 random bytes, base64; it encrypts two-step
  verification secrets at rest — losing it means every user must set up two-step
  verification again),
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are the same value.

In every environment both JWT secrets must be at least 32 characters, and
`SENTRY_DSN`, when set, must be a valid URL.

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
