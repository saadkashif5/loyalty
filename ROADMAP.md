# TapTapSell Loyalty — Product & Engineering Roadmap

_Drafted 2026-10-30. Builds on [PRD.md](PRD.md) and the current state recorded in [TODO.md](TODO.md).
Where this document and the PRD disagree, this document reflects the newer product direction._

TapTapSell Loyalty is a multi-tenant SaaS platform for Pakistani businesses. Customers collect
digital stamps by tapping a passive NFC stamper with their phone. Businesses pay a monthly subscription.
The platform owner (Super Admin) controls who gets onboarded and whether they have paid.

---

## Where things stand (2026-11-06)

Development is paused while the platform is reviewed by hand. `[x]` means built, `[~]` means partly
built (the note says what is missing), `[ ]` means not started.

| Phase | Status | What is left |
|---|---|---|
| 0 Foundation | Mostly done | Decisions in §10: OTP providers, hosting; CI has not run on a push |
| 1 Console and onboarding | Mostly done | Logo upload, WhatsApp delivery of invitations, SUN keys for NTAG 424 DNA |
| 2 Customer portal | Core flow built | Phone sign-in, NTAG 424 DNA, Urdu, Web NFC, push. Never tested on a real stamper |
| 3 Billing | Built, except the card gateway | Gateway, coupons, credit notes and refunds, feature flags |
| 4 Scale and security | In progress | Threat model, OWASP checklist, staging load test, monitoring, backups, pentest |
| 5 Pilot and launch | Not started | Needs a hosting decision first |

Automated tests pass. In Chrome: plan switching, receipt upload and approval, password reset on
both apps, account deletion and data export, cursor paging, console filters, stamper tag reset,
support view, and stamper labels, shipping and QR activation. The rest of the UI has not been tested by hand. No staging environment
exists.

Where §1, §2 and §3 describe phone sign-in or NTAG 424 DNA, that is the eventual design. What is
built today is email codes and NTAG 215 (D1, D2).

---

## 1. What changes from today

| Topic | Built today / PRD assumption | New direction |
|---|---|---|
| Business onboarding | Anyone registers and creates a business (self-serve) | **Invite-only.** Super Admin invites a business owner; the owner gets their own dashboard |
| Customer surface | Native Expo app is primary | **Mobile web portal** opened by tapping the stamper. No install required. Native app deferred |
| Customer login | Email + password | **Phone number + one-time code** (WhatsApp first, SMS fallback) |
| Join flow | Customer finds business in app and taps "Join" | **First tap** on the stamper opens the portal → sign up → joined to that business's program |
| Stamp flow | App reads tag, posts the static device identifier | **Every tap produces a one-time cryptographic URL** (see §3, D1). Tapping again while the portal is open records a stamp |
| Tenancy | Per-business data, customer identity global | Same, made explicit: one customer account, a **separate card per business program**, a separate customer relationship per business |
| Monetisation | Not built | **Monthly subscription plans in PKR**, trials, invoices, local payment methods, dunning, auto-suspension, Super Admin finance console |
| Platform admin | API only, no UI, no way to create admins (seed script added) | Full admin console with MFA, on its own subdomain |
| Scale | Single API process, in-memory rate limits, unbounded queries | Horizontally scalable services, Redis, queues, pre-aggregated analytics, sharding-ready data model |

---

## 2. Target end-to-end flow

```
SUPER ADMIN                     BUSINESS OWNER                       CUSTOMER
───────────                     ──────────────                       ────────
1. Creates business record,
   picks plan + trial,
   invites owner (email/WhatsApp) ─► 2. Opens invite link, sets password,
                                      verifies phone, enrols MFA
                                   3. Onboarding wizard: profile, logo,
                                      branches, loyalty program, rewards,
                                      staff invites
4. Provisions stampers (writes keys
   to NTAG 424 DNA tags), assigns
   to branch, ships them ───────────► 5. Activates stamper at the branch
                                                                       6. Makes a purchase. Staff hold the
                                                                          stamper to the customer's phone
                                                                       7. Phone opens tap.taptapsell.pk/t?...
                                                                          (one-time URL from the tag)
                                                                       8. First time: enter phone → OTP →
                                                                          name → joined; card created for
                                                                          THIS business only
                                                                       9. Portal open → staff tap again →
                                                                          stamp recorded, card updates live
                                                                      10. Card full → reward unlocked,
                                                                          redemption code shown
                                   11. Staff validate the code at the
                                       counter (dashboard on their phone)
12. Monthly: invoice generated,
    owner pays (gateway / bank /
    Raast / manual). Unpaid → grace
    → stamping suspended → reactivated
    on payment
```

A customer who visits five businesses has **one account** and **five independent cards**. A business
only ever sees its own customers, its own cards and its own stamps.

---

## 3. Key design decisions

### D1. Secure taps

> **Decision (2026-10-31):** start on **NTAG 215 with the UID + tap-counter mirror**, and move to
> NTAG 424 DNA later. Built: `POST /taps` verifies the tap, enforces a strictly increasing counter
> per stamper, binds the chip UID, and issues a single-use tap token that `POST /stamps` consumes.
> Chip-specific checks live in `api/src/modules/taps/verifiers/`; switching chips means adding a
> verifier and changing the stamper's `tagType`. Provisioning steps:
> [docs/stamper-provisioning.md](docs/stamper-provisioning.md).
>
> What NTAG 215 does and does not protect against: a **saved or shared stamper URL cannot be
> reused**, but the counter is unsigned, so **someone who edits the number in the URL can still
> forge a tap**. Cooldowns, daily caps, staff-held stampers and anomaly flags carry that risk until
> the move to NTAG 424 DNA, which this section explains below.

**The problem.** A normal NFC tag (NTAG213/215, what the code assumes today) holds a fixed URL. Once a
customer taps it once, they can bookmark that URL and open it from home every day. Cooldowns and rate
limits only slow this down. QR codes printed on the stamper have the same flaw. For a product aimed at
the masses, this is the single biggest fraud risk.

**The fix.** NTAG 424 DNA is still a passive, battery-free tag, but it supports *Secure Unique NFC
(SUN)*: on **every tap** it writes a fresh URL containing an encrypted tap counter and a cryptographic
signature (AES-128 CMAC). The server:

1. Verifies the signature with that tag's key.
2. Checks the counter is higher than the last one seen (atomic conditional update).
3. Issues a short-lived, single-use **tap token** (≈2 minutes) bound to that device and counter.

A copied or bookmarked URL is already used and is rejected. Phones read it as an ordinary NDEF URL, so
iPhones (XS and later, in the background) and NFC Android phones open it without any app.

**Consequences**
- Tags cost more than NTAG213 (still low single-digit USD in volume; confirm with suppliers).
- The platform needs a **provisioning step**: an admin tool plus an NFC writer (USB reader or an
  Android phone) to write per-tag keys and the URL template before shipping.
- Per-tag keys are **derived from a master key held in a cloud KMS**, never stored in plaintext.
- The static QR code on the stamper is downgraded to **onboarding only** (open the business page and
  join). It never grants a stamp.

**Phones without NFC** (common on budget Android, and iPhone 7–X in a browser): staff use **counter
mode** in the dashboard. The customer shows a rotating signed QR from their portal card, or staff look
them up by phone number, and staff grant the stamp. These stamps are attributed to the staff member,
capped per day and audited.

### D2. Customer identity: email code now, phone + OTP later

> **Decision (2026-10-31):** for now customers sign up and sign in with a **6-digit code sent by
> email** (no password). Phone OTP over WhatsApp/SMS, described below, comes later; the email
> service and code flow are built so another channel can be added beside them.


- Pakistani customers expect phone-based sign-up. The phone number is normalised to E.164 (+92…).
- Codes are sent over **WhatsApp (authentication template) first, SMS fallback**. This is cheaper and has
  better delivery than SMS alone.
- Customers have **one global account**. Businesses see the **name and a masked phone number**
  (+92 3•• •••4567) by default. Marketing contact requires per-business opt-in consent.
- Business users (owners, managers, staff) and platform admins keep email + password, with **TOTP MFA
  mandatory** for Owners and all platform admins.

### D3. Customer surface: a mobile-web PWA portal

- Opens instantly from a tap; no app store step; works on Chrome Android and Safari iOS.
- Small JavaScript budget for low-end phones and expensive data.
- On Android Chrome, the portal can also listen for taps **inside the page** (Web NFC), so the second
  tap does not open a new tab.
- The existing Expo app is **frozen, not deleted**. It returns in Phase 6 if the data shows demand.

### D4. Separate front-end apps per audience

| Subdomain | App | Users | Notes |
|---|---|---|---|
| `tap.taptapsell.pk` (placeholder) | Customer portal (`portal/`) | Customers | Tiny bundle, cookie session, Urdu/English |
| `business.taptapsell.pk` | Business dashboard | Owners, managers, staff | Responsive: staff use it on phones at the counter |
| _To be decided_ | Platform console (`admin/`) | Super Admin, admins | MFA + Cloudflare Access/IP allowlist; isolated deploy |
| `api.taptapsell.pk` | REST API | All of the above | Stateless, horizontally scaled |
| `taptapsell.pk` | Marketing site | Public | Pricing, "request access" form |

Separate apps mean separate cookies, separate attack surface and a small customer bundle. Domain names
are placeholders; the admin console's domain is still to be decided (`admin.taptapsell.pk` is taken).

### D5. Multi-tenancy model

- **Shared database, tenant key on every tenant-owned document** (`businessId`). This is what exists
  today and scales well to tens of thousands of tenants.
- Isolation moves from "every handler remembers to filter" to **enforced at the data layer**: a
  Mongoose plugin/repository layer that refuses queries on tenant collections without a `businessId`,
  plus an automated cross-tenant test generated from the route table.
- New `business_customers` collection: one row per (business, customer) holding first-seen date,
  consent flags and branch of acquisition. It drives plan customer limits and future CRM features.
- Large chains can later be moved to a dedicated cluster without code changes (tenant routing hook).

### D6. Billing model for Pakistan

- Reliable recurring auto-debit is limited in Pakistan (wallet auto-debit is not broadly available to
  merchants; card tokenisation depends on the gateway). v1 is therefore **invoice-based monthly
  billing**: an invoice is issued, the owner pays through a hosted checkout (cards, JazzCash, Easypaisa
  via the chosen gateway), bank transfer/Raast with proof upload, or a manual entry by the Super Admin.
- A gateway-agnostic `PaymentProvider` interface, so Safepay / PayFast / JazzCash / Easypaisa can be
  added or swapped. Card auto-charge is added where the chosen gateway supports tokenised recurring
  payments.
- Tax: services are subject to **provincial sales tax**, and rates differ by province. Invoices carry
  NTN/STRN fields and a configurable tax line. Confirm the rules with a tax adviser before launch.

### D7. Hosting

- Region close to Pakistan for latency (Middle East cloud regions). Confirm any data-residency
  requirements before choosing.
- MongoDB Atlas (dedicated tier), managed Redis, object storage for logos and invoice PDFs, Cloudflare
  in front of everything (CDN, WAF, bot protection, DDoS).

---

## 4. Scale & security targets (design assumptions)

These are the numbers the architecture is designed and load-tested against. Adjust them if your
targets differ.

| Dimension | Design target |
|---|---|
| Customers | 10 million accounts |
| Businesses | 50,000 tenants, 150,000 branches |
| Stampers | 250,000 devices |
| Stamps | 5 million / day, **peak 500 taps/second** (lunch, evenings, Ramadan iftar, Eid) |
| Tap → stamp shown | p95 under 800 ms on a 4G connection; API p95 under 250 ms |
| Customer portal | First load under 150 KB of gzipped JavaScript; usable on 3G |
| Availability | 99.9% monthly for tap and stamp paths |
| Data loss / recovery | RPO 5 minutes (point-in-time backups), RTO 1 hour |
| Security baseline | OWASP ASVS Level 2; external penetration test before public launch |

---

## 5. Target architecture

```
                 Cloudflare (CDN · WAF · bot protection · edge rate limits)
                                       │
      ┌──────────────┬─────────────────┼──────────────────┬──────────────┐
   portal (PWA)  business dashboard  admin console     marketing     api.*
      └──────────────┴────────┬────────┴──────────────────┘              │
                              ▼                                          │
                 API service (stateless, autoscaled, ≥2 zones) ◄─────────┘
                   │            │             │
                   ▼            ▼             ▼
            MongoDB Atlas     Redis       Cloud KMS
            (replica set,   (rate limits,  (SUN master keys,
             sharding-ready, OTP, tap       secrets)
             PITR backups)   tokens, cache,
                   │         job queues)
                   │            │
                   ▼            ▼
            Outbox collection ─► Worker service (BullMQ)
                                  ├─ notifications: WhatsApp / SMS / email
                                  ├─ billing: invoices, reminders, suspension
                                  ├─ analytics: daily aggregates
                                  └─ exports, PDFs, fraud rules
```

Key points:
- **Outbox pattern:** the stamp transaction writes an outbox event in the same transaction; workers
  deliver notifications and update aggregates. The stamp path never waits on WhatsApp or SMS.
- **Pre-aggregated analytics:** `business_daily_stats` and similar counters replace the current
  full-collection scans. Heavy reports read from an analytics node.
- **Everything shared lives in Redis:** rate limits, OTP state, tap tokens, idempotency and caches. The
  current in-memory rate limiter does not work with more than one API instance.
- **Sharding-ready:** stamps, cards and redemptions queries always include `businessId` or
  `customerId`, so shard keys can be introduced when the data size demands it.
- **Cursor pagination** everywhere (the current `skip`-based pagination degrades on large collections).

---

## 6. Phased plan

Legend: `[x]` done · `[~]` partly done (see the note) · `[ ]` not started.

Each phase lists its goal, the work, and exit criteria. Phases 0–3 are sequential. Phase 4 starts in
parallel with Phase 2 and must finish before public launch.

### Phase 0 — Stabilise the foundation and lock decisions

**Goal:** a reliable base to build on, and the decisions that unblock everything else.

Engineering
- [x] Run the existing integration suite against the Docker replica set and fix failures
      — _it had never run; fixed branch creation (500 on every branch without a location) and
      too-short test keys; now 24 tests_
- [~] CI on every push: lint, typecheck, unit + integration tests, build (GitHub Actions)
      — _`.github/workflows/ci.yml` written and every step passes locally; first GitHub run
      happens on the next push_
- [~] ESLint + Prettier + commit hooks; dependency, secret and SAST scanning in CI
      — _ESLint 9, Prettier, EditorConfig and a lint-staged pre-commit hook in place; `npm audit`
      (after upgrading Next.js 14→16, React 18→19, zod 3→4: no high or critical; 5 moderate in Sentry's build-time source-map plugin (`glob`/`minimatch`), which only runs with `withSentryConfig` and is not used here), gitleaks, CodeQL
      and Dependabot configured, pending the first GitHub run_
- [~] Repo layout for multiple apps: `api`, `worker`, `portal`, `dashboard` (current `web`), `admin`,
      shared `packages/*` — _`admin/` is now its own Next.js app and workspace; `portal/` comes in
      Phase 2 and `worker/` in Phase 4; renaming `web` to `dashboard` is left until then_
- [~] Add Redis; move rate limiting, idempotency and caching onto it
      — _Redis in `docker-compose.yml`; every rate limiter uses it when `REDIS_URL` is set
      (verified: 429 after the 10th login across a shared store); required in staging and
      production. Stamp idempotency stays on MongoDB's unique index by design. Caching moves to
      Phase 4_
- [x] Error tracking (Sentry or equivalent) for API and web apps; structured logs without PII
      — _Sentry in the API (5xx only, cookies, auth headers and bodies stripped) and in the web
      app (server, edge and browser); off unless a DSN is configured_
- [~] Environments: development, staging, production with separate databases, secrets and keys
      — _[docs/environments.md](docs/environments.md); the API refuses to start in staging or
      production without Redis, without CORS origins, or with identical JWT secrets. Provisioning
      the actual staging and production infrastructure is still to do_
- [x] Fix known defects: manual stamp (no transaction, no cooldown, no route), duplicate
      `redemptionCode` index, reward-tier selection, analytics `distinct` over all stamps,
      raw Mongoose documents returned to clients (add response serializers)
      — _all fixed and tested. Responses: every model drops fields that are never selected by
      default (password and MFA secrets, activation codes) and fields marked `private` (token and
      code hashes, file keys) when sent, even if a query selected them; a JSON replacer strips
      those names from plain objects too; a test sweeps every GET route. Also fixed: the compiled API could
      not start (`node dist/server.js` crashed on the shared TypeScript packages); it is now
      bundled with tsup_
- [x] Seed scripts: Super Admin, demo business, demo customers — _`seed:admin`, `seed:demo`_

Decisions (Architecture Decision Records in `docs/adr/`)
- [x] NFC tag model — [ADR 0001](docs/adr/0001-nfc-tag-model.md): NTAG 215 with counter mirror
      now, NTAG 424 DNA later
- [ ] OTP providers (WhatsApp Business API + SMS aggregator) and monthly budget
- [ ] Payment gateway shortlist and merchant account applications (these take weeks; start now)
- [ ] Hosting region, domains, data-residency position
- [ ] Plan prices and limits (see §7)

**Exit:** CI green, integration tests passing, decisions recorded.

---

### Phase 1 — Platform owner console and invite-only tenant onboarding

**Goal:** the Super Admin can bring a business onto the platform end to end without touching the
database or curl.

Platform roles and security
- [x] Platform permission matrix: `SUPER_ADMIN` (everything), `ADMIN` (operations), `SUPPORT`
      (read-only plus limited actions), `FINANCE` (billing only) — _`PLATFORM_PERMISSIONS` in
      `packages/constants`; every `/admin` route names its permission; team management API
      (`/admin/team`): add, change, remove, never your own role; removal ends sessions_
- [x] Mandatory TOTP MFA for all platform users; session list and remote sign-out — _TOTP (RFC
      6238 vectors tested), secrets sealed with AES-256-GCM, codes never accepted twice, 10
      single-use recovery codes; admin routes return `MFA_SETUP_REQUIRED` until it is on; also
      mandatory for business owners. Sessions: list, sign out one, sign out all others; admin force
      sign-out; suspension ends sessions_
- [ ] Admin console behind Cloudflare Access or IP allowlist — _infrastructure; with the admin app_

Business invitations
- [~] `business_invitations` collection: hashed single-use token, 7-day expiry, plan and trial preset
      — _built, including plan and trial length_
- [~] Delivery by email and WhatsApp; resend and revoke — _owners are emailed their link on invite
      and on resend (through the outbox), and the link is still shown to the team to share by hand;
      staff are emailed when invited. WhatsApp waits for a provider_
- [~] Accept page: set password, verify phone, enrol MFA, land in onboarding wizard — _`/invite/[token]`
      handles new accounts, existing accounts (must sign in first) and wrong-account cases, then
      sends owners to set up MFA; phone is stored but not verified (phone OTP comes later, per D2); the
      setup wizard is built_
- [x] Remove self-serve `POST /businesses` for ordinary users; marketing-site "request access" form
      feeds a lead list in the admin console — _route removed (`/admin/businesses` creates and
      invites); public `POST /leads` with Pakistani mobile validation; leads list, notes, status and
      automatic "converted" on invite. Marketing-site form itself not built_

Admin console
- [x] Overview: tenants by status, active stampers, stamps today, signups — _separate `admin/` app:
      "needs attention" (new leads, pending invitations, suspended businesses, stampers to assign)
      and platform totals. Stamps-today and signup trends need the Phase 4 aggregates_
- [x] Businesses: list, search, filter by status/plan/city; detail page with branches, devices,
      members, subscription and audit trail; activate, suspend and restore with reason — _search by
      name/slug/phone, status filter, invite form (also pre-filled from a lead), detail page with
      counts, people, branches, stampers, invitations (new link / revoke) and suspend/restore with a
      reason. Subscription card built; filter by plan and by city (businesses now have a city,
      set on invite and in the owner's settings; a lead's city carries over)_
- [~] Stamper fleet: mint batches, provision SUN keys, assign to business/branch, track status
      (provisioned → shipped → active → revoked/replaced), print labels and QR — _fleet list with
      filters, mint batches (activation codes shown once), assign from the business page.
      Printable labels: right after minting with the activation code, and reprints (without it)
      for a business's stampers; each has a QR code that opens the dashboard's activation form
      with the stamper ID filled in. "Mark shipped" with courier and tracking number emails the
      owners, and the owner's Stampers page shows it on its way. SUN keys (NTAG 424 DNA) not built_
- [x] Users: search customers and business users; suspend/restore; force sign-out
- [x] Audit log viewer with filters — _by kind of action, by who did it (email), by business and by
      date range (Pakistan days)_
- [x] Support "view as business" — read-only, time-limited, banner shown, fully audited — _Super
      Admin, Admin and Support open it from the business page with a reason; for 30 minutes they
      sign in to the dashboard with their own account and see it as the owner does, under a banner.
      Every write is refused, every page opened is kept with the view, start and end are in the
      audit log, and the business page lists recent views_
- [x] Platform team page — _add by email, change role, remove (signs them out); own role locked_

Business dashboard
- [~] Onboarding wizard: profile, logo upload (object storage, signed URLs, image validation),
      first branch, first program, first reward, staff invites — _`/setup` wizard and an overview
      checklist (details → branch → program → reward → stamper → optional staff), driven by
      `GET /onboarding`. Logo upload waits for object storage_
- [x] Edit screens for programs, rewards and branches; activate/deactivate toggles — _also a
      business Settings page_
- [x] Staff management: invite, accept-invite page, change role, disable, branch scoping enforced —
      _invitations listed on "Your businesses" with accept/decline; branch limits enforced on manual
      stamps, reward validation, stamper activation and activity lists_
- [x] Customers page: paginated, masked phone, card progress, history — _search by name or last
      phone digits; customer page shows cards, stamps and rewards at this business only_
- [x] Device activation, revoke and "report lost stamper" — _any staff member can report; "lost"
      revokes at once_
- [x] Suspended business sees a read-only dashboard with a clear reason — _API refuses every change
      with `BUSINESS_SUSPENDED` and the reason; the dashboard shows a banner_
- [x] Role-aware dashboard — _navigation per role; cashiers get a counter home instead of analytics_
- [x] Dashboard sessions renew in the background (15-minute access tokens no longer sign people out)
- [x] Real client address passed from the dashboard and console to the API (shared secret), so rate
      limits and session records are per user, not per server; per-account and per-challenge sign-in
      limits added (generous per-address limits for carrier-grade NAT on Pakistani mobile networks)

**Exit:** a test business is invited, onboarded, configured and has an active stamper, entirely
through the UI. Cross-tenant tests pass for every business route.

---

### Phase 2 — Customer portal and secure tap-to-join / tap-to-stamp

**Goal:** a customer with any modern phone can join and earn stamps by tapping, and replaying a tap
from home does not work.

Secure taps (server)
- [x] Device model: tag type, tag UID, last tap counter
- [x] `POST /taps` — verify the tap and counter, issue a single-use tap token (Mongo, TTL-indexed;
      move to Redis with the rest of the shared state)
- [x] `POST /stamps` consumes a tap token inside the stamp transaction; a bare device identifier is
      accepted only for `STATIC` stampers
- [x] NTAG 21x UID + counter mirror verifier
- [x] Admin action to reset a stamper's bound UID and counter (after a tag is re-written or replaced)
      — _from the business page or the fleet list, with a reason; the old UID and counter go in the
      audit log and the next verified tap binds the new chip_
- [x] Portal route `/t/:deviceIdentifier` that forwards the URL's query parameters to `POST /taps`
- [ ] Before public launch: NTAG 424 DNA (SUN) verifier, per-tag keys derived from a KMS master
      key, key rotation procedure

Customer authentication
- [x] Email code sign-up and sign-in (replaces phone OTP for now): one flow for both; 6-digit
      code, 5-minute expiry, 5 attempts, only the newest code works, 60-second resend cooldown, HMAC
      of the code stored (MongoDB TTL collection; Redis in Phase 4); same answer whether or not an
      account exists; per-email and per-address limits; still asks for the authenticator code when
      two-step verification is on. Email goes through one service: console in development, any SMTP
      provider in production (required there)
- [ ] Phone OTP over WhatsApp/SMS, with per-prefix limits and CAPTCHA — _later, per D2_
- [x] Cookie sessions for the portal (httpOnly, Secure, SameSite=Lax) — _server actions carry
      Next.js's built-in origin check; background renewal like the other apps_
- [x] Account deletion and data export for customers — _from the portal's profile page: a JSON download of everything held, and deletion with typed confirmation. Deletion erases name, email, phone and password, signs out everywhere, cancels pending rewards and deletes notifications; stamps stay unnamed in each business's records. Staff and team accounts must be removed from those roles first_

Customer portal (PWA)
- [x] Tap landing: business branding, program explanation, sign up or log in, join — _`/t/<id>`
      route handler verifies the tap; signed-out or new customers go to `/join` with the tap held
      for 5 minutes_
- [x] First tap = join; later taps = stamp — _a signed-in member gets the stamp straight from the
      tap; a member whose session had ended can collect it after signing in. No welcome stamp yet_
- [~] Live card update with clear success and error states (cooldown, not enrolled, stamper inactive,
      business unavailable, offline) — _plain-language results on the card and a tap-error page;
      offline handling not built_
- [x] "My cards": every business the customer has joined, each card separate
- [x] Rewards: unlocked rewards with code and QR to show staff; history
- [ ] Web NFC listening inside the page on Android Chrome
- [ ] Urdu and English (RTL support), PKR formatting, Asia/Karachi time
- [ ] Notification centre; consent for WhatsApp messages per business
- [ ] Install-to-home-screen prompt

Counter mode for businesses (mobile web)
- [x] Staff add a stamp by scanning the customer's rotating card code (camera or typed);
      per-staff daily caps; audited — _the portal card shows an 8-character code + QR that changes
      every few minutes and works once (spent inside the stamp transaction). Ordinary staff need the
      code; stamping by search stays with managers and owners. Camera scanning uses the browser's
      barcode reader (Chrome on Android); elsewhere staff type the code_
- [x] Staff validate redemptions by scanning the reward QR or entering the code
- [ ] Optional manager approval for stamps above a threshold

Programs and rewards
- [x] Multiple reward tiers per program (fix the current single-threshold logic) — _done in Phase 0_
- [x] Stamp expiry and reward expiry options; reward-expiring reminder job — _rewards can be
      valid for N days after unlocking; expired codes are refused at the counter. A program can
      expire stamps after 7–730 days without a visit: customers are warned in the app and by email
      a week before, the hourly job empties lapsed cards and tells them, the card page shows the
      date, and a stamp on a lapsed card starts again at one even before the job runs_

Fraud controls
- [x] Daily cap per card per business, cooldown per card, velocity rules per device and per staff —
      _per-card daily limit (program setting, resets at midnight Pakistan time), cooldown, per-staff
      daily limit (business setting), burst check per stamper_
- [x] Anomaly flags: stamps outside opening hours, bursts from one stamper, many new accounts on one
      stamper; review queue for owners and admins — _alerts for stamper bursts, replayed links,
      copied-chip suspicion, staff limits, stamps while the branch is closed (branches have
      opening hours in Pakistan time, past midnight allowed, 30 minutes' grace) and ten or more
      brand-new accounts getting a first stamp at one stamper within an hour; one alert per
      problem with a repeat count; owners and managers review on Alerts, the platform team sees
      all businesses in the console_

**Exit:** the device test matrix (about 10 Android phones across price bands, plus iPhones) joins and
stamps by tapping; replayed URLs are rejected; end-to-end tests cover join, stamp, unlock and redeem.

---

### Phase 3 — Subscriptions and billing

**Goal:** businesses pay monthly in PKR. Non-payment is handled automatically. The Super Admin sees
revenue and collections at a glance.

Plans and entitlements
- [x] `plans` collection, editable by the Super Admin, **versioned** so existing customers can keep
      ("grandfather") their price — _four default plans created on first use; edits bump the version; subscriptions keep a copy of price and limits_
- [~] Entitlements service: limits on branches, active programs, stampers, staff, customers, plus
      feature flags; enforced in API middleware and reflected in the UI — _limits on branches, active programs, active stampers, staff and customers enforced in the API; feature flags not built_
- [x] Limits never break existing customers: at the customer limit, **new joins** are blocked and the
      owner is prompted to upgrade; existing cards keep working — _a customer new to the business is refused at the limit with a customer-friendly message; existing cards keep working_

Subscription lifecycle

```
TRIALING ──► ACTIVE ──(invoice overdue)──► PAST_DUE ──(grace ends)──► SUSPENDED ──(90 days)──► CANCELLED
               ▲                              │                           │
               └──────────(payment)───────────┴────────(payment)──────────┘
```

- [x] Scheduled jobs: renewal invoice 7 days before period end; reminders before due date, on the due
      date and during grace; automatic suspension; reactivation on payment — _`npm run jobs`: invoice emailed with bank/Raast details 7 days before trial/period end, reminders 3 days before, past due → 7-day grace → suspended → cancelled after 90 days (open invoices voided), owners emailed at each step_
- [x] Suspension stops stamping and puts the dashboard in read-only mode with a billing page;
      customers see "temporarily unavailable" (policy for pending rewards: see open decisions) — _billing suspensions are marked BILLING, lift automatically on payment, and keep reward redemption open for 30 days; a suspension by the team is unaffected by payment_
- [x] Upgrade takes effect immediately with prorated charge; downgrade at period end — _owners switch from Billing: monthly upgrades start at once and the difference for the days left goes on the next invoice; downgrades and cycle changes wait for the period end and can be cancelled; annual upgrades go through the team; a plan too small for current branches, programs, stampers or staff is refused. Changes by the team apply at once with no proration_
- [x] Annual billing option with discount — _annual cycle at the price of 10 months_

Invoices and payments
- [x] Sequential invoice numbers, PDF invoices and receipts, NTN/STRN, configurable tax line — _numbered per Pakistani fiscal year (TTS-2026-27-00001) with an atomic counter; seller and buyer details, discount and tax are copied onto each invoice; PDF from the console and the owner's Billing page; a paid invoice's PDF shows the payment. Billing settings page in the console (company, NTN/STRN, tax rate, invoice prefix, bank accounts, Raast ID)_
- [ ] `PaymentProvider` interface; first gateway integration with hosted checkout and
      signature-verified, idempotent webhooks — _deferred: card gateway comes later_
- [x] Bank transfer / Raast with proof upload and admin approval — _owner uploads a photo or PDF (5 MB, type checked by content, not name) against the open invoice, even while suspended for non-payment; console Receipts page to open, approve (records the payment) or reject with a reason (owner emailed). Files are kept on local disk (`STORAGE_DIR`) until object storage is set up_
- [x] Manual payment entry (cash, cheque) by `FINANCE` or `SUPER_ADMIN`, audited — _bank transfer, Raast, cash, cheque; paid time starts after any remaining trial or paid period; owner emailed a receipt_
- [~] Coupons, discounts, trial extensions, complimentary accounts; credit notes and refunds — _trial extensions (also revive an expired, never-paid trial); a percentage discount per business on future invoices (100% = complimentary, invoices settle themselves); void an unpaid invoice with a reason. Coupons, credit notes and refunds not built_
- [x] Hardware charges (stamper fee, replacement fee) as invoice line items — _Finance adds charges from the business page; they join the open or next invoice, are never discounted, and return to pending if that invoice is voided_

Owner billing page
- [~] Current plan, usage against limits, next invoice, invoices list, pay now, change plan — _Billing page with plan, status, usage, open invoice with PDF, bank/Raast details, receipt upload and its review status, invoices and payments lists, plan comparison with self-service switching; banners for trial ending, overdue and billing suspension. Card "pay now" needs the gateway_

Super Admin finance console
- [x] MRR, ARR, active / trialing / past-due / suspended counts, churn, trial conversion — _also collected this month; churn over 30 days, trial conversion over 90 days_
- [x] Overdue list with ageing and one-click reminders; revenue by plan and city — _overdue list
      with due date and suspension date; reminders are automatic, and Finance can send one more by
      hand from the list (at most once a day per business, audited); revenue by plan and by the
      city on each business's profile_
- [x] CSV export for the accountant — _invoices by issue date with subtotal, discount, tax, total and payment; Excel-safe (UTF-8 BOM, cells that could run as formulas are neutralised)_

**Exit:** in staging, with the gateway sandbox, a business moves through trial → active → past due →
suspended → reactivated, with correct invoices and notifications at every step.

---

### Phase 4 — Scale and security hardening (starts alongside Phase 2)

**Goal:** prove the platform survives "the masses" and an attacker before public launch.

Scalability
- [~] Outbox + worker service for notifications, aggregates, billing jobs and exports — _`npm run worker` sends queued email with retries and backoff and runs the hourly jobs, under a Redis lock; owner and reward email go through the outbox; sign-in codes stay direct. Aggregates, exports and push not moved yet_
- [ ] Pre-aggregated analytics; analytics queries on an analytics node
- [~] Cursor pagination on all list endpoints — _lists that grow with customers and activity (business customers, stamps, redemptions, platform users, audit log) page by cursor with matching indexes. Businesses, stampers and leads keep page numbers and counts: they grow with tenants, and the overview uses the counts. Public discovery search still uses pages_
- [~] Redis caches for device resolution, user status and entitlements, with explicit invalidation — _stamper, business status, user status and public business data cached; watched fields clear the entry from a schema hook on every write path, so revocation and suspension apply at once. Entitlements not cached: only read on writes, not on the tap path_
- [ ] Shard-key plan documented and validated on a staging cluster
- [ ] Autoscaling, at least two availability zones, zero-downtime deploys
- [~] Load tests (k6) at 3× target: tap storm, OTP storm, dashboard and analytics, billing run — _`loadtests/run.sh` runs the tap storm in Docker with a query profile. Laptop results only compare builds; the staging run against a target is still to do, and the other scenarios are not written. See `loadtests/README.md`_
- [ ] Tune per-address rate limits with real traffic (carrier-grade NAT puts many customers
      behind one address); confirm `CLIENT_IP_HEADER` for the chosen host

Security
- [x] Customer-to-customer isolation checked — _tests show a customer cannot read another's card, counter code, rewards, stamps or notifications, or claim a reward on another's card_
- [ ] Threat model per surface (portal, dashboard, admin, API, stamper, payments)
- [ ] OWASP ASVS Level 2 checklist completed
- [x] Tenant-isolation data-layer enforcement plus generated cross-tenant tests in CI — _once `requireBusinessRole` proves access, the rest of the request runs as that business (`api/src/models/tenantGuard.ts`): every read and write on a collection with `businessId` is limited to it, and naming another business is an error. A test walks the real router, so each new business route is checked for no token, another owner and a malformed id. Customer-to-customer isolation is by query filters and not covered by this guard_
- [ ] Secrets in a secrets manager; SUN master keys in KMS; key rotation runbook
- [x] Strict Content-Security-Policy, HSTS, secure cookies on every app — _per-response nonce with `strict-dynamic` on dashboard, console and portal, checked in real Chrome: pages hydrate and a script planted in the HTML is blocked. Pages now render per request because of the nonce. HSTS omits `includeSubDomains` because other services share the parent domain. Styles still allow inline_
- [ ] Append-only audit log shipped to write-once storage
- [x] Logs and errors scrubbed of phone numbers, OTPs, tokens and passwords — _request logs are an allow-list (method, path without query, status); no headers, IPs or user agents; invitation tokens removed from paths; emails and Pakistani mobiles removed from error messages and stacks; Sentry events lose headers, query strings and user data_
- [ ] External penetration test; all critical and high findings fixed

Reliability and operations
- [ ] Point-in-time backups; quarterly restore drill
- [ ] Tracing (OpenTelemetry), dashboards for tap success rate, OTP delivery rate, payment success
- [ ] Alerting, on-call rotation, runbooks, public status page

**Exit:** load test passes at 3× target; pentest criticals and highs closed; restore drill done within
RTO.

---

### Phase 5 — Pilot and public launch

**Goal:** real businesses and real customers, then open the doors.

- [ ] Legal: terms of service, privacy policy, business subscription agreement, data processing terms
- [ ] Pilot with 10–20 businesses (cafés first) in one city, free or discounted
- [ ] Stamper operations: provisioning line, packaging, delivery, installation guide
- [ ] Staff training: short Urdu video and printed counter card
- [ ] WhatsApp support line and an admin-side support workflow
- [ ] Pilot metrics: tap success rate, sign-up conversion from first tap, repeat visits, redemption
      rate, owner satisfaction
- [ ] Public launch: marketing site, pricing page, request-access funnel, sales playbook

**Exit:** pilot targets met (agree the numbers before the pilot starts); billing live with real
payments.

---

### Phase 6 — Growth (after launch)

- WhatsApp marketing campaigns with consent, templates and message credits billed per plan
- Customer segments, birthday rewards, win-back offers, referrals
- Points-based programs alongside stamps
- Native mobile app (revive the Expo app) if portal data shows demand
- Google / Apple Wallet passes (assessed and deferred earlier)
- Chain and franchise features; public business directory; partner API
- Data warehouse for platform analytics

---

## 7. Subscription plans (proposal — validate with the market)

Prices are placeholders in PKR per month, excluding tax. They are stored in the database and editable
by the Super Admin, so they can change without a release.

| | Starter | Growth | Pro | Enterprise |
|---|---|---|---|---|
| Indicative price | PKR 2,999 | PKR 7,999 | PKR 19,999 | Custom |
| Branches | 1 | 3 | 10 | Unlimited |
| Active loyalty programs | 1 | 3 | Unlimited | Unlimited |
| Stampers included | 1 | 3 | 10 | By contract |
| Staff accounts | 3 | 10 | Unlimited | Unlimited |
| Loyalty customers | 1,000 | 5,000 | 25,000 | Unlimited |
| Analytics | Basic | Full + CSV export | Full + branch comparison | Custom reports |
| Fraud review queue | — | ✓ | ✓ | ✓ |
| WhatsApp campaigns (Phase 6) | — | Add-on | Credits included | Credits included |
| Support | WhatsApp, business hours | WhatsApp, priority | Dedicated contact | SLA |

- **Trial:** 30 days on Starter limits, no card required (invite-only already filters leads).
- **Annual:** pay for 10 months, get 12.
- **Hardware:** extra stampers and replacements are one-time charges.

---

## 8. Data model changes

| Collection | Purpose |
|---|---|
| `business_invitations` | Owner invites from Super Admin; hashed token, expiry, preset plan |
| `business_customers` | Per-tenant customer relationship: consent, first seen, acquisition branch |
| `plans` | Versioned plan catalogue with limits and feature flags |
| `subscriptions` | One per business: plan version, status, period dates, trial end, grace end |
| `invoices` / `invoice_lines` | Billing documents, tax lines, sequential numbering |
| `payments` | Gateway, bank, Raast and manual payments; webhook references |
| `coupons` | Discounts and trial extensions |
| `outbox_events` | Reliable hand-off from transactions to workers |
| `business_daily_stats` | Pre-aggregated analytics counters |
| `fraud_flags` | Anomaly findings for owner and admin review |
| `leads` | "Request access" submissions |
| Changes to `users` | Phone becomes the primary customer identifier; MFA secrets for business and platform users; locale |
| Changes to `nfc_devices` | Tag UID, key version, last SUN counter, provisioning and shipping status |
| Changes to `stamps` | Source adds `STAFF`; staff attribution; tap-token reference |

Redis (not Mongo): OTP challenges, tap tokens, rate-limit counters, idempotency keys, caches, job
queues.

---

## 9. Pakistan-specific requirements

- Phone-first identity with +92 normalisation and validation.
- WhatsApp as the main channel for codes, receipts, reminders and support; SMS as fallback.
- English and Urdu, with right-to-left layout and a lightweight Urdu font.
- PKR without decimals; Asia/Karachi time zone (no daylight saving); opening hours that can change in
  Ramadan.
- Built for low-end Android phones, patchy 3G/4G and expensive data.
- Local payment methods: cards, JazzCash, Easypaisa, bank transfer, Raast.
- Local categories: café, restaurant, bakery, sweets, salon, barber, gym, pharmacy, retail, car wash,
  laundry, other.
- Addresses by city and area; city used for reporting and sales.
- Tax invoices with NTN/STRN; provincial sales tax on services (confirm with adviser).
- Privacy: Pakistan's personal data protection legislation has been in draft; design to a GDPR-like
  baseline (consent, minimisation, export, deletion, retention) so the platform is ready when it is
  enacted.

---

## 10. Decisions needed from you

1. ~~**NFC tags**~~ — decided 2026-10-31: NTAG 215 with counter mirror now; NTAG 424 DNA later.
   Still open: **when** to switch (recommended: before public launch).
2. **OTP:** WhatsApp-first with SMS fallback — and which providers and monthly budget.
3. **Payment gateway(s)** to integrate first.
4. **Plan prices and limits** in §7.
5. **Suspended business policy:** can customers still redeem rewards they already unlocked (recommended:
   yes, for 30 days)?
6. **First tap:** join only, or join plus a welcome stamp?
7. **Customer data visible to businesses:** masked phone by default (recommended), or full phone with
   consent?
8. **Native app:** confirm it is deferred to Phase 6.
9. **Platform team roles:** do you need `ADMIN`, `SUPPORT` and `FINANCE` users, or only Super Admin for
   now?
10. **Hosting region and domain names.**

---

## 11. Main risks

| Risk | Mitigation |
|---|---|
| Stamp fraud via copied tag URLs | NTAG 424 DNA SUN, single-use tap tokens, caps, anomaly flags |
| Staff collusion (staff stamping friends) | Staff-attributed counter stamps, daily caps, owner review queue |
| OTP cost and SMS-pumping attacks | WhatsApp first, CAPTCHA, per-prefix limits, spend alerts |
| Phones without NFC | Counter mode via customer QR or phone lookup |
| Payment collection failures | Invoice model, multiple payment methods, grace period, manual entry |
| Gateway onboarding delays | Apply in Phase 0; bank transfer and manual payments work without a gateway |
| A cross-tenant data leak | Data-layer enforcement, generated isolation tests, pentest |
| Traffic peaks (Ramadan, Eid, promotions) | Autoscaling, Redis, queues, load tests at 3× target |
| Customer adoption | No-install portal, one-tap join, Urdu UX, instant visible reward progress |
