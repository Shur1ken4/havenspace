import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CouchNote — AI assistant for therapists",
    short_name: "CouchNote",
    description: "Session notes and reflective practice for therapists.",
    start_url: "/today",
    display: "standalone",
    background_color: "#FAF8F5",
    theme_color: "#2E6E6A",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
