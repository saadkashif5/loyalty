import type { MetadataRoute } from "next";

// Lets customers add the portal to their home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TapTapSell",
    short_name: "TapTapSell",
    description: "Your loyalty cards from every TapTapSell shop, in one place.",
    start_url: "/cards",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f766e",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
