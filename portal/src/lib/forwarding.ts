import { headers } from "next/headers";

type HeaderSource = { get(name: string): string | null };

/**
 * The user's real address, as seen by this server. The first X-Forwarded-For
 * entry is whatever the browser sent, so it is never used: either the hosting
 * platform's own header (CLIENT_IP_HEADER, e.g. cf-connecting-ip) or the entry
 * the nearest proxy appended (the last one).
 */
function clientIpFrom(source: HeaderSource): string | null {
  const platformHeader = process.env.CLIENT_IP_HEADER;
  if (platformHeader) return source.get(platformHeader)?.split(",")[0]?.trim() || null;

  const chain = source
    .get("x-forwarded-for")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain?.at(-1) ?? source.get("x-real-ip");
}

/**
 * Headers that let the API rate-limit and record sessions per user rather than
 * per server (see api/src/middleware/clientIp.ts). Sent only when the shared
 * secret is configured; the API ignores them without it.
 */
export function clientHeadersFrom(source: HeaderSource): Record<string, string> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return {};

  const ip = clientIpFrom(source);
  return {
    "X-Internal-Secret": secret,
    ...(ip ? { "X-Client-IP": ip } : {}),
    "X-Client-User-Agent": source.get("user-agent") ?? "",
  };
}

/** For Server Components and Server Actions. */
export async function clientHeaders(): Promise<Record<string, string>> {
  return clientHeadersFrom(await headers());
}
