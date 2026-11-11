import type { TapVerifier } from "./index";

// NTAG213/215/216 with the "UID and NFC counter mirror" enabled overwrite a
// placeholder in the stamper URL on every read with `<UID>x<counter>`:
//   https://stamply.taptapsell.pk/t/AB12CD?m=04A1B2C3D4E5F6x00001A
// UID is 7 bytes (14 hex chars); the counter is 24 bits (6 hex chars).
//
// The counter is not signed. Requiring it to increase stops a saved or shared
// URL from being reused, but not someone who edits the number by hand. Moving
// to NTAG 424 DNA (SUN) closes that gap with a new verifier, not new callers.
const MIRROR_PATTERN = /^([0-9A-F]{14})x([0-9A-F]{6})$/i;

export const ntag21xMirrorVerifier: TapVerifier = {
  verify(params) {
    const match = MIRROR_PATTERN.exec(params.m ?? "");
    if (!match) return null;

    return {
      tagUid: match[1].toUpperCase(),
      counter: Number.parseInt(match[2], 16),
    };
  },
};
