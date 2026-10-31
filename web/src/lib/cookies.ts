// Cookie names and options, kept free of next/headers so the proxy can use them.
// Tokens live in httpOnly cookies rather than localStorage so page scripts —
// and anything injected into them — cannot read them (§30, §31).
export const ACCESS_TOKEN_COOKIE = "tts_access";
export const REFRESH_TOKEN_COOKIE = "tts_refresh";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Lax, not Strict: owners arrive from invitation links in email and WhatsApp.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export const ACCESS_COOKIE_OPTIONS = cookieOptions(60 * 15);
export const REFRESH_COOKIE_OPTIONS = cookieOptions(60 * 60 * 24 * 30);
