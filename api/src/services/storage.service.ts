import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/config/env";

// Private files (payment receipts, exports). Kept on local disk for now; an S3/R2
// implementation can replace these three functions without touching callers.
// Keys are generated here and validated on read, so a stored key can never
// point outside the storage folder.
const KEY_PATTERN = /^[a-z]+\/\d{4}\/\d{2}\/[a-f0-9]{32}\.(png|jpg|webp|pdf|csv)$/;

function root(): string {
  return path.resolve(env.STORAGE_DIR);
}

export async function saveFile(folder: string, buffer: Buffer, extension: string): Promise<string> {
  const now = new Date();
  const key = `${folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomBytes(16).toString("hex")}.${extension}`;
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");

  const target = path.join(root(), key);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, buffer, { flag: "wx" });
  return key;
}

export function openFile(key: string): fs.ReadStream {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid storage key");
  return fs.createReadStream(path.join(root(), key));
}

/** Identifies a file by its first bytes, not by the name or type the browser claimed. */
export function sniffType(buffer: Buffer): { mime: string; extension: string } | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: "image/png", extension: "png" };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { mime: "image/webp", extension: "webp" };
  }
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") {
    return { mime: "application/pdf", extension: "pdf" };
  }
  return null;
}
