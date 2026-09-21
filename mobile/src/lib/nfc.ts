import NfcManager, { NfcTech, Ndef, type TagEvent } from "react-native-nfc-manager";

export type NfcAvailability = "READY" | "DISABLED" | "UNSUPPORTED";

export async function checkNfcAvailability(): Promise<NfcAvailability> {
  const supported = await NfcManager.isSupported();
  if (!supported) return "UNSUPPORTED";

  await NfcManager.start();
  const enabled = await NfcManager.isEnabled();
  return enabled ? "READY" : "DISABLED";
}

/**
 * Pulls the stamper's public identifier out of the tag.
 *
 * The tag is expected to hold the stamper URL (the same one behind its printed
 * QR code); the identifier is its last path segment. Nothing else on the tag is
 * trusted — the backend re-resolves the identifier and decides everything (§10.2).
 */
function extractIdentifier(tag: TagEvent | null): string | null {
  const record = tag?.ndefMessage?.[0];
  if (!record?.payload) return null;

  let text: string;
  try {
    text = Ndef.uri.decodePayload(new Uint8Array(record.payload));
  } catch {
    return null;
  }
  if (!text) return null;

  const segment = text.split("?")[0].split("/").filter(Boolean).pop();
  if (!segment) return null;

  // Guard the format before it ever reaches the network (§31).
  return /^[A-Z0-9]{4,32}$/i.test(segment) ? segment.toUpperCase() : null;
}

export async function readStamperTag(): Promise<string> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const identifier = extractIdentifier(tag);

    if (!identifier) {
      throw new Error("UNREADABLE_TAG");
    }
    return identifier;
  } finally {
    // Always release, including when the scan was cancelled or the app was
    // backgrounded mid-read, so the next scan is not blocked (§32).
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
