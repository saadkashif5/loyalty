import { ImageResponse } from "next/og";
import { LogoMark } from "@taptapsell/brand/logo";

const SIZES = new Set([192, 512]);

/** The home-screen icon: the brand mark, drawn rather than stored. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<LogoMark size={size} square />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=604800, immutable" },
  });
}
