// A fresh nonce per response: only scripts this server rendered may run, so
// injected markup cannot execute even if it reaches a page.
export function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  const sentry = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Next and React set inline style attributes; styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${sentry ? ` ${new URL(sentry).origin}` : ""}${dev ? " ws:" : ""}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** Hands Next the policy on the request, which is how it learns the nonce for its own scripts. */
export function applyContentSecurityPolicy(headers: Headers): string {
  const policy = contentSecurityPolicy(btoa(crypto.randomUUID()));
  headers.set("Content-Security-Policy", policy);
  return policy;
}
