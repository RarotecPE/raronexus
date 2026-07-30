import type { MetadataRoute } from "next";

import { BRAND_ICON_URL } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RaroNexus",
    short_name: "RaroNexus",
    description: "Identity Provider corporativo para multiplos sistemas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0F3B68",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: BRAND_ICON_URL,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
