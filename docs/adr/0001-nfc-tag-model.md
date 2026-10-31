# ADR 0001 — NFC tag model for stampers

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Customers collect stamps by tapping a passive NFC stamper, which opens a URL
on their phone. A tag that holds a fixed URL can be tapped once, saved and
reopened from anywhere, so the tag itself must help prove that a tap is fresh.

Options considered:

| Option | Replayed URL | Hand-edited URL | Works without an app |
|---|---|---|---|
| NTAG 213/215, fixed URL | Accepted | Accepted | Yes |
| NTAG 215, re-written on every tap | Partly blocked | Accepted | No (iPhone browsers cannot write tags) |
| NTAG 215, UID + counter mirror | **Rejected** | Accepted | Yes |
| NTAG 424 DNA, SUN (signed counter) | Rejected | **Rejected** | Yes |

## Decision

Start with **NTAG 215 using the UID and tap-counter mirror**. Move to
**NTAG 424 DNA** later; the recommended point is before public launch.

## Consequences

- The server accepts a tap only if its counter is higher than the last one seen
  for that stamper, and binds the chip UID on the first accepted tap.
- A forged tap is possible by editing the counter by hand. Cooldowns, daily
  caps, staff holding the stamper and anomaly flags limit the damage until the
  move to NTAG 424 DNA.
- Chip-specific checks live behind the `TapVerifier` interface
  (`api/src/modules/taps/verifiers/`). Moving chips means adding a verifier and
  setting each stamper's `tagType`; the stamp flow does not change.
- Provisioning steps are in [docs/stamper-provisioning.md](../stamper-provisioning.md).
