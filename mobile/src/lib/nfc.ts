import NfcManager, { NfcTech, Ndef, type TagEvent } from "react-native-nfc-manager";

export type NfcAvailability = "READY" | "DISABLED" | "UNSUPPORTED";

export async function checkNfcAvailability(): Promise<NfcAvailability> {
  const supported = await NfcManager.isSupported();
  if (!supported) return "UNSUPPORTED";

  await NfcManager.start();
  const enabled = await NfcManager.isEnabled();
  return enabled ? "READY" : "DISABLED";
}

export interface StamperTap {
  identifier: string;
  /** Query parameters the chip wrote into the URL (e.g. NTAG21x `m`); empty for static tags. */
  params: Record<string, string>;
}

/**
 * Pulls the stamper's public identifier and tap parameters out of the tag.
 *
 * The tag is expected to hold the stamper URL; the identifier is its last path
 * segment. Nothing on the tag is trusted — the backend verifies the tap and
 * decides everything (§10.2).
 */
function extractTap(tag: TagEvent | null): StamperTap | null {
  const record = tag?.ndefMessage?.[0];
  if (!record?.payload) return null;

  let text: string;
  try {
    text = Ndef.uri.decodePayload(new Uint8Array(record.payload));
  } catch {
    return null;
  }
  if (!text) return null;

  const [path, query = ""] = text.split("?");
  const segment = path.split("/").filter(Boolean).pop();
  if (!segment) return null;

  // Guard the format before it ever reaches the network (§31).
  if (!/^[A-Z0-9]{4,32}$/i.test(segment)) return null;

  // Parsed by hand: URLSearchParams is incomplete in React Native.
  const params: Record<string, string> = {};
  for (const pair of query.split("&")) {
    const [key, value] = pair.split("=");
    if (key && value && /^[A-Za-z0-9_-]{1,256}$/.test(value)) params[key] = value;
  }

  return { identifier: segment.toUpperCase(), params };
}

export async function readStamperTag(): Promise<StamperTap> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    const tap = extractTap(tag);

    if (!tap) {
      throw new Error("UNREADABLE_TAG");
    }
    return tap;
  } finally {
    // Always release, including when the scan was cancelled or the app was
    // backgrounded mid-read, so the next scan is not blocked (§32).
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}
