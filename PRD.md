# TapTapSell Loyalty Platform — Product Requirements Document

**Document:** `PRD.md`  
**Version:** 1.0  
**Status:** MVP / Product Definition  
**Target Market:** Pakistan  
**Product Type:** NFC-first digital loyalty platform for businesses and customers

---

## 1. Product Overview

TapTapSell Loyalty is a digital loyalty platform that allows businesses such as cafés, restaurants, salons, bakeries, gyms, and retail stores to create digital loyalty programs.

The core experience is intentionally simple:

> **Customer purchases → taps their phone on the business NFC stamper → receives a digital stamp → completes the required stamps → redeems a reward.**

The business does not need a dedicated tablet, POS terminal, powered NFC reader, or counter device with a screen.

A small passive NFC stamper is placed at the business counter. The customer's mobile application reads the NFC tag and communicates with the backend to validate and record the stamp.

A QR code is placed alongside the NFC stamper as a fallback and onboarding mechanism.

The platform consists of:

1. **Customer Mobile App** — React Native
2. **Business Web Dashboard** — Next.js
3. **Backend API** — Node.js
4. **Database** — MongoDB
5. **Physical NFC Stamper** — passive NFC tag/device with QR fallback
6. **Platform Admin Dashboard** — initially part of the web application

---

# 2. Product Goals

## 2.1 Primary Goals

### Customer goals

- Create one account and use loyalty programs across multiple businesses.
- Discover participating businesses.
- Join a business loyalty program.
- View current stamp progress.
- Receive a stamp through NFC after a qualifying purchase.
- Use QR when NFC is unavailable.
- View earned rewards.
- Redeem rewards.
- View loyalty and redemption history.
- Receive relevant notifications.

### Business goals

- Create and configure loyalty programs without technical knowledge.
- Give customers stamps with minimal friction.
- Manage customers and loyalty activity.
- Create rewards.
- Track reward redemptions.
- Manage NFC stampers.
- Manage employees/staff.
- View basic business analytics.
- Manage multiple branches.
- Run retention/marketing campaigns in later phases.

### Platform goals

- Provide a scalable multi-tenant loyalty infrastructure.
- Prevent unauthorized stamp creation and reward redemption.
- Keep business-critical loyalty logic on the backend.
- Support multiple businesses per customer.
- Support multiple branches per business.
- Support multiple employees with different permissions.
- Provide an extensible foundation for future CRM, campaigns, WhatsApp, POS integrations, and advanced analytics.

---

# 3. Non-Goals for MVP

The following are explicitly outside the initial MVP scope:

- POS integrations
- Payment processing
- Online ordering
- Food delivery
- Table ordering
- Inventory management
- Accounting
- Full CRM automation
- WhatsApp automation
- SMS marketing
- AI recommendations
- AI customer segmentation
- Advanced business intelligence
- Complex campaign automation
- Franchise management
- Marketplace monetization
- Custom enterprise permissions UI
- Hardware requiring batteries or continuous power
- Dedicated business mobile application
- Cryptocurrency/blockchain loyalty
- Inter-business points transfers
- Cash wallet functionality
- Customer-to-customer transfers
- Complex membership/subscription billing
- Advanced referral systems

These may be considered after the core loyalty workflow is validated.

---

# 4. Target Users

## 4.1 Customer

A consumer who visits participating businesses and wants to earn loyalty rewards.

Examples:

- Café customer
- Restaurant customer
- Salon customer
- Gym member
- Bakery customer
- Retail customer

## 4.2 Business Owner

The person responsible for a business and its loyalty program.

## 4.3 Business Manager

A person authorized to operate/manage the loyalty program on behalf of the owner.

## 4.4 Business Staff

Employees who may need limited operational access.

## 4.5 Platform Admin

TapTapSell employees/operators responsible for onboarding, support, device management, and platform operations.

## 4.6 Super Admin

Platform owner/founder with unrestricted administrative capabilities.

---

# 5. Product Roles and Permissions

## 5.1 Platform Roles

### SUPER_ADMIN

Full platform access.

Capabilities:

- Manage platform admins.
- Manage businesses.
- Manage customers.
- Disable/restore accounts.
- Manage NFC devices.
- View platform-wide analytics.
- View audit logs.
- Manage critical platform configuration.
- Manage billing configuration.
- Perform support operations.

### ADMIN

Operational platform administrator.

Capabilities:

- Manage businesses.
- Manage customers.
- Manage devices.
- View platform analytics.
- Handle support operations.
- Review activity/audit logs.
- Disable accounts where authorized.

ADMIN should not have unrestricted access to critical platform configuration.

---

## 5.2 Business Roles

### OWNER

Full access to a business.

Capabilities:

- Manage business profile.
- Manage branches.
- Manage managers/staff.
- Create/edit loyalty programs.
- Manage NFC devices.
- View customers.
- View stamps.
- Create/manage rewards.
- Redeem/validate rewards where appropriate.
- View analytics.
- Manage campaigns when available.
- Manage subscription/billing.
- Transfer ownership where supported.

### MANAGER

Operational business management.

Capabilities may include:

- View customers.
- View loyalty activity.
- Manage stamps.
- Manage rewards.
- Manage NFC devices.
- Manage day-to-day loyalty operations.
- View analytics.
- Manage staff if explicitly granted.

MANAGER cannot:

- Delete the business.
- Transfer ownership.
- Manage ownership.
- Change critical billing settings unless explicitly permitted.

### STAFF

Limited operational access.

Capabilities:

- View permitted customer information.
- View loyalty activity.
- Validate/redeem rewards.
- Report device problems.
- Perform other explicitly permitted operational actions.

The MVP should minimize staff permissions.

---

## 5.3 CUSTOMER

Capabilities:

- Create/manage account.
- Discover businesses.
- Join loyalty programs.
- View loyalty cards.
- View stamp progress.
- Earn stamps.
- View rewards.
- Redeem rewards.
- View history.
- Manage notification preferences.

---

# 6. Multi-Tenant Architecture Requirement

A single user identity must not be permanently tied to one business role.

A person can have different relationships with different businesses.

Example:

```text
User A
 ├── Business A → OWNER
 ├── Business B → MANAGER
 └── Customer account → CUSTOMER
```

Therefore:

- `users` stores identity.
- `business_members` stores business-specific roles.
- Business authorization must always be scoped to the relevant business/branch.
- A global `user.role` field must not be used as the primary authorization mechanism.

---

# 7. Core User Journey

## 7.1 Business Onboarding

1. Business owner creates an account.
2. Owner creates business profile.
3. Owner adds business information.
4. Owner creates first branch.
5. Owner creates loyalty program.
6. Owner configures stamp requirement.
7. Owner creates one or more rewards.
8. Platform assigns/registers NFC stamper.
9. Business receives physical NFC stamper.
10. Owner activates the device.
11. Business places NFC stamper at checkout/counter.
12. Customer-facing QR code is displayed with the NFC stamper.

---

# 8. Customer Onboarding

## 8.1 First-Time Customer

1. Customer sees NFC/QR loyalty signage.
2. Customer scans the QR code.
3. QR opens a universal/deep link.
4. If the app is installed, the app opens.
5. If the app is not installed, a mobile web onboarding page opens.
6. Customer creates an account.
7. Customer is associated with the business/program.
8. Customer can install/open the mobile application.
9. Customer sees the loyalty card.
10. Customer can begin earning stamps.

The system should avoid forcing an application install before explaining the value proposition.

---

# 9. Core NFC Stamp Flow

## 9.1 Normal Flow

1. Customer makes a qualifying purchase.
2. Customer opens the mobile app.
3. Customer selects/opens the relevant loyalty card if required.
4. Customer taps their phone against the NFC stamper.
5. Mobile app reads the NFC tag.
6. App obtains the stamper/device identifier or token.
7. App sends an authenticated stamp request to the backend.
8. Backend authenticates the customer.
9. Backend validates the NFC device.
10. Backend identifies the business and branch.
11. Backend validates the loyalty program.
12. Backend evaluates stamp eligibility/fraud rules.
13. Backend records the stamp.
14. Backend updates loyalty progress.
15. If the required number of stamps has been reached, the backend creates/unlocks the reward.
16. App displays the updated loyalty card.
17. Customer receives confirmation.

---

# 10. NFC Architecture Requirements

## 10.1 Hardware

The MVP should use a passive NFC device/tag.

The device should:

- Require no battery.
- Require no continuous power.
- Require no screen.
- Be inexpensive.
- Be easy to replace.
- Be physically brandable.
- Have a QR fallback.

The exact NFC chip/model is an implementation decision and must be tested against supported iOS and Android devices before production.

## 10.2 NFC Data

The NFC tag must not contain loyalty state.

Do not store:

- Customer stamp count.
- Reward state.
- Sensitive customer information.
- Business secrets.
- Authentication credentials.

The NFC tag should primarily identify the physical stamper/device or resolve to a controlled application/deep-link destination.

The backend remains the source of truth.

## 10.3 Security

The system must not treat a public business ID as a sufficient security credential.

The architecture should support:

- Device registration.
- Device activation.
- Device status.
- Device-to-business association.
- Authentication.
- Request validation.
- Replay/rate limiting.
- Duplicate-stamp prevention.
- Audit logging.
- Device revocation.

A future hardware revision may introduce stronger cryptographic NFC mechanisms if required.

---

# 11. QR Fallback

Every NFC stamper must have an associated QR code.

Example:

```text
https://taployalty.pk/s/7F82K9
```

The QR should:

- Identify the physical stamper/business context.
- Open the mobile app when installed.
- Open the web experience when the app is unavailable.
- Support customer onboarding.
- Provide a fallback stamping workflow.
- Never expose sensitive credentials.

QR-based stamping must use the same backend validation and fraud controls as NFC.

---

# 12. Loyalty Program Requirements

A business must be able to create at least one loyalty program.

## 12.1 Program Fields

Minimum fields:

- Program name
- Description
- Business ID
- Branch scope
- Active/inactive status
- Required stamp count
- Reward
- Program start date
- Program end date, optional
- Branding
- Terms/conditions
- Customer eligibility rules

## 12.2 Example

```text
Program: Coffee Rewards

Buy 9 coffees
= 9 stamps

10th coffee
= Free
```

---

# 13. Stamp Requirements

A stamp represents one successful loyalty transaction.

Each stamp should contain:

- Stamp ID
- Customer ID
- Loyalty card ID
- Loyalty program ID
- Business ID
- Branch ID
- NFC device ID or QR device identifier
- Timestamp
- Source (`NFC` / `QR` / `ADMIN`)
- Request/device metadata where appropriate
- Status
- Audit metadata

## 13.1 Stamp Validation

The backend must validate:

- Customer authentication.
- Customer loyalty-card membership.
- Business/device relationship.
- Active loyalty program.
- Program eligibility.
- Device status.
- Duplicate/replay conditions.
- Rate limits.
- Relevant business rules.

The mobile client must never decide whether a stamp is valid.

---

# 14. Stamp Fraud Prevention

The MVP must include basic anti-abuse controls.

Potential controls:

- Authenticated customer requests.
- NFC device registration.
- Device revocation.
- Rate limiting.
- Minimum time between stamps where appropriate.
- Duplicate request detection.
- Idempotency keys.
- Server timestamps.
- Suspicious activity logging.
- Business/branch validation.
- Reward redemption validation.

The system should not assume NFC itself prevents fraud.

A customer physically holding or copying a public NFC identifier must not automatically gain unlimited valid stamps.

Advanced fraud detection can be added later.

---

# 15. Loyalty Cards

A customer may have multiple loyalty cards.

Example:

```text
Customer
 ├── Café A
 │    └── 6 / 10 stamps
 ├── Café B
 │    └── 2 / 8 stamps
 └── Bakery C
      └── 9 / 10 stamps
```

Each loyalty card should show:

- Business name
- Business logo
- Branch/program
- Current stamp count
- Required stamp count
- Progress indicator
- Available rewards
- Reward status
- Recent activity
- Expiration information where applicable

---

# 16. Rewards

Businesses can configure rewards associated with loyalty programs.

MVP reward fields:

- Reward ID
- Program ID
- Name
- Description
- Required stamps
- Reward type
- Reward value/description
- Active status
- Expiration date, optional
- Terms
- Redemption limit/rules

Examples:

- Free coffee
- 20% off
- Free dessert
- Rs. 500 discount
- Free haircut

---

# 17. Reward Redemption

A reward becomes redeemable after the customer meets the program requirements.

## 17.1 Redemption Flow

1. Customer opens reward.
2. Customer requests redemption.
3. Backend verifies reward eligibility.
4. Backend creates a redemption record.
5. Reward receives a unique redemption identifier.
6. Business staff verifies the reward.
7. Backend marks reward as redeemed.
8. Customer sees redemption confirmation.
9. Redemption is recorded in business history.

The same reward must not be redeemable multiple times unless explicitly configured.

## 17.2 Redemption Security

Use:

- Unique redemption IDs.
- Server-side validation.
- Atomic state transitions.
- Redemption status.
- Timestamp.
- Business/branch validation.
- Audit log.

---

# 18. Customer Mobile Application

## 18.1 Technology

- React Native
- Expo where compatible
- TypeScript
- Secure token storage
- Native NFC integration
- Push notifications

## 18.2 MVP Screens

### Authentication

- Welcome
- Login
- Sign up
- OTP/email verification as selected
- Forgot/reset password

### Customer

- Home
- Loyalty cards
- Loyalty card detail
- NFC scanning
- QR scanning
- Rewards
- Reward detail
- Redemption
- Activity/history
- Business discovery
- Business detail
- Profile
- Notification settings

## 18.3 Home Screen

Should prioritize:

- Active loyalty cards.
- Near-completion rewards.
- Available rewards.
- Recent activity.
- Nearby/discoverable businesses where location features are enabled.

Avoid making the MVP overly marketplace-like.

---

# 19. Business Web Dashboard

## 19.1 Technology

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui or equivalent component system

## 19.2 Dashboard Sections

### Overview

Display:

- Active customers
- Stamps issued
- Rewards earned
- Rewards redeemed
- Recent activity

### Loyalty Programs

- List programs
- Create program
- Edit program
- Activate/deactivate
- Configure stamps
- Configure rewards

### Customers

- Customer list
- Customer details
- Loyalty status
- Stamp history
- Reward history

### NFC Devices

- Device list
- Device status
- Device activation
- Device assignment
- Branch assignment
- Device revocation
- Device metadata

### Rewards

- Create reward
- Edit reward
- View rewards
- View redemption activity

### Staff

- Invite staff
- Assign roles
- Disable staff
- Manage permissions

### Branches

- Create branch
- Edit branch
- Activate/deactivate branch
- Assign devices
- Assign staff

### Analytics

MVP analytics:

- Total customers
- Active customers
- Stamps per day/week/month
- Rewards earned
- Rewards redeemed
- Redemption rate
- Loyalty participation

### Settings

- Business profile
- Branding
- Loyalty settings
- Notification settings
- Account settings
- Subscription/billing when implemented

---

# 20. Platform Admin Dashboard

The platform admin interface should support:

- Business management.
- Customer management.
- Device management.
- Business verification/status.
- Account suspension.
- Support operations.
- Platform activity.
- Audit logs.
- Basic platform analytics.

Admin actions affecting customer/business data must be auditable.

---

# 21. Business Discovery

The customer app may provide a directory of participating businesses.

MVP:

- Search business.
- Filter by category.
- View business profile.
- View available loyalty program.
- Join loyalty program.

Possible categories:

- Café
- Restaurant
- Bakery
- Salon
- Barber
- Gym
- Retail
- Other

Location-based discovery can be implemented after the core loyalty workflow is stable.

---

# 22. Notifications

MVP should support push notifications where technically appropriate.

Potential notifications:

- Stamp successfully added.
- Reward unlocked.
- Reward expiring.
- Reward redeemed.
- Loyalty milestone.
- Business announcements where explicitly enabled.

Notification infrastructure should be abstracted so future channels can include:

- Push
- Email
- SMS
- WhatsApp

WhatsApp Business messaging is not part of the MVP.

---

# 23. Authentication

The platform should support secure authentication.

Potential methods:

- Email/password
- Phone/OTP

The final MVP authentication method should be selected based on Pakistan-market onboarding friction and implementation complexity.

## 23.1 Token Architecture

Backend should use:

- Short-lived access tokens.
- Refresh tokens.
- Secure token storage on mobile.
- Token revocation/session management.

Mobile secrets must not be stored in plain local storage.

---

# 24. Backend API

## 24.1 Technology

- Node.js
- TypeScript
- Express or Fastify
- REST API

## 24.2 API Structure

```text
/api/v1/auth
/api/v1/users
/api/v1/businesses
/api/v1/business-members
/api/v1/branches
/api/v1/loyalty-programs
/api/v1/loyalty-cards
/api/v1/nfc-devices
/api/v1/stamps
/api/v1/rewards
/api/v1/redemptions
/api/v1/notifications
/api/v1/campaigns
/api/v1/analytics
/api/v1/admin
```

---

# 25. Backend Architecture

Recommended structure:

```text
src/
├── config/
├── middleware/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── businesses/
│   ├── branches/
│   ├── members/
│   ├── loyalty/
│   ├── devices/
│   ├── stamps/
│   ├── rewards/
│   ├── redemptions/
│   ├── notifications/
│   ├── analytics/
│   └── admin/
├── models/
├── services/
├── repositories/
├── utils/
├── routes/
├── jobs/
└── app.ts
```

Preferred request flow:

```text
Route
  ↓
Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository / Model
  ↓
MongoDB
```

Business rules must live in services/domain logic rather than controllers or mobile clients.

---

# 26. Database

## 26.1 Technology

MongoDB Atlas with Mongoose.

## 26.2 Core Collections

### users

```text
_id
name
email
phone
avatar
status
createdAt
updatedAt
```

### businesses

```text
_id
name
slug
description
logo
category
contact
status
settings
createdAt
updatedAt
```

### business_members

```text
_id
userId
businessId
role
permissions
status
createdAt
updatedAt
```

### branches

```text
_id
businessId
name
address
location
contact
status
createdAt
updatedAt
```

### loyalty_programs

```text
_id
businessId
name
description
requiredStamps
branches
rewards
status
startDate
endDate
settings
createdAt
updatedAt
```

### loyalty_cards

```text
_id
customerId
businessId
programId
stampCount
status
joinedAt
lastStampAt
createdAt
updatedAt
```

### nfc_devices

```text
_id
businessId
branchId
deviceIdentifier
deviceType
status
activationCode
metadata
createdAt
updatedAt
```

### stamps

```text
_id
customerId
loyaltyCardId
programId
businessId
branchId
deviceId
source
status
idempotencyKey
createdAt
metadata
```

### rewards

```text
_id
businessId
programId
name
description
type
value
requiredStamps
status
expiresAt
terms
createdAt
updatedAt
```

### redemptions

```text
_id
rewardId
customerId
loyaltyCardId
businessId
branchId
redemptionCode
status
redeemedAt
redeemedBy
createdAt
updatedAt
```

### notifications

```text
_id
userId
type
title
body
data
status
sentAt
createdAt
```

### audit_logs

```text
_id
actorUserId
actorRole
businessId
action
resourceType
resourceId
metadata
createdAt
```

---

# 27. Database Requirements

The database must enforce appropriate indexes.

Important indexes may include:

- User email.
- User phone.
- Business slug.
- Business members by `userId + businessId`.
- Loyalty cards by `customerId + programId`.
- NFC device identifier.
- Stamps by customer/program/date.
- Redemptions by redemption code.
- Audit logs by business/date.
- Notifications by user/status.

Unique constraints should be used wherever business logic requires uniqueness.

---

# 28. Loyalty Transaction Integrity

Stamp creation and reward generation must be atomic where possible.

Example:

```text
Purchase
   ↓
Validate stamp
   ↓
Create stamp
   ↓
Increment loyalty progress
   ↓
Check reward threshold
   ↓
Create/unlock reward
```

The system must avoid states where:

- A stamp is recorded but progress is not updated.
- Progress is updated without a stamp.
- A reward is generated twice.
- A redemption occurs twice.
- A retried API request creates duplicate stamps.

MongoDB transactions should be used where appropriate.

---

# 29. Authorization

Authorization must be performed server-side.

Every business-scoped request must validate:

```text
Authenticated user
        ↓
Business membership
        ↓
Role
        ↓
Permission
        ↓
Resource ownership/scope
```

Examples:

- Business A manager must not access Business B customers.
- Staff must not modify platform settings.
- Customers must not access business dashboards.
- A business must not access another business's NFC devices.
- A revoked user session must not continue making privileged requests.

---

# 30. API Security

Required controls:

- HTTPS.
- Authentication.
- Authorization.
- Input validation.
- Rate limiting.
- Request size limits.
- Secure headers.
- CORS configuration.
- No sensitive information in logs.
- Password hashing using an established password hashing algorithm.
- Refresh-token protection.
- Audit logging.
- Idempotency for sensitive operations.

Secrets must be stored in environment/secret management systems, never in source code.

---

# 31. Mobile Security

The mobile application must:

- Use secure token storage.
- Avoid storing sensitive loyalty state as authoritative data.
- Treat backend responses as the source of truth.
- Validate NFC payload format before sending requests.
- Handle duplicate NFC reads safely.
- Handle network failures gracefully.
- Never expose backend secrets.
- Avoid trusting user-modifiable local state.

---

# 32. NFC Edge Cases

The app must handle:

- NFC disabled.
- NFC unavailable on device.
- Unsupported device.
- Tag not detected.
- Wrong tag.
- Unknown tag.
- Deactivated tag.
- Network unavailable.
- User not authenticated.
- Customer not enrolled.
- Program inactive.
- Stamp already submitted.
- Rate limit exceeded.
- Device revoked.
- Customer attempting repeated taps.
- App backgrounded/interrupted during scan.

User-facing errors must be clear and actionable.

---

# 33. QR Edge Cases

Handle:

- Invalid QR.
- Expired QR.
- Deactivated device.
- Unknown business.
- App not installed.
- No network.
- Customer not authenticated.
- Customer not enrolled.
- Duplicate stamp request.

---

# 34. Offline Behavior

MVP should **not** attempt unrestricted offline stamp creation.

If the network is unavailable:

- The app should tell the customer the stamp could not be verified.
- It should not locally award a permanent stamp.
- The customer can retry when connectivity returns.

Future versions may support controlled offline workflows if there is a strong business requirement.

---

# 35. Business Multi-Branch Support

A business can have multiple branches.

Example:

```text
Business
 ├── Lahore Branch
 │    ├── NFC Stamper 1
 │    └── Staff
 ├── Karachi Branch
 │    ├── NFC Stamper 2
 │    └── Staff
 └── Islamabad Branch
      ├── NFC Stamper 3
      └── Staff
```

Requirements:

- Devices belong to branches.
- Staff can be branch-scoped.
- Stamps record branch.
- Analytics can be branch-specific.
- Loyalty programs can be configured for all or selected branches.

---

# 36. Analytics

## 36.1 MVP Business Metrics

- Total loyalty customers.
- Active loyalty customers.
- Total stamps.
- Stamps by date.
- Rewards unlocked.
- Rewards redeemed.
- Redemption rate.
- Average stamps per customer.
- Customers near reward completion.

Analytics must be based on actual recorded transactions.

Avoid presenting statistically unsupported conclusions.

---

# 37. Audit Logging

The platform must log security-sensitive and business-critical operations.

Examples:

- Business created.
- Program created/edited.
- NFC device activated.
- NFC device revoked.
- Staff invited.
- Staff role changed.
- Reward created.
- Reward redeemed.
- Admin account action.
- Business suspended.
- Customer support action.

Audit logs should include actor, action, resource, timestamp, and relevant metadata.

---

# 38. Physical NFC Stamper

TapTapSell should be able to provide a branded physical NFC loyalty stamper.

Possible formats:

- Acrylic desk plaque.
- NFC puck.
- Counter sticker.
- Small branded stand.
- Custom business-branded card/plaque.

The exact physical design is outside the software MVP.

Every stamper should ideally contain:

```text
Tap phone to collect your loyalty stamp

[QR CODE]
```

The QR is a fallback and onboarding mechanism.

---

# 39. Hardware Lifecycle

NFC device states:

```text
UNASSIGNED
    ↓
ASSIGNED
    ↓
ACTIVE
    ↓
SUSPENDED / REVOKED
    ↓
REPLACED
```

Requirements:

- A device can belong to one business/branch at a time.
- Devices can be revoked.
- Replaced devices must not continue issuing valid stamps.
- Device history must remain auditable.

---

# 40. Subscription and Monetization

Subscription billing is part of the commercial product but should not block the initial technical MVP.

Potential model:

### Business subscription

Illustrative future tiers:

- Starter
- Growth
- Pro
- Enterprise

Potential billing dimensions:

- Number of branches.
- Number of customers.
- Loyalty programs.
- Campaigns.
- Analytics.
- Messaging.
- Staff accounts.

### Hardware revenue

One-time NFC stamper/product fee.

Final pricing must be determined through market validation and operating costs.

---

# 41. Pakistan Market Requirements

The product should be designed for Pakistani businesses and customers.

Consider:

- PKR currency.
- Pakistan phone numbers.
- Local business addresses.
- Pakistani time zone.
- Low-friction mobile onboarding.
- Android-first realities while maintaining iOS support.
- Intermittent mobile connectivity.
- Affordable hardware.
- Local business terminology.
- Future WhatsApp Business integration.
- Optional Urdu/localized content in future.

The system should not assume all customers have the latest smartphones or constant high-speed connectivity.

---

# 42. Internationalization

The architecture should avoid hard-coding Pakistan-specific assumptions.

Future support should be possible for:

- Multiple currencies.
- Multiple countries.
- Country-specific phone formats.
- Time zones.
- Localized languages.
- Country-specific messaging providers.

Pakistan is the initial market.

---

# 43. Performance Requirements

## Customer

Common operations should feel near-instant under normal connectivity.

Target:

- App launch: reasonable mobile performance.
- Loyalty card loading: <2 seconds under normal network conditions.
- Stamp request: target <2 seconds backend response under normal conditions.

These are engineering targets rather than guaranteed SLAs.

## Business Dashboard

- Dashboard should remain responsive with thousands of loyalty records.
- Lists should use pagination.
- Analytics should not require loading all historical records into the browser.

---

# 44. Scalability

The architecture should support growth from:

```text
10 businesses
      ↓
100 businesses
      ↓
1,000 businesses
      ↓
10,000+ businesses
```

without requiring a fundamental rewrite.

The MVP should not prematurely introduce microservices.

A modular monolithic Node.js backend is preferred initially.

---

# 45. Observability

Recommended:

- Error tracking with Sentry or equivalent.
- Structured backend logging.
- API request metrics.
- Authentication failure monitoring.
- NFC/stamp failure monitoring.
- Database performance monitoring.
- Basic uptime monitoring.

Important business events should be measurable.

---

# 46. Deployment

Suggested deployment architecture:

```text
                    ┌──────────────────────┐
                    │      Customers       │
                    │   React Native App   │
                    └──────────┬───────────┘
                               │
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │      Node.js API     │
                    │      api.domain      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     MongoDB Atlas    │
                    └──────────────────────┘

Business/Admin
       │
       ▼
┌──────────────────────┐
│ Next.js Web Dashboard│
│     domain.com       │
└──────────┬───────────┘
           │
           ▼
       Node.js API
```

Suggested infrastructure:

- Next.js → Vercel or equivalent.
- Node.js → Railway/Render/AWS or equivalent.
- MongoDB → MongoDB Atlas.
- Mobile builds → Expo EAS.
- DNS/CDN → Cloudflare.
- Error monitoring → Sentry.
- CI/CD → GitHub Actions.

Infrastructure provider can change without changing product requirements.

---

# 47. Environment Separation

Minimum environments:

```text
development
staging
production
```

Each environment should have separate:

- Database.
- API credentials.
- Authentication secrets.
- Push notification credentials.
- NFC/device configuration where necessary.

Production secrets must never be committed to Git.

---

# 48. Testing Requirements

## Unit Tests

Cover:

- Loyalty calculations.
- Stamp eligibility.
- Reward eligibility.
- Redemption rules.
- Permission checks.
- Device validation.
- Fraud/rate-limit logic.

## Integration Tests

Cover:

- Authentication.
- Stamp creation.
- Reward generation.
- Redemption.
- Business authorization.
- Device activation.
- Multi-branch behavior.

## End-to-End Tests

Critical customer journey:

```text
Sign up
 → Join program
 → NFC stamp
 → Progress update
 → Reward unlock
 → Reward redemption
```

Business journey:

```text
Business signup
 → Create branch
 → Create loyalty program
 → Register NFC device
 → View customer/stamp activity
 → Redeem reward
```

---

# 49. Acceptance Criteria

## Customer

- Customer can create an account.
- Customer can log in.
- Customer can join a loyalty program.
- Customer can view loyalty progress.
- Customer can scan an NFC stamper.
- Successful NFC scan can produce a validated stamp.
- Customer can use QR fallback.
- Customer can receive a reward after completing the required stamps.
- Customer cannot redeem the same single-use reward twice.
- Customer can view loyalty history.

## Business

- Owner can create a business.
- Owner can create a branch.
- Owner can create a loyalty program.
- Owner can configure stamp requirements.
- Owner can configure rewards.
- Owner can register/activate an NFC device.
- Owner can assign a device to a branch.
- Owner can view customers.
- Owner can view stamp history.
- Owner can view reward redemptions.
- Owner can invite staff.
- Role restrictions are enforced.

## Platform

- Admin can manage businesses.
- Admin can manage NFC devices.
- Admin actions are audited.
- Business data is tenant-isolated.
- Authentication is secure.
- Critical loyalty operations are server-authoritative.

---

# 50. MVP Scope

The MVP is considered complete when the following complete loop works reliably:

```text
Business signs up
        ↓
Creates loyalty program
        ↓
NFC stamper is registered
        ↓
Customer discovers/scans QR
        ↓
Customer creates account
        ↓
Customer joins program
        ↓
Customer makes purchase
        ↓
Customer taps phone on NFC stamper
        ↓
Backend validates request
        ↓
Stamp is created
        ↓
Customer sees progress
        ↓
Customer completes required stamps
        ↓
Reward becomes available
        ↓
Customer presents reward
        ↓
Business validates redemption
        ↓
Reward is marked redeemed
```

This loop is the primary MVP success criterion.

---

# 51. MVP Feature Checklist

## Customer App

- [ ] Authentication
- [ ] Profile
- [ ] Loyalty cards
- [ ] Business discovery
- [ ] Join loyalty program
- [ ] NFC scan
- [ ] QR fallback
- [ ] Stamp progress
- [ ] Rewards
- [ ] Reward redemption
- [ ] History
- [ ] Push notification foundation

## Business Dashboard

- [ ] Authentication
- [ ] Business profile
- [ ] Branch management
- [ ] Loyalty program management
- [ ] Reward management
- [ ] Customer management
- [ ] NFC device management
- [ ] Staff management
- [ ] Redemption management
- [ ] Basic analytics

## Platform Admin

- [ ] Admin authentication
- [ ] Business management
- [ ] Customer management
- [ ] NFC device management
- [ ] Account suspension
- [ ] Audit logs
- [ ] Basic platform analytics

## Backend

- [ ] REST API
- [ ] Authentication
- [ ] Authorization/RBAC
- [ ] MongoDB integration
- [ ] Loyalty engine
- [ ] NFC validation
- [ ] QR validation
- [ ] Stamp creation
- [ ] Reward generation
- [ ] Redemption
- [ ] Rate limiting
- [ ] Idempotency
- [ ] Audit logging
- [ ] Notifications foundation

---

# 52. Phase 2

After MVP validation:

## CRM

- Customer segmentation.
- Customer profiles.
- Customer lifetime activity.
- Visit frequency.
- Customer retention metrics.

## Marketing

- Push campaigns.
- Customer segments.
- Automated reminders.
- Reward-expiry reminders.
- Re-engagement campaigns.

## WhatsApp

Potential uses:

- Reward notifications.
- Promotional campaigns.
- Loyalty reminders.
- Business announcements.

WhatsApp Business Platform integration must follow Meta's applicable policies and messaging requirements.

## Advanced Analytics

- Customer retention.
- Cohort analysis.
- Repeat visit patterns.
- Branch comparison.
- Campaign performance.

## Multi-Branch Improvements

- Branch managers.
- Regional management.
- Branch-specific programs.
- Centralized customer analytics.

---

# 53. Phase 3

Potential platform expansion:

- POS integrations.
- Restaurant integrations.
- Advanced membership programs.
- Referrals.
- Cashback/points.
- Digital coupons.
- Gift cards.
- Enterprise accounts.
- Franchise management.
- White-label loyalty programs.
- Public business marketplace.
- More advanced fraud detection.
- Cryptographically stronger NFC hardware.
- Additional countries.

Phase 3 features should only be implemented after validating the core loyalty business.

---

# 54. Recommended Product Principles

## Principle 1 — One-tap experience

The customer interaction should be as simple as:

```text
Buy → Tap → Stamp
```

## Principle 2 — No business hardware complexity

The business should not need:

- A tablet.
- A powered reader.
- A dedicated computer.
- A screen at the counter.

## Principle 3 — Backend is the source of truth

Never trust:

- Mobile-local stamp counts.
- NFC tag contents.
- QR contents.
- Client-provided reward status.

## Principle 4 — QR is the fallback

NFC is the primary interaction.

QR ensures:

- Onboarding.
- Compatibility.
- Recovery when NFC fails.

## Principle 5 — Mobile app for customers, web dashboard for businesses

Do not build a separate business mobile application for MVP.

## Principle 6 — Start simple

Use a modular monolith rather than microservices.

Avoid building complex integrations before the basic loyalty loop is proven.

---

# 55. Technical Stack

| Layer | Technology |
|---|---|
| Customer Mobile | React Native + Expo + TypeScript |
| Business Web | Next.js + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Node.js + TypeScript |
| API | REST |
| Backend Framework | Express or Fastify |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Authentication | JWT + refresh tokens |
| Mobile Secure Storage | SecureStore / platform secure storage |
| Push Notifications | Firebase Cloud Messaging |
| NFC | React Native NFC/native APIs |
| QR | QR code + universal/app links |
| Web Hosting | Vercel/equivalent |
| API Hosting | Railway/Render/AWS/equivalent |
| DNS/CDN | Cloudflare |
| Monitoring | Sentry |
| CI/CD | GitHub Actions |
| Mobile CI/CD | Expo EAS |

---

# 56. Recommended Repository Structure

A monorepo is optional.

A practical initial structure:

```text
taptapsell-loyalty/
│
├── web/
│   └── Next.js business/admin dashboard
│
├── mobile/
│   └── React Native customer app
│
├── api/
│   └── Node.js REST API
│
├── packages/
│   ├── types/
│   ├── validation/
│   └── constants/
│
└── docs/
    └── architecture/
```

Shared TypeScript types/validation can be introduced once the API contracts stabilize.

---

# 57. API Design Principles

All API endpoints should:

- Be versioned.
- Return consistent response formats.
- Validate input.
- Enforce authentication where required.
- Enforce authorization.
- Return appropriate HTTP status codes.
- Avoid leaking internal errors.
- Support pagination for large collections.
- Use idempotency for sensitive write operations.
- Include request correlation IDs where useful.

Example:

```http
POST /api/v1/stamps
Authorization: Bearer <token>
Idempotency-Key: <unique-key>
```

The backend determines whether the customer receives a stamp.

---

# 58. Data Ownership and Privacy

The platform must clearly distinguish:

- Platform data.
- Business data.
- Customer data.
- Transactional loyalty data.

Businesses should only access customer information necessary for legitimate loyalty operations.

The platform should implement:

- Privacy policy.
- Terms of service.
- Data retention rules.
- Account deletion workflow.
- Appropriate access controls.
- Secure handling of personal information.

Legal/privacy requirements should be reviewed before production launch.

---

# 59. Account Deletion

Customers should be able to request account deletion.

The system must define what happens to historical transactional records.

Potential approach:

- Remove/anonymize personally identifying customer information.
- Retain non-identifying transactional records where legally/operationally necessary.
- Preserve audit integrity.

Exact retention periods should be defined before production launch.

---

# 60. Business Suspension

Platform admins must be able to suspend a business.

When suspended:

- Business dashboard access is restricted as configured.
- NFC devices are invalidated.
- New stamps are rejected.
- Rewards/redemptions follow a defined suspension policy.
- Existing data remains available to platform administrators.
- Suspension is recorded in audit logs.

---

# 61. Device Replacement

If a physical stamper is lost or replaced:

1. Owner/admin marks old device as revoked.
2. Old device can no longer issue valid stamps.
3. New device is assigned.
4. New device is activated.
5. Customer loyalty history remains unchanged.

---

# 62. Error Handling

The product should use human-readable errors.

Example:

```text
NFC detected
      ↓
Validating...
      ↓
✓ Stamp added

or

NFC detected
      ↓
Validating...
      ↓
This stamper is currently inactive.
Please contact the business.
```

Avoid exposing technical stack traces or database errors to users.

---

# 63. Product UX Requirements

The interface should be:

- Mobile-first.
- Fast.
- Simple.
- Clear.
- Low-friction.
- Accessible.
- Consistent between web and mobile.
- Suitable for frequent repeat use.

The most important customer action should remain obvious.

Avoid excessive onboarding screens.

---

# 64. Success Metrics

The product should measure objective usage metrics.

## Customer

- Signup conversion.
- Program join rate.
- First-stamp conversion.
- Repeat stamping frequency.
- Reward completion rate.
- Reward redemption rate.
- Monthly active customers.

## Business

- Business activation rate.
- Number of active businesses.
- Number of active branches.
- Number of active NFC devices.
- Stamps per business.
- Customer participation.
- Reward redemption volume.
- Business retention.

## Product

- NFC success rate.
- QR fallback usage.
- Stamp API error rate.
- Duplicate request rate.
- Average stamp response time.
- App crash rate.

Do not optimize for vanity metrics alone.

---

# 65. MVP Launch Strategy

The initial launch should focus on a limited group of businesses.

Suggested early categories:

1. Cafés
2. Bakeries
3. Salons/barbers
4. Gyms
5. Small retail businesses

Cafés are a natural initial use case because the loyalty behavior is easy to understand:

```text
Buy coffee
→ Tap
→ Stamp
→ Repeat
→ Free coffee
```

The product should be validated with real businesses before broad expansion.

---

# 66. MVP Operational Requirements

Before onboarding a business:

- Business account exists.
- Business has an active loyalty program.
- NFC device is registered.
- Device is assigned to correct branch.
- QR code is generated.
- Business knows how customers use the system.
- Staff understand reward redemption.

Support should have a method to remotely disable a device.

---

# 67. Open Technical Decisions

The following should be finalized during implementation/testing:

- Exact NFC chip/tag model.
- NDEF payload format.
- NFC library for React Native.
- Whether NFC read requires an app screen to be active on each platform.
- Exact QR stamping UX.
- Authentication method: phone OTP vs email/password.
- Push notification provider configuration.
- Subscription provider.
- Exact hosting provider.
- Exact business pricing.
- Reward model flexibility.
- Advanced anti-fraud strategy.
- Whether location-based discovery is included in MVP.
- Final visual identity and design system.

These decisions must be validated through device testing rather than assumptions.

---

# 68. Risks

## Risk: NFC compatibility

Different phones and operating systems can behave differently.

**Mitigation:** test representative Android and iOS devices before production.

## Risk: NFC cloning/replay

Simple NFC identifiers may be copied.

**Mitigation:** server-side validation, rate limits, device lifecycle management, idempotency, fraud monitoring, and future cryptographic hardware.

## Risk: Customer adoption

Customers may not want another app.

**Mitigation:** QR onboarding, clear value proposition, fast registration, and eventually wallet/deep-link support.

## Risk: Business adoption

Businesses may not want operational complexity.

**Mitigation:** passive hardware, simple setup, no tablet/POS requirement, and minimal staff workflow.

## Risk: Fraud

Customers may attempt repeated or unauthorized stamps.

**Mitigation:** server-authoritative transactions, rate limiting, anomaly detection, and business-side validation.

## Risk: Poor network connectivity

Stamp requests may fail.

**Mitigation:** clear retry UX and QR fallback; do not award unverified offline stamps in MVP.

---

# 69. Definition of Done — MVP

The MVP is ready for controlled production testing when:

- Customer app builds successfully on supported Android/iOS devices.
- Business dashboard is deployed.
- Backend API is deployed.
- Production database is configured.
- Authentication works securely.
- Business and customer roles are enforced.
- NFC devices can be registered and revoked.
- QR fallback works.
- Customer can join a program.
- Customer can receive a valid stamp.
- Duplicate stamps are prevented according to configured rules.
- Rewards unlock correctly.
- Rewards can be redeemed once.
- Multi-business customer accounts work.
- Multi-branch businesses work.
- Business data is tenant-isolated.
- Audit logs capture critical operations.
- Error monitoring is enabled.
- Backups/recovery procedures are defined.
- Privacy policy and terms are prepared.
- At least one real physical NFC stamper has been tested with representative customer devices.
- The complete business → customer → NFC → stamp → reward → redemption flow has been tested end-to-end.

---

# 70. Final MVP Boundary

The MVP should be judged by one question:

> **Can a real Pakistani business set up a loyalty program and can a real customer repeatedly earn and redeem loyalty rewards using a simple NFC tap, without the business needing dedicated electronic hardware?**

If the answer is yes, the core product has been built.

Everything else should be treated as an enhancement until the core loop is reliable.

