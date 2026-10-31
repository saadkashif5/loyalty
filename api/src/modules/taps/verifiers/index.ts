import type { TagType } from "@taptapsell/constants";
import { ntag21xMirrorVerifier } from "./ntag21xMirror";

export interface VerifiedTap {
  /** Chip UID as reported in the tap, uppercase hex. */
  tagUid: string;
  /** Per-chip tap counter. Must strictly increase from one accepted tap to the next. */
  counter: number;
}

export interface TapVerifier {
  /**
   * Reads and checks the parameters the chip wrote into the stamper URL.
   * Returns null when they are missing or malformed. Chips that sign their
   * taps (e.g. NTAG 424 DNA SUN) check the signature here, using the device
   * passed in; replay protection via the counter is applied by the caller.
   */
  verify(params: Record<string, string>, device: { tagUid: string | null }): VerifiedTap | null;
}

// STATIC has no verifier: those tags cannot prove a tap is fresh.
export const TAP_VERIFIERS: Partial<Record<TagType, TapVerifier>> = {
  NTAG21X_MIRROR: ntag21xMirrorVerifier,
};
