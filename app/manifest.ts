import type { MetadataRoute } from "next";
import { withBasePath } from "@/lib/basePath";

// Required for metadata routes in a static export.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBasePath("/"),
    name: "Daily Reads",
    short_name: "Daily Reads",
    description: "Five fresh article ideas a day, written for you when you tap one.",
    start_url: withBasePath("/"),
    scope: withBasePath("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf7f2",
    theme_color: "#faf7f2",
    icons: [
      { src: withBasePath("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBasePath("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: withBasePath("/icons/icon-maskable-512.png"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
