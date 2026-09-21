# TapTapSell Loyalty — MVP TODO

Derived from `PRD.md`. Scope is bounded by §3 (Non-Goals) and §70 (Final MVP Boundary):
> Can a real Pakistani business set up a loyalty program and can a real customer repeatedly earn and redeem loyalty rewards using a simple NFC tap, without the business needing dedicated electronic hardware?

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## Implementation status

| Area | State |
|---|---|
| Monorepo scaffold, shared packages, tooling | Built |
| Backend foundation (config, middleware, errors, rate limiting, idempotency) | Built |
| Mongoose models + indexes (all 13 collections) | Built |
| Auth (register/login/refresh/logout, hashed passwords, rotating refresh tokens) | Built |
| RBAC (per-business membership, role hierarchy, permission matrix) | Built |
| Businesses, branches, members, programs, cards, devices, rewards, redemptions | Built |
| Stamp flow (atomic transaction, cooldown, idempotency, reward unlock) | Built |
| Analytics, platform admin, notifications, public discovery + QR resolve | Built |
| Business web dashboard (Next.js) — auth, overview, programs, rewards, devices, branches, staff, activity, redeem | Built, `next build` passes |
| Customer mobile app (Expo) — auth, cards, card detail, NFC scan, rewards, discover, join, profile | Written, **not yet installed or run** |
| Integration test suite (core loop, idempotency, tenant isolation) | Written, **not yet executed** — needs a MongoDB replica set |
| Push notifications, QR scan screen, campaigns, subscriptions | Not started |

**Verified so far:** `api` and `web` both typecheck clean; `web` produces a
successful production build. Nothing has been run against a live database, and
no NFC hardware has been tested.

---

## 0. Project Setup & Repository

- [ ] Initialize git repository
- [ ] Create monorepo structure (§56)
  - [ ] `web/` — Next.js business/admin dashboard
  - [ ] `mobile/` — React Native customer app
  - [ ] `api/` — Node.js REST API
  - [ ] `packages/types/` — shared TypeScript types
  - [ ] `packages/validation/` — shared validation schemas
  - [ ] `packages/constants/` — shared constants (roles, statuses, enums)
  - [ ] `docs/architecture/`
- [ ] Root-level tooling: ESLint, Prettier, EditorConfig, commit hooks
- [ ] Decide package manager / workspace tool (npm/pnpm/yarn workspaces or Turborepo)
- [ ] `.gitignore` (env files, build artifacts, secrets)
- [ ] `.env.example` per app (never commit real secrets — §30, §47)
- [ ] README per app with local setup instructions
- [ ] Set up GitHub repo + branch protection (if using GitHub Actions per §46)

---

## 1. Environment Separation (§47)

- [ ] Define `development`, `staging`, `production` environments
- [ ] Separate MongoDB database per environment
- [ ] Separate API credentials/secrets per environment
- [ ] Separate auth (JWT) secrets per environment
- [ ] Separate push notification credentials per environment
- [ ] Separate NFC/device config where needed
- [ ] Secret management strategy (env vars / vault) — confirm nothing committed to Git

---

## 2. Database Design (MongoDB Atlas + Mongoose) (§26–27)

- [ ] Provision MongoDB Atlas cluster(s) per environment
- [ ] Define Mongoose schemas:
  - [ ] `users`
  - [ ] `businesses`
  - [ ] `business_members` (role-scoped, NOT a global `user.role`)
  - [ ] `branches`
  - [ ] `loyalty_programs`
  - [ ] `loyalty_cards`
  - [ ] `nfc_devices`
  - [ ] `stamps`
  - [ ] `rewards`
  - [ ] `redemptions`
  - [ ] `notifications`
  - [ ] `audit_logs`
- [ ] Define indexes (§27):
  - [ ] `users.email` (unique)
  - [ ] `users.phone` (unique)
  - [ ] `businesses.slug` (unique)
  - [ ] `business_members` compound index on `userId + businessId` (unique)
  - [ ] `loyalty_cards` compound index on `customerId + programId` (unique)
  - [ ] `nfc_devices.deviceIdentifier` (unique)
  - [ ] `stamps` compound index on `customerId + programId + createdAt`
  - [ ] `stamps.idempotencyKey` (unique, scoped appropriately)
  - [ ] `redemptions.redemptionCode` (unique)
  - [ ] `audit_logs` compound index on `businessId + createdAt`
  - [ ] `notifications` compound index on `userId + status`
- [ ] Decide on MongoDB transactions usage for stamp/reward atomic flow (§28)
- [ ] Seed/fixture scripts for local development
- [ ] Backup & recovery procedure defined (§69)

---

## 3. Backend API — Foundation (§24–25)

- [ ] Bootstrap Node.js + TypeScript project
- [ ] Choose framework: Express or Fastify
- [ ] Set up modular monolith folder structure:
  - [ ] `config/`, `middleware/`, `modules/*`, `models/`, `services/`, `repositories/`, `utils/`, `routes/`, `jobs/`, `app.ts`
- [ ] Establish request flow convention: Route → Middleware → Controller → Service → Repository/Model → MongoDB
- [ ] Global error handling middleware (no stack traces/DB errors leaked — §30, §62)
- [ ] Request validation layer (e.g. zod/joi) shared via `packages/validation`
- [ ] API response envelope standard (consistent success/error shape)
- [ ] API versioning (`/api/v1/...`)
- [ ] Pagination utility for list endpoints
- [ ] Request correlation ID middleware
- [ ] Rate limiting middleware (global + per-route overrides)
- [ ] CORS configuration
- [ ] Secure headers (helmet or equivalent)
- [ ] Request size limits
- [ ] Idempotency-Key middleware/utility for sensitive writes (stamps, redemptions)
- [ ] Structured logging (no sensitive info in logs — §30, §45)

---

## 4. Authentication & Authorization

### Authentication (§23)
- [ ] Decide MVP auth method: email/password vs phone/OTP (Pakistan-market friction) — **open decision, §67**
- [ ] `POST /api/v1/auth/register`
- [ ] `POST /api/v1/auth/login`
- [ ] OTP/email verification flow (if selected)
- [ ] `POST /api/v1/auth/forgot-password` / reset flow
- [ ] Password hashing with an established algorithm (bcrypt/argon2)
- [ ] Short-lived access tokens (JWT)
- [ ] Refresh tokens + rotation
- [ ] Token revocation / session management
- [ ] `POST /api/v1/auth/refresh`
- [ ] `POST /api/v1/auth/logout`
- [ ] Secure mobile token storage (SecureStore) — never plain local storage

### Authorization / RBAC (§5, §6, §29)
- [ ] Implement platform roles: `SUPER_ADMIN`, `ADMIN`
- [ ] Implement business roles: `OWNER`, `MANAGER`, `STAFF`
- [ ] Implement `CUSTOMER` role
- [ ] `business_members` collection drives per-business role resolution (not global `user.role`)
- [ ] Authorization middleware chain: authenticated user → business membership → role → permission → resource scope
- [ ] Permission matrix/config per role (documented and enforced centrally, not ad hoc per controller)
- [ ] Guard: business A cannot access business B's data (tenant isolation)
- [ ] Guard: customers cannot access business dashboard endpoints
- [ ] Guard: staff cannot modify platform/business-critical settings
- [ ] Guard: revoked/expired sessions cannot make privileged requests
- [ ] Support one user having multiple roles across businesses + a customer identity simultaneously

---

## 5. Backend Modules — Core Domain

### Users (`/api/v1/users`)
- [ ] Get current user profile
- [ ] Update profile
- [ ] Manage notification preferences
- [ ] Account deletion request endpoint (§59)

### Businesses (`/api/v1/businesses`)
- [ ] Create business
- [ ] Get/update business profile
- [ ] Business status (active/suspended)
- [ ] Business branding fields (logo, category, contact)
- [ ] Slug generation/uniqueness

### Business Members (`/api/v1/business-members`)
- [ ] Invite staff/manager
- [ ] Assign/change role
- [ ] Disable/remove member
- [ ] List members by business
- [ ] Permission overrides where applicable

### Branches (`/api/v1/branches`)
- [ ] Create branch
- [ ] Edit branch
- [ ] Activate/deactivate branch
- [ ] Assign devices to branch
- [ ] Assign staff to branch
- [ ] List branches by business

### Loyalty Programs (`/api/v1/loyalty-programs`)
- [ ] Create program (name, description, required stamps, branch scope, dates, branding, terms, eligibility)
- [ ] Edit program
- [ ] Activate/deactivate program
- [ ] List programs by business
- [ ] Branch-scoping logic (all vs selected branches) (§35)
- [ ] Program start/end date enforcement

### Loyalty Cards (`/api/v1/loyalty-cards`)
- [ ] Create/join loyalty card for customer + program
- [ ] Get card detail (stamp count, progress, rewards, recent activity)
- [ ] List customer's cards across businesses
- [ ] Expiration handling where applicable

### NFC Devices (`/api/v1/nfc-devices`)
- [ ] Device registration (platform admin / business owner flow)
- [ ] Device activation via activation code
- [ ] Device status lifecycle: `UNASSIGNED → ASSIGNED → ACTIVE → SUSPENDED/REVOKED → REPLACED` (§39)
- [ ] Assign device to business/branch
- [ ] Revoke device
- [ ] Device replacement flow (old revoked, new assigned/activated, history preserved) (§61)
- [ ] Device metadata storage
- [ ] Ensure a device belongs to only one business/branch at a time

### Stamps (`/api/v1/stamps`)
- [ ] `POST /stamps` — create stamp (NFC/QR/ADMIN source)
- [ ] Full validation pipeline (§13.1):
  - [ ] Customer authentication
  - [ ] Customer loyalty-card membership
  - [ ] Business/device relationship
  - [ ] Active loyalty program check
  - [ ] Program eligibility check
  - [ ] Device status check (active, not revoked/suspended)
  - [ ] Duplicate/replay detection
  - [ ] Rate limit enforcement
  - [ ] Idempotency key handling
- [ ] Atomic stamp creation + loyalty progress increment (Mongo transaction) (§28)
- [ ] Reward threshold check → auto create/unlock reward atomically
- [ ] Stamp history endpoint (by customer, by business, by branch)
- [ ] Manual/admin stamp issuance path (`source=ADMIN`) with audit trail

### Rewards (`/api/v1/rewards`)
- [ ] Create reward (linked to program)
- [ ] Edit reward
- [ ] Activate/deactivate reward
- [ ] List rewards by program/business
- [ ] Reward types (free item, % off, fixed discount, etc.)
- [ ] Expiration handling
- [ ] Redemption limit/rules configuration

### Redemptions (`/api/v1/redemptions`)
- [ ] Request redemption (customer)
- [ ] Server-side eligibility verification
- [ ] Generate unique redemption code/ID
- [ ] Staff verification endpoint (mark as redeemed)
- [ ] Atomic status transition (prevent double redemption) (§17.2, §28)
- [ ] Redemption history (business + customer views)
- [ ] Audit log entry per redemption

### Notifications (`/api/v1/notifications`)
- [ ] Notification data model + abstraction layer (channel-agnostic: push now, email/SMS/WhatsApp later) (§22)
- [ ] Push notification integration (Firebase Cloud Messaging)
- [ ] Trigger: stamp added
- [ ] Trigger: reward unlocked
- [ ] Trigger: reward expiring
- [ ] Trigger: reward redeemed
- [ ] Trigger: loyalty milestone
- [ ] Trigger: business announcement (opt-in gated)
- [ ] User notification preferences endpoint

### Campaigns (`/api/v1/campaigns`)
- [ ] Stub/reserve route for Phase 2 (no functional build in MVP) (§52)

### Analytics (`/api/v1/analytics`)
- [ ] Business analytics: total/active customers, stamps per day/week/month, rewards unlocked/redeemed, redemption rate, participation
- [ ] Platform analytics: business/customer/device counts, activity summaries
- [ ] Query aggregation pipelines optimized against indexes (avoid full historical loads) (§43)

### Admin (`/api/v1/admin`)
- [ ] Business management (list, verify, suspend/restore)
- [ ] Customer management (view, suspend)
- [ ] Device management (view, revoke)
- [ ] Audit log viewer endpoint
- [ ] Platform-wide analytics endpoint
- [ ] Support operations utilities (e.g. remote device disable) (§66)

---

## 6. NFC & QR Architecture (§9–11)

- [ ] Define NFC tag payload format (identifier/deep-link only, no loyalty state) (§10.2)
- [ ] Backend endpoint(s) to resolve device identifier → business/branch context
- [ ] QR code generation per device (`https://taployalty.pk/s/<code>`) (§11)
- [ ] Universal/deep link handling (app installed vs not installed → web onboarding)
- [ ] Shared validation & fraud pipeline for both NFC and QR stamping (must not diverge)
- [ ] Confirm no sensitive credentials are ever embedded in NFC tag or QR code

---

## 7. Fraud Prevention & Security Controls (§14, §30, §31)

- [ ] Authenticated-only stamp requests
- [ ] Device registration/activation/revocation enforced at validation time
- [ ] Rate limiting per customer/device/business
- [ ] Minimum time-between-stamps rule (configurable)
- [ ] Duplicate/replay request detection
- [ ] Idempotency keys on stamp + redemption endpoints
- [ ] Server-side timestamps only (never trust client time)
- [ ] Suspicious activity logging/alerting
- [ ] Confirm copied/public NFC identifier alone cannot yield unlimited stamps
- [ ] HTTPS enforced everywhere
- [ ] Input validation on all endpoints
- [ ] Refresh-token theft/reuse protection
- [ ] No sensitive data in logs or error responses

---

## 8. Audit Logging (§37)

- [ ] Audit log service/utility usable across modules
- [ ] Log: business created
- [ ] Log: program created/edited
- [ ] Log: NFC device activated
- [ ] Log: NFC device revoked
- [ ] Log: staff invited
- [ ] Log: staff role changed
- [ ] Log: reward created
- [ ] Log: reward redeemed
- [ ] Log: admin account action
- [ ] Log: business suspended
- [ ] Log: customer support action
- [ ] Ensure entries capture actor, action, resource, timestamp, metadata

---

## 9. Business Suspension & Account Deletion (§59–60)

- [ ] Business suspension workflow (admin-triggered)
  - [ ] Restrict dashboard access
  - [ ] Invalidate business's NFC devices
  - [ ] Reject new stamps for suspended business
  - [ ] Apply defined reward/redemption suspension policy
  - [ ] Preserve data visibility for platform admins
  - [ ] Audit log entry
- [ ] Customer account deletion workflow
  - [ ] Anonymize/remove PII
  - [ ] Retain non-identifying transactional records per retention policy
  - [ ] Preserve audit integrity
  - [ ] Define exact retention periods (legal review before production)

---

## 10. Customer Mobile App (React Native + Expo + TS) (§18)

### Setup
- [ ] Bootstrap Expo + TypeScript app
- [ ] Secure token storage integration
- [ ] Native NFC integration (library TBD — open decision §67)
- [ ] Push notification setup (FCM)
- [ ] API client with auth/refresh handling

### Authentication screens
- [ ] Welcome
- [ ] Login
- [ ] Sign up
- [ ] OTP/email verification (per chosen method)
- [ ] Forgot/reset password

### Customer screens
- [ ] Home (active cards, near-completion rewards, available rewards, recent activity, discoverable businesses) (§18.3)
- [ ] Loyalty cards (list)
- [ ] Loyalty card detail
- [ ] NFC scanning flow
- [ ] QR scanning flow
- [ ] Rewards (list)
- [ ] Reward detail
- [ ] Redemption screen (present code/confirmation)
- [ ] Activity/history
- [ ] Business discovery (search + category filter)
- [ ] Business detail (+ join program)
- [ ] Profile
- [ ] Notification settings

### NFC/QR flow implementation
- [ ] Read NFC tag → extract device identifier/token
- [ ] Send authenticated stamp request to backend
- [ ] Handle response: success/failure states with clear messaging (§62)
- [ ] QR scan → resolve to stamping flow via same backend validation

### Edge case handling — NFC (§32)
- [ ] NFC disabled on device
- [ ] NFC unavailable/unsupported device
- [ ] Tag not detected
- [ ] Wrong/unknown tag
- [ ] Deactivated tag
- [ ] Network unavailable
- [ ] User not authenticated
- [ ] Customer not enrolled in program
- [ ] Program inactive
- [ ] Stamp already submitted (duplicate)
- [ ] Rate limit exceeded
- [ ] Device revoked
- [ ] Repeated rapid taps
- [ ] App backgrounded/interrupted mid-scan

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
- [ ] Allow retry when connectivity returns

### Mobile security (§31)
- [ ] Treat backend responses as source of truth (never trust local stamp counts)
- [ ] Validate NFC payload format client-side before sending
- [ ] Handle duplicate NFC reads safely (debounce/lock)
- [ ] Graceful network failure handling
- [ ] No backend secrets bundled in app

---

## 11. Business Web Dashboard (Next.js + TS + Tailwind + shadcn/ui) (§19)

### Setup
- [ ] Bootstrap Next.js + TypeScript project
- [ ] Tailwind CSS + shadcn/ui integration
- [ ] Auth flow (login, session handling, protected routes)

### Overview
- [ ] Active customers widget
- [ ] Stamps issued widget
- [ ] Rewards earned widget
- [ ] Rewards redeemed widget
- [ ] Recent activity feed

### Loyalty Programs
- [ ] List programs
- [ ] Create program form
- [ ] Edit program form
- [ ] Activate/deactivate toggle
- [ ] Configure stamps requirement
- [ ] Configure rewards association

### Customers
- [ ] Customer list (paginated)
- [ ] Customer detail view
- [ ] Loyalty status per customer
- [ ] Stamp history per customer
- [ ] Reward history per customer

### NFC Devices
- [ ] Device list
- [ ] Device status indicators
- [ ] Device activation flow (enter activation code)
- [ ] Device assignment to branch
- [ ] Device revocation action
- [ ] Device metadata view

### Rewards
- [ ] Create reward form
- [ ] Edit reward form
- [ ] Rewards list view
- [ ] Redemption activity view

### Staff
- [ ] Invite staff (email invite flow)
- [ ] Assign roles UI
- [ ] Disable staff action
- [ ] Manage permissions UI

### Branches
- [ ] Create branch form
- [ ] Edit branch form
- [ ] Activate/deactivate branch
- [ ] Assign devices to branch
- [ ] Assign staff to branch

### Analytics
- [ ] Total/active customers charts
- [ ] Stamps per day/week/month chart
- [ ] Rewards earned/redeemed metrics
- [ ] Redemption rate
- [ ] Loyalty participation metric
- [ ] Pagination/virtualization for large datasets (§43)

### Settings
- [ ] Business profile editor
- [ ] Branding (logo, colors) editor
- [ ] Loyalty settings
- [ ] Notification settings
- [ ] Account settings
- [ ] Subscription/billing placeholder (§40)

---

## 12. Platform Admin Dashboard (§20)

- [ ] Admin authentication (separate from business auth or role-gated)
- [ ] Business management (list, view, verify status, suspend/restore)
- [ ] Customer management (list, view, suspend)
- [ ] Device management (list, revoke, reassign)
- [ ] Business verification/status workflow
- [ ] Account suspension UI
- [ ] Support operations tools
- [ ] Platform activity feed
- [ ] Audit log viewer
- [ ] Basic platform analytics dashboard
- [ ] Ensure all admin actions affecting customer/business data are audit-logged

---

## 13. Business Discovery (§21)

- [ ] Business search (mobile)
- [ ] Category filter (Café, Restaurant, Bakery, Salon, Barber, Gym, Retail, Other)
- [ ] Business profile view
- [ ] View available loyalty program from profile
- [ ] Join loyalty program action
- [ ] (Defer) Location-based discovery until core loop is stable

---

## 14. Loyalty Transaction Integrity (§28)

- [ ] Design atomic transaction boundary: validate → create stamp → increment progress → check threshold → create/unlock reward
- [ ] Prevent: stamp recorded without progress update
- [ ] Prevent: progress updated without stamp record
- [ ] Prevent: reward generated twice
- [ ] Prevent: redemption occurring twice
- [ ] Prevent: retried request creating duplicate stamp (idempotency)
- [ ] Load-test the transaction path under concurrent requests

---

## 15. Multi-Branch Support (§35)

- [ ] Devices scoped to branch
- [ ] Staff can be branch-scoped
- [ ] Stamps record branch ID
- [ ] Branch-specific analytics
- [ ] Programs configurable for all branches or selected branches

---

## 16. Notifications Infrastructure (§22)

- [ ] Channel abstraction layer (push implemented; email/SMS/WhatsApp pluggable later)
- [ ] Push notification provider setup (FCM)
- [ ] Notification preference storage per user
- [ ] Delivery status tracking

---

## 17. Observability (§45)

- [ ] Error tracking integration (Sentry or equivalent) — API
- [ ] Error tracking integration — Web dashboard
- [ ] Error tracking integration — Mobile app
- [ ] Structured backend logging
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
- [ ] CI/CD pipelines (GitHub Actions) — lint/test/build/deploy per app
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
- [ ] Authentication flows
- [ ] Stamp creation end-to-end (API level)
- [ ] Reward generation
- [ ] Redemption flow
- [ ] Business authorization/tenant isolation
- [ ] Device activation
- [ ] Multi-branch behavior

### End-to-end tests
- [ ] Customer journey: sign up → join program → NFC stamp → progress update → reward unlock → redemption
- [ ] Business journey: signup → create branch → create program → register device → view activity → redeem reward

---

## 20. Security Review (§30–31)

- [ ] Password hashing algorithm confirmed (bcrypt/argon2) and tested
- [ ] JWT signing/verification reviewed
- [ ] Refresh token rotation/invalidation tested
- [ ] Rate limiting verified under load
- [ ] CORS policy reviewed
- [ ] Secure headers verified (CSP, HSTS, etc.)
- [ ] Dependency vulnerability scan
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

- [ ] Select NFC chip/tag model (open decision — test against representative Android/iOS devices)
- [ ] Define NDEF payload format
- [ ] Design QR + "Tap phone to collect your loyalty stamp" signage layout
- [ ] Implement device state machine: `UNASSIGNED → ASSIGNED → ACTIVE → SUSPENDED/REVOKED → REPLACED`
- [ ] Device replacement runbook (revoke old → assign new → activate → verify history intact)
- [ ] Confirm replaced/revoked devices cannot issue valid stamps

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
- [ ] Pagination on all dashboard list views
- [ ] Analytics queries avoid loading full historical datasets client-side
- [ ] Load test for growth path: 10 → 100 → 1,000 → 10,000+ businesses
- [ ] Confirm modular monolith structure avoids premature microservice split

---

## 26. Open Technical Decisions to Resolve (§67)

- [ ] Exact NFC chip/tag model
- [ ] NDEF payload format
- [ ] NFC library for React Native
- [ ] Whether NFC read requires an active app screen (per platform)
- [ ] Exact QR stamping UX
- [ ] Authentication method: phone OTP vs email/password
- [ ] Push notification provider configuration details
- [ ] Subscription/billing provider
- [ ] Exact hosting provider selection
- [ ] Business pricing model
- [ ] Reward model flexibility (beyond fixed stamp thresholds)
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
