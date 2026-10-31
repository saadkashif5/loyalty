// Cookie names and options, kept free of next/headers so the proxy can use them.

// Separate names from the business dashboard, and SameSite=Strict: no link
// from another site can ever arrive at the console already signed in.
export const ACCESS_TOKEN_COOKIE = "tta_access";
export const REFRESH_TOKEN_COOKIE = "tta_refresh";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export const ACCESS_COOKIE_OPTIONS = cookieOptions(60 * 15);
// Admins sign in again (with their second factor) at least twice a day.
export const REFRESH_COOKIE_OPTIONS = cookieOptions(60 * 60 * 12);
