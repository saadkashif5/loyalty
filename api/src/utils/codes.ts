import crypto from "node:crypto";

const UNAMBIGUOUS_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0, I/1

export function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += UNAMBIGUOUS_ALPHABET[bytes[i] % UNAMBIGUOUS_ALPHABET.length];
  }
  return out;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

// Public identifier printed on the physical stamper and embedded in the QR URL.
// Carries no authority on its own — the backend still validates device status,
// business association, and the customer's session (§10.3).
export function generateDeviceIdentifier(): string {
  return randomCode(6);
}

export function generateActivationCode(): string {
  return randomCode(8);
}

export function generateRedemptionCode(): string {
  return randomCode(8);
}
