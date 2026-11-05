import { ImageResponse } from "next/og";

const SIZES = new Set([192, 512]);

/** The home-screen icon, drawn rather than stored. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f766e",
        color: "white",
        fontSize: size * 0.36,
        fontWeight: 700,
      }}
    >
      TTS
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    },
  );
}
