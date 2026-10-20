import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HavenSpace — AI practice agent for therapists",
    short_name: "HavenSpace",
    description: "Session notes and reflective practice for therapists.",
    start_url: "/today",
    display: "standalone",
    background_color: "#FAF8F5",
    theme_color: "#2E6E6A",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
