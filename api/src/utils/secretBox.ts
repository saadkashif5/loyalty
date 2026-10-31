import crypto from "node:crypto";
import { env } from "@/config/env";

// Encrypts small secrets at rest (e.g. MFA seeds) with AES-256-GCM, so a
// database leak alone does not hand out working second factors.
// Format: "v1:" + base64(iv | auth tag | ciphertext).
const VERSION = "v1";

function key(): Buffer {
  if (env.MFA_ENCRYPTION_KEY) return Buffer.from(env.MFA_ENCRYPTION_KEY, "base64");
  // Development and tests only — staging and production refuse to start
  // without MFA_ENCRYPTION_KEY (see config/env.ts).
  return crypto.createHash("sha256").update(`mfa:${env.JWT_ACCESS_SECRET}`).digest();
}

export function seal(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${Buffer.concat([iv, tag, ciphertext]).toString("base64")}`;
}

export function open(sealed: string): string {
  const [version, payload] = sealed.split(":");
  if (version !== VERSION || !payload) throw new Error("Unsupported sealed secret");

  const raw = Buffer.from(payload, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
