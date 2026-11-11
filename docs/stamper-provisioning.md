# Provisioning an NTAG 215 stamper

How to prepare a stamper tag before it is shipped to a business. Each stamper
is one NTAG 215 chip. The steps match `tagType: NTAG21X_MIRROR` in the API.

## What the tag must hold

One NDEF URI record:

```
https://stamply.taptapsell.pk/t/<DEVICE_IDENTIFIER>?m=00000000000000x000000
```

- `<DEVICE_IDENTIFIER>` is the identifier printed when the device was minted
  (`POST /api/v1/admin/devices`).
- `00000000000000x000000` is a placeholder. With the mirror enabled, the chip
  replaces it on every read with its 7-byte UID (14 hex characters), an `x`,
  and its 24-bit tap counter (6 hex characters), for example
  `04A1B2C3D4E5F6x00001A`.

`stamply.taptapsell.pk` is the customer portal's host. Changing it later means
re-writing every tag, or keeping the old host alive as a redirect to the new
one, so be sure of it before provisioning at volume.

## Chip settings

| Setting | Value | Why |
|---|---|---|
| Mirror mode | UID **and** NFC counter | The server needs both |
| Mirror position | Start of the placeholder after `m=` | The chip writes over the placeholder |
| NFC counter | Enabled | Each tap must report a higher number |
| Write protection | Lock the tag (or set a write password) | Stops anyone from re-writing the URL |
| Config lock | Lock the configuration | Stops anyone from disabling the counter |

The counter keeps counting after the tag is locked, because the mirror is
applied when the tag is read, not stored in its memory.

NXP's **TagWriter** app can write a URI record with the UID and counter mirror
enabled. Check the result with NXP's **TagInfo** app: reading the tag twice
should show the counter go up by one.

## After provisioning

1. Tap the stamper once with any phone and confirm the URL ends with your
   chip's UID and a counter.
2. The **first accepted tap binds the chip's UID** to the device record. Taps
   from any other chip carrying the same URL are rejected from then on.
3. Ship the stamper with its activation code. The owner activates it from the
   dashboard.

## Known limits

- The counter is not signed. A saved or shared URL cannot be reused, but a
  person who edits the counter by hand can forge a tap. Cooldowns, daily caps
  and anomaly flags limit the damage. NTAG 424 DNA removes this weakness.
- If a tag is re-written or swapped for another chip, its bound UID and counter
  must be reset. There is no admin action for that yet, so clear `tagUid` and
  `lastTapCounter` on the device record directly.
- The 24-bit counter allows about 16.7 million taps per chip, far more than a
  stamper will see.
