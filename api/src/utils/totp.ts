import crypto from "node:crypto";

// RFC 6238 time-based one-time passwords: HMAC-SHA1, 30-second steps — the
// scheme every authenticator app (Google Authenticator, Microsoft
// Authenticator, Authy) supports.
const STEP_SECONDS = 30;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=-]/g, "").toUpperCase();
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): Buffer {
  return crypto.randomBytes(20);
}

export function timeStep(timeMs: number = Date.now()): number {
  return Math.floor(timeMs / 1000 / STEP_SECONDS);
}

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secret).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

export function generateTotp(secret: Buffer, timeMs: number = Date.now(), digits = 6): string {
  return hotp(secret, timeStep(timeMs), digits);
}

/**
 * Checks a code against the current step and one step either side (clock
 * drift). Returns the matching step so the caller can refuse to accept the
 * same step twice, or null when the code does not match.
 */
export function verifyTotp(
  secret: Buffer,
  code: string,
  timeMs: number = Date.now(),
  window = 1,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;

  const current = timeStep(timeMs);
  for (let offset = -window; offset <= window; offset += 1) {
    const step = current + offset;
    const expected = hotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return step;
  }
  return null;
}

export function otpauthUri(
  secretBase32: string,
  accountName: string,
  issuer = "TapTapSell",
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
