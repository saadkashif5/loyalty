// Cookie names and options, kept free of next/headers so the proxy can use them.
export const ACCESS_TOKEN_COOKIE = "ttp_access";
export const REFRESH_TOKEN_COOKIE = "ttp_refresh";
/** A verified stamper tap waiting for the customer to sign in or join (5 minutes). */
export const TAP_COOKIE = "ttp_tap";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    // Lax: a stamper tap opens the portal from outside, and the session must come along.
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export const ACCESS_COOKIE_OPTIONS = cookieOptions(60 * 15);
// Customers stay signed in on their own phone; matches the API's refresh lifetime.
export const REFRESH_COOKIE_OPTIONS = cookieOptions(60 * 60 * 24 * 30);
export const TAP_COOKIE_OPTIONS = cookieOptions(60 * 5);
