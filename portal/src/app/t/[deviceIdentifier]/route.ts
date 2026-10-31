import { NextResponse, type NextRequest } from "next/server";
import { ApiRequestError, apiFetch, idempotencyKeyFor } from "@/lib/api";
import { encodeTap, getAccessToken, TAP_COOKIE, TAP_COOKIE_OPTIONS } from "@/lib/session";

interface TapResult {
  tapToken: string;
  business: { _id: string; name: string };
  programs: Array<{ _id: string; name: string }>;
}

interface MyCard {
  _id: string;
  status: string;
  programId: { _id: string } | null;
}

function go(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

/**
 * Where every stamper tap lands: /t/<stamper>?m=<UID>x<counter>.
 *
 * A route handler rather than a page, because a tap is an action: the API
 * checks the tap is fresh, and a signed-in member gets their stamp right
 * away. Anyone else is sent to /join with the tap held for five minutes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deviceIdentifier: string }> },
) {
  const { deviceIdentifier } = await params;
  const tapParams = Object.fromEntries(
    [...request.nextUrl.searchParams.entries()].slice(0, 10).map(([k, v]) => [k, v.slice(0, 256)]),
  );

  let tap: TapResult;
  try {
    tap = await apiFetch<TapResult>("/taps", {
      method: "POST",
      body: { deviceIdentifier: deviceIdentifier.slice(0, 32), params: tapParams },
      anonymous: true,
    });
  } catch (error) {
    const reason = error instanceof ApiRequestError ? error.code : "UNKNOWN";
    return go(request, `/tap-error?reason=${encodeURIComponent(reason)}`);
  }

  if (await getAccessToken()) {
    const cards = await apiFetch<MyCard[]>("/loyalty-cards").catch(() => null);
    const programIds = new Set(tap.programs.map((p) => p._id));
    const card = cards?.find(
      (c) => c.status === "ACTIVE" && c.programId && programIds.has(c.programId._id),
    );

    if (card) {
      try {
        const result = await apiFetch<{ unlockedRewards: unknown[] }>("/stamps", {
          method: "POST",
          body: { tapToken: tap.tapToken },
          idempotencyKey: idempotencyKeyFor(tap.tapToken),
        });
        const outcome = result.unlockedRewards.length > 0 ? "unlocked" : "stamped";
        return go(request, `/cards/${card._id}?result=${outcome}`);
      } catch (error) {
        const reason = error instanceof ApiRequestError ? error.code : "UNKNOWN";
        return go(request, `/cards/${card._id}?error=${encodeURIComponent(reason)}`);
      }
    }
  }

  const response = go(request, "/join");
  response.cookies.set(
    TAP_COOKIE,
    encodeTap({
      tapToken: tap.tapToken,
      businessId: tap.business._id,
      programIds: tap.programs.map((p) => p._id),
    }),
    TAP_COOKIE_OPTIONS,
  );
  return response;
}
