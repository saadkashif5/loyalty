import type { MetadataRoute } from "next";
import { BACKGROUND_COLOR, BRAND, THEME_COLOR } from "@taptapsell/brand";

// Lets customers add the portal to their home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: `Your loyalty cards from every ${BRAND.name} shop, in one place.`,
    start_url: "/cards",
    scope: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
