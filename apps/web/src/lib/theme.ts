import "server-only";
import { cookies } from "next/headers";
import type { Theme } from "@/components/theme-switch";

/** Light unless the person picked Dark or "Match my device" themselves
 *  (Shurik, 2026-10-27: light is the main look of HavenSpace). */
export async function currentTheme(): Promise<Theme> {
  const v = (await cookies()).get("theme")?.value;
  return v === "dark" || v === "system" ? v : "light";
}
