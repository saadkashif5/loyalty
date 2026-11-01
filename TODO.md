# TapTapSell Loyalty — MVP TODO

Derived from `PRD.md`. Scope is bounded by §3 (Non-Goals) and §70 (Final MVP Boundary):
> Can a real Pakistani business set up a loyalty program and can a real customer repeatedly earn and redeem loyalty rewards using a simple NFC tap, without the business needing dedicated electronic hardware?

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Implementation status

_Last reviewed against the code on 2026-10-31. Phase-level progress is tracked in
[ROADMAP.md](ROADMAP.md); this file keeps the detailed checklist. Google/Apple Wallet pass support
has been considered and **deferred**._

| Area | State |
|---|---|
| Monorepo scaffold, shared packages | Built (npm workspaces) |
| Tooling | ESLint 9, Prettier, EditorConfig, lint-staged pre-commit hook; CI, CodeQL, gitleaks and Dependabot configured (first GitHub run pending a push) |
| Dependencies | `npm audit --omit=dev`: no high or critical; 5 moderate in Sentry's build-time source-map plugin (`glob`/`minimatch`), which only runs with `withSentryConfig` and is not used here |
| Backend foundation (config, helmet/CORS, request id, pino logging, errors, rate limiting, idempotency) | Built; rate limits use Redis when `REDIS_URL` is set; Sentry when `SENTRY_DSN` is set |
| API production build | Bundled with tsup; `node dist/server.js` starts and serves requests |
| Mongoose models + indexes | Built |
| Auth (register/login/refresh/logout, bcrypt, rotating hashed refresh tokens with reuse revocation) | Built, plus TOTP two-step verification with recovery codes (mandatory for platform users and owners) and session list/remote sign-out — no password reset, email/OTP verification or profile update |
| RBAC (per-business membership, role hierarchy, permission matrix; platform roles SUPER_ADMIN/ADMIN/SUPPORT/FINANCE with their own permission matrix) | Built |
| Businesses, branches, members (invite/accept/update), programs, cards, devices, rewards, redemptions | Built |
| Stamp flow (atomic transaction, cooldown, idempotency, tiered reward unlock, manual stamp route) | Built |
| Device lifecycle (mint, assign, activate, revoke, replace, suspend with business) | Built |
| Tap verification (NTAG 215 UID + counter mirror, single-use tap tokens, pluggable per-chip verifiers) | Built — see `docs/stamper-provisioning.md`; NTAG 424 DNA verifier not started |
| Analytics (overview, stamps/day, near-completion), platform admin API, audit log, public discovery + stamper resolve | Built |
| Notifications | Persisted + list/read/preferences only — no push delivery |
| Business web dashboard (Next.js 16) — auth, overview, programs, rewards, devices, branches, staff, activity, redeem | Built, `next build` passes. Create-only forms (no edit UI); no customers page, settings or analytics charts beyond 14-day bars |
| Owner onboarding | Invite-only: platform creates the business and invites the owner; `/invite/[token]` accept page; self-serve business creation removed; public lead form (`POST /leads`) |
| Customer portal (`portal/`, Phase 2) | Built: tap route (verify tap → stamp for members, hold tap for others), join page, email code sign-up/sign-in, my cards, card page with stamp progress and reward QR, rewards, profile, tap-error page, background session renewal. Counter code for phones that cannot tap; reward use-by dates. Not built: Urdu, Web NFC, offline handling |
| Subscriptions and billing (Phase 3) | Editable versioned plans (Starter/Growth/Pro/Enterprise defaults); plan limits enforced; trial on invitation (starts on acceptance); lifecycle job (invoice → reminders → past due → billing suspension → cancelled) with owner emails; numbered PDF invoices with NTN/STRN and tax; billing settings (bank accounts, Raast); owner receipt upload with console approve/reject; manual payments; per-business discount and invoice void; CSV export; console Finance, Plans, Receipts and Billing settings pages; owner Billing page and banners. Owner self-service plan change with proration; scheduled downgrades; hardware charges; churn, trial conversion and revenue by plan. Not built: card gateway, coupons, credit notes and refunds, plan feature flags |
| Counter mode, limits and alerts (Phase 2) | Staff stamp by scanning/typing the customer's one-time card code; per-card and per-staff daily limits; alerts (stamper bursts, replayed links, copied chips, staff limits) reviewed by owners/managers and visible platform-wide; reward expiry with reminder job; dashboard sign-in by emailed code |
| Business dashboard (Phase 1) | Role-aware navigation; setup wizard + checklist; settings; edit programs/rewards/branches; staff roles, disable and branch limits; staff invitation accept/decline; customers list (masked) and detail; report a stamper problem (lost = revoked); read-only suspended mode with reason; background session renewal |
| Platform admin console (`admin/`, separate Next.js app) | Built: sign-in with two-step, overview, businesses (search, invite, detail, suspend/restore, invitations, assign stamper), leads, stamper fleet (mint, list), users, audit log, team, own security. Not built: view-as-business, labels/QR printing |
| Customer mobile app (Expo) — auth, cards, card detail, NFC scan, rewards, discover, join, profile | Written, **not yet installed or run**; frozen per ROADMAP (customer portal replaces it) |
| Integration test suite (`api/tests/coreLoop.test.ts`, `platform.test.ts`, `dashboard.test.ts`, `emailCode.test.ts`, `counter.test.ts`, `billing.test.ts`, `invoices.test.ts`, `planChange.test.ts`, `tenantIsolation.test.ts`, `scrub.test.ts`) | **124/124 passing** against the Docker replica set; each test worker uses its own database |
| Seed scripts | `seed:admin` (Super Admin), `seed:demo` (demo café, stamper, customers) |
| Push notifications, QR stamping, campaigns, subscriptions, account deletion, password reset, deployment | Not started |

**Not yet verified:** no staging or production environment exists; no NFC hardware has been
tested. In real Chrome, only plan switching, receipt upload and receipt approval have been clicked
through; other forms (server actions) have not been submitted in a browser.

---

## 0. Project Setup & Repository

- [x] Initialize git repository
- [x] Create monorepo structure (§56)
  - [x] `web/` — Next.js business/admin dashboard
  - [x] `mobile/` — React Native customer app
  - [x] `api/` — Node.js REST API
  - [x] `packages/types/` — shared TypeScript types
  - [x] `packages/validation/` — shared validation schemas
  - [x] `packages/constants/` — shared constants (roles, statuses, enums)
  - [ ] `docs/architecture/`
- [x] Root-level tooling: ESLint, Prettier, EditorConfig, commit hooks
- [x] Decide package manager / workspace tool (npm/pnpm/yarn workspaces or Turborepo) — _npm workspaces; `mobile` kept outside the workspace set_
- [x] `.gitignore` (env files, build artifacts, secrets)
- [x] `.env.example` per app (never commit real secrets — §30, §47)
- [~] README per app with local setup instructions — _root README covers api and web setup; `mobile` has its own_
- [ ] Set up GitHub repo + branch protection (if using GitHub Actions per §46)

---

## 1. Environment Separation (§47)

- [~] Define `development`, `staging`, `production` environments — _documented in `docs/environments.md`; API refuses unsafe staging/production config; infrastructure not provisioned_
- [ ] Separate MongoDB database per environment
- [ ] Separate API credentials/secrets per environment
- [ ] Separate auth (JWT) secrets per environment
- [ ] Separate push notification credentials per environment
- [ ] Separate NFC/device config where needed
- [~] Secret management strategy (env vars / vault) — confirm nothing committed to Git — _strategy documented; gitleaks scans every push; secret manager not chosen_

---

## 2. Database Design (MongoDB Atlas + Mongoose) (§26–27)

- [ ] Provision MongoDB Atlas cluster(s) per environment
- [x] Define Mongoose schemas:
  - [x] `users`
  - [x] `businesses`
  - [x] `business_members` (role-scoped, NOT a global `user.role`)
  - [x] `branches`
  - [x] `loyalty_programs`
  - [x] `loyalty_cards`
  - [x] `nfc_devices`
  - [x] `stamps`
  - [x] `rewards`
  - [x] `redemptions`
  - [x] `notifications`
  - [x] `audit_logs`
- [x] Define indexes (§27):
  - [x] `users.email` (unique)
  - [x] `users.phone` (unique)
  - [x] `businesses.slug` (unique)
  - [x] `business_members` compound index on `userId + businessId` (unique)
  - [x] `loyalty_cards` compound index on `customerId + programId` (unique)
  - [x] `nfc_devices.deviceIdentifier` (unique)
  - [x] `stamps` compound index on `customerId + programId + createdAt`
  - [x] `stamps.idempotencyKey` (unique, scoped appropriately)
  - [x] `redemptions.redemptionCode` (unique)
  - [x] `audit_logs` compound index on `businessId + createdAt`
  - [x] `notifications` compound index on `userId + status`
- [x] Decide on MongoDB transactions usage for stamp/reward atomic flow (§28)
- [x] Seed/fixture scripts for local development — _`seed:admin`, `seed:demo`_
- [ ] Backup & recovery procedure defined (§69)

---

## 3. Backend API — Foundation (§24–25)

- [x] Bootstrap Node.js + TypeScript project
- [x] Choose framework: Express or Fastify
- [x] Set up modular monolith folder structure:
  - [ ] `config/`, `middleware/`, `modules/*`, `models/`, `services/`, `repositories/`, `utils/`, `routes/`, `jobs/`, `app.ts`
- [x] Establish request flow convention: Route → Middleware → Controller → Service → Repository/Model → MongoDB
- [x] Global error handling middleware (no stack traces/DB errors leaked — §30, §62)
- [x] Request validation layer (e.g. zod/joi) shared via `packages/validation`
- [x] API response envelope standard (consistent success/error shape)
- [x] API versioning (`/api/v1/...`)
- [x] Pagination utility for list endpoints
- [x] Request correlation ID middleware
- [x] Rate limiting middleware (global + per-route overrides)
- [x] CORS configuration
- [x] Secure headers (helmet or equivalent)
- [x] Request size limits
- [x] Idempotency-Key middleware/utility for sensitive writes (stamps, redemptions)
- [x] Structured logging (no sensitive info in logs — §30, §45)

---

## 4. Authentication & Authorization

### Authentication (§23)
- [x] Decide MVP auth method: email/password vs phone/OTP (Pakistan-market friction) — **open decision, §67**
- [x] `POST /api/v1/auth/register`
- [x] `POST /api/v1/auth/login`
- [ ] OTP/email verification flow (if selected)
- [ ] `POST /api/v1/auth/forgot-password` / reset flow
- [x] Password hashing with an established algorithm (bcrypt/argon2)
- [x] Short-lived access tokens (JWT)
- [x] Refresh tokens + rotation
- [x] Token revocation / session management
- [x] `POST /api/v1/auth/refresh`
- [x] `POST /api/v1/auth/logout`
- [x] Secure mobile token storage (SecureStore) — never plain local storage

### Authorization / RBAC (§5, §6, §29)
- [x] Implement platform roles: `SUPER_ADMIN`, `ADMIN`
- [x] Implement business roles: `OWNER`, `MANAGER`, `STAFF`
- [x] Implement `CUSTOMER` role
- [x] `business_members` collection drives per-business role resolution (not global `user.role`)
- [x] Authorization middleware chain: authenticated user → business membership → role → permission → resource scope
- [x] Permission matrix/config per role (documented and enforced centrally, not ad hoc per controller)
- [x] Guard: business A cannot access business B's data (tenant isolation)
- [x] Guard: customers cannot access business dashboard endpoints
- [x] Guard: staff cannot modify platform/business-critical settings
- [x] Guard: revoked/expired sessions cannot make privileged requests
- [x] Support one user having multiple roles across businesses + a customer identity simultaneously

---

## 5. Backend Modules — Core Domain

### Users (`/api/v1/users`)
- [x] Get current user profile
- [~] Update profile — _no `PATCH /users/me`; only notification preferences_
- [~] Manage notification preferences — _API only; no mobile settings screen_
- [ ] Account deletion request endpoint (§59) — _`DELETED` user status defined only_

### Businesses (`/api/v1/businesses`)
- [x] Create business
- [x] Get/update business profile
- [~] Business status (active/suspended) — _admin-only toggle; owner sees no status UI_
- [x] Business branding fields (logo, category, contact)
- [x] Slug generation/uniqueness

### Business Members (`/api/v1/business-members`)
- [x] Invite staff/manager
- [x] Assign/change role
- [x] Disable/remove member
- [x] List members by business
- [~] Permission overrides where applicable — _middleware honours `member.permissions`; no endpoint/UI sets them_

### Branches (`/api/v1/branches`)
- [x] Create branch
- [x] Edit branch
- [x] Activate/deactivate branch
- [~] Assign devices to branch — _branch is set at admin assign / owner activation; no re-assign endpoint_
- [~] Assign staff to branch — _`branchIds` stored on member; never enforced on stamp/redeem_
- [x] List branches by business

### Loyalty Programs (`/api/v1/loyalty-programs`)
- [x] Create program (name, description, required stamps, branch scope, dates, branding, terms, eligibility)
- [x] Edit program
- [x] Activate/deactivate program
- [x] List programs by business
- [x] Branch-scoping logic (all vs selected branches) (§35)
- [x] Program start/end date enforcement

### Loyalty Cards (`/api/v1/loyalty-cards`)
- [x] Create/join loyalty card for customer + program
- [x] Get card detail (stamp count, progress, rewards, recent activity)
- [x] List customer's cards across businesses
- [~] Expiration handling where applicable — _`EXPIRED` card status defined; no expiry job_

### NFC Devices (`/api/v1/nfc-devices`)
- [x] Device registration (platform admin / business owner flow)
- [x] Device activation via activation code
- [x] Device status lifecycle: `UNASSIGNED → ASSIGNED → ACTIVE → SUSPENDED/REVOKED → REPLACED` (§39)
- [x] Assign device to business/branch
- [x] Revoke device
- [x] Device replacement flow (old revoked, new assigned/activated, history preserved) (§61)
- [x] Device metadata storage
- [x] Ensure a device belongs to only one business/branch at a time

### Stamps (`/api/v1/stamps`)
- [x] `POST /stamps` — create stamp (NFC/QR/ADMIN source)
- [~] Full validation pipeline (§13.1):
  - [x] Customer authentication
  - [x] Customer loyalty-card membership
  - [x] Business/device relationship
  - [x] Active loyalty program check
  - [~] Program eligibility check — _active/date/branch checks only; no customer eligibility rules_
  - [x] Device status check (active, not revoked/suspended)
  - [x] Duplicate/replay detection
  - [x] Rate limit enforcement
  - [x] Idempotency key handling
- [x] Atomic stamp creation + loyalty progress increment (Mongo transaction) (§28)
- [x] Reward threshold check → auto create/unlock reward atomically
- [x] Stamp history endpoint (by customer, by business, by branch)
- [x] Manual/admin stamp issuance path (`source=ADMIN`) with audit trail

### Rewards (`/api/v1/rewards`)
- [x] Create reward (linked to program)
- [x] Edit reward
- [x] Activate/deactivate reward
- [x] List rewards by program/business
- [x] Reward types (free item, % off, fixed discount, etc.)
- [x] Expiration handling
- [x] Redemption limit/rules configuration

### Redemptions (`/api/v1/redemptions`)
- [x] Request redemption (customer)
- [x] Server-side eligibility verification
- [x] Generate unique redemption code/ID
- [x] Staff verification endpoint (mark as redeemed)
- [x] Atomic status transition (prevent double redemption) (§17.2, §28)
- [x] Redemption history (business + customer views)
- [x] Audit log entry per redemption

### Notifications (`/api/v1/notifications`)
- [x] Notification data model + abstraction layer (channel-agnostic: push now, email/SMS/WhatsApp later) (§22)
- [ ] Push notification integration (Firebase Cloud Messaging) — _notifications are persisted as PENDING; nothing sends them_
- [x] Trigger: stamp added
- [x] Trigger: reward unlocked
- [~] Trigger: reward expiring — _type defined; no scheduler_
- [x] Trigger: reward redeemed
- [~] Trigger: loyalty milestone — _type defined; never emitted_
- [~] Trigger: business announcement (opt-in gated) — _type defined; campaigns not built_
- [x] User notification preferences endpoint

### Campaigns (`/api/v1/campaigns`)
- [ ] Stub/reserve route for Phase 2 (no functional build in MVP) (§52)

### Analytics (`/api/v1/analytics`)
- [x] Business analytics: total/active customers, stamps per day/week/month, rewards unlocked/redeemed, redemption rate, participation
- [x] Platform analytics: business/customer/device counts, activity summaries
- [~] Query aggregation pipelines optimized against indexes (avoid full historical loads) (§43) — _active-customer count now aggregates in the database on a `businessId + createdAt` index; pre-aggregated counters are Phase 4_

### Admin (`/api/v1/admin`)
- [x] Business management (list, verify, suspend/restore)
- [x] Customer management (view, suspend)
- [~] Device management (view, revoke) — _business-side revoke/replace exist; no admin list/revoke endpoint_
- [x] Audit log viewer endpoint
- [x] Platform-wide analytics endpoint
- [~] Support operations utilities (e.g. remote device disable) (§66) — _suspending a business disables its devices; no per-device remote disable_

---

## 6. NFC & QR Architecture (§9–11)

- [x] Define NFC tag payload format (identifier/deep-link only, no loyalty state) (§10.2)
- [x] Backend endpoint(s) to resolve device identifier → business/branch context
- [~] QR code generation per device (`https://taployalty.pk/s/<code>`) (§11) — _resolve endpoint exists; no QR image/printable URL generation_
- [ ] Universal/deep link handling (app installed vs not installed → web onboarding) — _`discover/stampers/:id` API exists; no link config or web landing page_
- [~] Shared validation & fraud pipeline for both NFC and QR stamping (must not diverge) — _QR resolve is read-only; no QR stamp path yet_
- [~] Confirm no sensitive credentials are ever embedded in NFC tag or QR code — _identifier only by design; not formally verified_

---

## 7. Fraud Prevention & Security Controls (§14, §30, §31)

- [x] Authenticated-only stamp requests
- [x] Device registration/activation/revocation enforced at validation time
- [~] Rate limiting per customer/device/business — _per-IP limits (global, auth, stamps, taps), shared across instances via Redis; per-card cooldown; per-stamper tap counter_
- [x] Minimum time-between-stamps rule (configurable)
- [x] Duplicate/replay request detection
- [x] Idempotency keys on stamp + redemption endpoints
- [x] Server-side timestamps only (never trust client time)
- [~] Suspicious activity logging/alerting — _audit action exists; nothing writes it_
- [~] Confirm copied/public NFC identifier alone cannot yield unlimited stamps — _replayed URLs rejected (tested); a hand-edited NTAG 215 counter can still forge a tap until NTAG 424 DNA_
- [~] HTTPS enforced everywhere — _helmet + `trust proxy` only; HSTS/redirect depend on deploy_
- [x] Input validation on all endpoints
- [x] Refresh-token theft/reuse protection
- [~] No sensitive data in logs or error responses — _informally reviewed, not verified_

---

## 8. Audit Logging (§37)

- [x] Audit log service/utility usable across modules
- [x] Log: business created
- [x] Log: program created/edited
- [x] Log: NFC device activated
- [x] Log: NFC device revoked
- [x] Log: staff invited
- [x] Log: staff role changed
- [x] Log: reward created
- [x] Log: reward redeemed
- [x] Log: admin account action
- [x] Log: business suspended
- [~] Log: customer support action — _no support actions exist yet_
- [x] Ensure entries capture actor, action, resource, timestamp, metadata

---

## 9. Business Suspension & Account Deletion (§59–60)

- [~] Business suspension workflow (admin-triggered)
  - [ ] Restrict dashboard access — _`requireBusinessRole` does not check business status_
  - [x] Invalidate business's NFC devices — _ACTIVE devices become SUSPENDED, restored on reactivation_
  - [x] Reject new stamps for suspended business
  - [ ] Apply defined reward/redemption suspension policy
  - [x] Preserve data visibility for platform admins
  - [x] Audit log entry
- [ ] Customer account deletion workflow
  - [ ] Anonymize/remove PII
  - [ ] Retain non-identifying transactional records per retention policy
  - [ ] Preserve audit integrity
  - [ ] Define exact retention periods (legal review before production)

---

## 10. Customer Mobile App (React Native + Expo + TS) (§18)

### Setup
- [x] Bootstrap Expo + TypeScript app
- [x] Secure token storage integration
- [x] Native NFC integration (library TBD — open decision §67)
- [ ] Push notification setup (FCM)
- [x] API client with auth/refresh handling

### Authentication screens
- [x] Welcome
- [x] Login
- [x] Sign up
- [ ] OTP/email verification (per chosen method)
- [ ] Forgot/reset password

### Customer screens
- [~] Home (active cards, near-completion rewards, available rewards, recent activity, discoverable businesses) (§18.3) — _cards tab only; no near-completion / activity / discover sections_
- [x] Loyalty cards (list)
- [x] Loyalty card detail
- [x] NFC scanning flow
- [ ] QR scanning flow
- [x] Rewards (list)
- [ ] Reward detail
- [x] Redemption screen (present code/confirmation)
- [ ] Activity/history
- [x] Business discovery (search + category filter)
- [x] Business detail (+ join program)
- [x] Profile
- [ ] Notification settings

### NFC/QR flow implementation
- [x] Read NFC tag → extract device identifier/token
- [x] Send authenticated stamp request to backend
- [x] Handle response: success/failure states with clear messaging (§62)
- [ ] QR scan → resolve to stamping flow via same backend validation

### Edge case handling — NFC (§32)
- [x] NFC disabled on device
- [x] NFC unavailable/unsupported device
- [x] Tag not detected
- [x] Wrong/unknown tag
- [x] Deactivated tag
- [~] Network unavailable — _generic error messages only_
- [x] User not authenticated
- [x] Customer not enrolled in program
- [x] Program inactive
- [x] Stamp already submitted (duplicate)
- [x] Rate limit exceeded
- [x] Device revoked
- [x] Repeated rapid taps
- [x] App backgrounded/interrupted mid-scan

### Edge case handling — QR (§33)
- [ ] Invalid QR
- [ ] Expired QR
- [ ] Deactivated device
- [ ] Unknown business
- [ ] App not installed → web onboarding fallback
- [ ] No network
- [ ] Customer not authenticated
- [ ] Customer not enrolled
- [ ] Duplicate stamp request

### Offline behavior (§34)
- [ ] Show "could not be verified" messaging when offline
- [ ] Never locally award a permanent stamp
- [~] Allow retry when connectivity returns — _fresh idempotency key per scan; no stored retry_

### Mobile security (§31)
- [x] Treat backend responses as source of truth (never trust local stamp counts)
- [x] Validate NFC payload format client-side before sending
- [x] Handle duplicate NFC reads safely (debounce/lock)
- [~] Graceful network failure handling — _generic error messages only_
- [x] No backend secrets bundled in app

---

## 11. Business Web Dashboard (Next.js + TS + Tailwind + shadcn/ui) (§19)

### Setup
- [x] Bootstrap Next.js + TypeScript project
- [~] Tailwind CSS + shadcn/ui integration — _Tailwind with hand-rolled components; shadcn/ui not used_
- [x] Auth flow (login, session handling, protected routes)

### Overview
- [x] Active customers widget
- [x] Stamps issued widget
- [x] Rewards earned widget
- [x] Rewards redeemed widget
- [~] Recent activity feed — _separate `/activity` page, not on overview_

### Loyalty Programs
- [x] List programs
- [x] Create program form
- [~] Edit program form — _API `PATCH` exists; no UI_
- [~] Activate/deactivate toggle — _API supports `status`; no UI toggle_
- [x] Configure stamps requirement
- [~] Configure rewards association — _reward form picks a program; cannot edit later_

### Customers
- [ ] Customer list (paginated)
- [ ] Customer detail view
- [ ] Loyalty status per customer
- [ ] Stamp history per customer
- [ ] Reward history per customer

### NFC Devices
- [x] Device list
- [x] Device status indicators
- [x] Device activation flow (enter activation code)
- [~] Device assignment to branch — _chosen during activation only_
- [x] Device revocation action
- [ ] Device metadata view

### Rewards
- [x] Create reward form
- [~] Edit reward form — _API `PATCH` exists; no UI_
- [x] Rewards list view
- [x] Redemption activity view

### Staff
- [x] Invite staff (email invite flow)
- [~] Assign roles UI — _role chosen at invite only_
- [~] Disable staff action — _API supports `status: DISABLED`; no UI_
- [ ] Manage permissions UI

### Branches
- [x] Create branch form
- [~] Edit branch form — _API `PATCH` exists; no UI_
- [~] Activate/deactivate branch — _API only; no UI_
- [~] Assign devices to branch — _branch is set at admin assign / owner activation; no re-assign endpoint_
- [~] Assign staff to branch — _`branchIds` stored on member; never enforced on stamp/redeem_

### Analytics
- [~] Total/active customers charts — _stat tiles only_
- [~] Stamps per day/week/month chart — _14-day bar chart only_
- [~] Rewards earned/redeemed metrics — _stat tiles on overview_
- [~] Redemption rate — _stat tile on overview_
- [~] Loyalty participation metric — _avg stamps per customer only_
- [~] Pagination/virtualization for large datasets (§43) — _API paginated; web list pages are not_

### Settings
- [ ] Business profile editor
- [ ] Branding (logo, colors) editor
- [ ] Loyalty settings
- [ ] Notification settings
- [ ] Account settings
- [ ] Subscription/billing placeholder (§40)

---

## 12. Platform Admin Dashboard (§20)

- [~] Admin authentication (separate from business auth or role-gated) — _API role-gated via `requirePlatformRole`; no admin UI_
- [~] Business management (list, view, verify status, suspend/restore) — _API only_
- [~] Customer management (list, view, suspend) — _API only_
- [~] Device management (list, revoke, reassign) — _API mint/assign only_
- [~] Business verification/status workflow — _PENDING→ACTIVE via admin API_
- [ ] Account suspension UI
- [ ] Support operations tools
- [ ] Platform activity feed
- [~] Audit log viewer — _API only_
- [~] Basic platform analytics dashboard — _`/admin/overview` API only_
- [x] Ensure all admin actions affecting customer/business data are audit-logged

---

## 13. Business Discovery (§21)

- [x] Business search (mobile)
- [x] Category filter (Café, Restaurant, Bakery, Salon, Barber, Gym, Retail, Other)
- [x] Business profile view
- [x] View available loyalty program from profile
- [x] Join loyalty program action
- [ ] (Defer) Location-based discovery until core loop is stable

---

## 14. Loyalty Transaction Integrity (§28)

- [x] Design atomic transaction boundary: validate → create stamp → increment progress → check threshold → create/unlock reward
- [x] Prevent: stamp recorded without progress update
- [x] Prevent: progress updated without stamp record
- [x] Prevent: reward generated twice
- [x] Prevent: redemption occurring twice
- [x] Prevent: retried request creating duplicate stamp (idempotency)
- [ ] Load-test the transaction path under concurrent requests

---

## 15. Multi-Branch Support (§35)

- [x] Devices scoped to branch
- [~] Staff can be branch-scoped — _field exists; not enforced_
- [x] Stamps record branch ID
- [~] Branch-specific analytics — _API accepts `branchId`; no UI_
- [x] Programs configurable for all branches or selected branches

---

## 16. Notifications Infrastructure (§22)

- [~] Channel abstraction layer (push implemented; email/SMS/WhatsApp pluggable later) — _`queueNotification` is the single entry point; no sender implemented_
- [ ] Push notification provider setup (FCM)
- [x] Notification preference storage per user
- [~] Delivery status tracking — _status field exists; no sender updates it_

---

## 17. Observability (§45)

- [x] Error tracking integration (Sentry or equivalent) — API — _enabled by `SENTRY_DSN`_
- [x] Error tracking integration — Web dashboard — _enabled by `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`_
- [ ] Error tracking integration — Mobile app
- [x] Structured backend logging
- [ ] API request metrics
- [ ] Authentication failure monitoring
- [ ] NFC/stamp failure monitoring
- [ ] Database performance monitoring
- [ ] Basic uptime monitoring
- [ ] Dashboards/alerts for key business events

---

## 18. Deployment & Infrastructure (§46)

- [ ] Web dashboard hosting (Vercel or equivalent)
- [ ] API hosting (Railway/Render/AWS or equivalent)
- [ ] MongoDB Atlas provisioning per environment
- [ ] Mobile builds via Expo EAS
- [ ] DNS/CDN setup (Cloudflare)
- [~] CI/CD pipelines (GitHub Actions) — lint/test/build/deploy per app — _CI (lint, format, typecheck, build, tests, audit, secrets, CodeQL) written; no deploy step; first run pending a push_
- [ ] Domain setup (`domain.com`, `api.domain`)
- [ ] SSL/HTTPS everywhere

---

## 19. Testing (§48)

### Unit tests
- [ ] Loyalty calculation logic
- [ ] Stamp eligibility logic
- [ ] Reward eligibility logic
- [ ] Redemption rules
- [ ] Permission/authorization checks
- [ ] Device validation logic
- [ ] Fraud/rate-limit logic

### Integration tests
- [~] Authentication flows — _only register hash check and unauthenticated reject are covered_
- [x] Stamp creation end-to-end (API level)
- [x] Reward generation
- [x] Redemption flow
- [x] Business authorization/tenant isolation
- [ ] Device activation
- [~] Multi-branch behavior — _no multi-branch integration test_

### End-to-end tests
- [ ] Customer journey: sign up → join program → NFC stamp → progress update → reward unlock → redemption
- [ ] Business journey: signup → create branch → create program → register device → view activity → redeem reward

---

## 20. Security Review (§30–31)

- [x] Password hashing algorithm confirmed (bcrypt/argon2) and tested
- [ ] JWT signing/verification reviewed
- [ ] Refresh token rotation/invalidation tested
- [ ] Rate limiting verified under load
- [ ] CORS policy reviewed
- [x] Secure headers verified (CSP, HSTS, etc.)
- [x] Dependency vulnerability scan — _`npm audit` in CI (fails on high/critical) and Dependabot; currently no high or critical_
- [ ] Manual pentest-style review of tenant isolation
- [ ] Manual review of NFC/QR spoofing resistance

---

## 21. Data Ownership, Privacy & Legal (§58)

- [ ] Draft privacy policy
- [ ] Draft terms of service
- [ ] Define data retention rules
- [ ] Implement account deletion workflow (see §9 above)
- [ ] Confirm businesses only access customer data necessary for loyalty ops
- [ ] Legal review before production launch

---

## 22. Pakistan Market & Internationalization (§41–42)

- [ ] PKR currency formatting throughout
- [ ] Pakistan phone number format validation
- [ ] Local business address fields
- [ ] Pakistan timezone handling
- [ ] Android-first testing priority while maintaining iOS support
- [ ] Design for intermittent connectivity (retry-friendly UX)
- [ ] Avoid hard-coded Pakistan-only assumptions in core data models (currency, phone format, timezone abstracted for future countries)

---

## 23. Physical NFC Stamper & Hardware Lifecycle (§38–39, §61)

- [x] Select NFC chip/tag model — _NTAG 215 (see §26)_ (open decision — test against representative Android/iOS devices)
- [x] Define NDEF payload format
- [ ] Design QR + "Tap phone to collect your loyalty stamp" signage layout
- [x] Implement device state machine: `UNASSIGNED → ASSIGNED → ACTIVE → SUSPENDED/REVOKED → REPLACED`
- [ ] Device replacement runbook (revoke old → assign new → activate → verify history intact)
- [x] Confirm replaced/revoked devices cannot issue valid stamps

---

## 24. Analytics & Success Metrics (§36, §64)

- [ ] Instrument customer metrics: signup conversion, program join rate, first-stamp conversion, repeat stamping frequency, reward completion rate, redemption rate, MAU
- [ ] Instrument business metrics: activation rate, active businesses/branches/devices, stamps per business, participation, redemption volume, retention
- [ ] Instrument product/technical metrics: NFC success rate, QR fallback usage, stamp API error rate, duplicate request rate, average stamp response time, app crash rate
- [ ] Ensure all analytics derive from actual recorded transactions (no inferred/unsupported stats)

---

## 25. Performance & Scalability (§43–44)

- [ ] Loyalty card load target: <2s under normal network
- [ ] Stamp request target: <2s backend response under normal conditions
- [~] Pagination on all dashboard list views — _API paginated; web UI is not_
- [ ] Analytics queries avoid loading full historical datasets client-side
- [ ] Load test for growth path: 10 → 100 → 1,000 → 10,000+ businesses
- [ ] Confirm modular monolith structure avoids premature microservice split

---

## 26. Open Technical Decisions to Resolve (§67)

- [x] Exact NFC chip/tag model — _NTAG 215 with UID + counter mirror now; NTAG 424 DNA before public launch_
- [x] NDEF payload format — _`https://<portal>/t/<id>?m=<UID>x<counter>`_
- [ ] NFC library for React Native
- [ ] Whether NFC read requires an active app screen (per platform)
- [ ] Exact QR stamping UX
- [ ] Authentication method: phone OTP vs email/password
- [ ] Push notification provider configuration details
- [ ] Subscription/billing provider
- [ ] Exact hosting provider selection
- [ ] Business pricing model
- [~] Reward model flexibility (beyond fixed stamp thresholds) — _multiple reward tiers per program are supported_
- [ ] Advanced anti-fraud strategy (beyond MVP baseline)
- [ ] Whether location-based discovery ships in MVP
- [ ] Final visual identity / design system

---

## 27. Risk Mitigations to Validate (§68)

- [ ] NFC compatibility tested across representative Android + iOS devices
- [ ] NFC cloning/replay mitigations verified (server validation, rate limits, lifecycle mgmt, idempotency)
- [ ] Customer adoption: QR onboarding path is frictionless and value-prop-first (§8)
- [ ] Business adoption: setup requires no tablet/POS/screen
- [ ] Fraud: server-authoritative checks verified under adversarial testing
- [ ] Poor connectivity: retry UX and QR fallback confirmed reliable

---

## 28. MVP Launch Readiness (§65–66, §69)

- [ ] Select initial pilot business category (recommend cafés first)
- [ ] Onboard limited pilot group of real businesses
- [ ] Pre-onboarding checklist per business: account exists, active program, device registered & assigned to branch, QR generated, staff trained on redemption
- [ ] Support process for remotely disabling a device
- [ ] At least one physical NFC stamper tested with representative customer devices
- [ ] Full business → customer → NFC → stamp → reward → redemption flow tested end-to-end in production-like environment
- [ ] Backups/recovery procedures documented and tested
- [ ] Privacy policy & terms published
- [ ] Error monitoring live in production

---

## 29. Definition of Done — MVP (§69, consolidated)

- [ ] Customer app builds on supported Android/iOS devices
- [ ] Business dashboard deployed
- [ ] Backend API deployed
- [ ] Production database configured
- [ ] Authentication secure and working
- [ ] Business/customer roles enforced correctly
- [ ] NFC devices can be registered and revoked
- [ ] QR fallback fully functional
- [ ] Customer can join a program
- [ ] Customer can receive a valid stamp
- [ ] Duplicate stamps prevented per configured rules
- [ ] Rewards unlock correctly
- [ ] Rewards redeemable exactly once (unless configured otherwise)
- [ ] Multi-business customer accounts verified working
- [ ] Multi-branch businesses verified working
- [ ] Business data fully tenant-isolated
- [ ] Audit logs capture all critical operations
- [ ] Error monitoring enabled across all apps
- [ ] Backups/recovery procedures defined
- [ ] Privacy policy and terms prepared
- [ ] Real physical NFC stamper tested with representative devices
- [ ] Full end-to-end business→customer→NFC→stamp→reward→redemption flow validated

---

## Explicitly Out of Scope for MVP (§3 — do not build)

POS integrations · payment processing · online ordering · food delivery · table ordering · inventory management · accounting · full CRM automation · WhatsApp automation · SMS marketing · AI recommendations/segmentation · advanced BI · complex campaign automation · franchise management · marketplace monetization · custom enterprise permissions UI · battery/powered hardware · dedicated business mobile app · crypto/blockchain loyalty · inter-business points transfer · cash wallet · customer-to-customer transfers · complex subscription billing · advanced referral systems
