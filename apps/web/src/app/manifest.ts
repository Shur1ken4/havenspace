import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Psych Copilot",
    short_name: "Copilot",
    description: "Session notes and reflective practice for therapists.",
    start_url: "/today",
    display: "standalone",
    background_color: "#FAF8F5",
    theme_color: "#6B8F7B",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
