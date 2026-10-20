import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/room",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6efe6",
    theme_color: "#f6efe6",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
      { src: "/icons/192", type: "image/png", sizes: "192x192", purpose: "any" },
      { src: "/icons/512", type: "image/png", sizes: "512x512", purpose: "maskable" },
    ],
  };
}