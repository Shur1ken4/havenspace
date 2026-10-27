import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Source_Serif_4 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { currentTheme } from "@/lib/theme";
import { APP_WINDOW_SCRIPT } from "@/lib/app-window";
import { AppWindow } from "@/components/app-window";
import { AppSplash } from "@/components/app-splash";
import "./globals.css";

const inter = Inter({ variable: "--font-inter-base", subsets: ["latin", "cyrillic"], display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces-base", subsets: ["latin"], axes: ["SOFT", "opsz"], display: "swap" });
// Fraunces has no Cyrillic, so Russian and Ukrainian headings fall back to Source Serif.
const sourceSerif = Source_Serif_4({ variable: "--font-serif-cyr", subsets: ["latin", "cyrillic"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: "%s · HavenSpace" },
    description: t("description"),
    applicationName: "HavenSpace",
    robots: { index: true, follow: true },
  };
}

// The phone's browser bar matches the page: light unless the person chose otherwise.
export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  if (theme === "light") return { themeColor: "#FAF8F5" };
  if (theme === "dark") return { themeColor: "#1E2421" };
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#FAF8F5" },
      { media: "(prefers-color-scheme: dark)", color: "#1E2421" },
    ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const theme = await currentTheme();
  return (
    <html
      // The app-window script may add data-app before React loads (lib/app-window.ts).
      suppressHydrationWarning
      lang={locale}
      data-theme={theme === "system" ? undefined : theme}
      className={`${inter.variable} ${fraunces.variable} ${sourceSerif.variable}`}
      style={{
        // Combine the self-hosted fonts into the stacks used by the tokens.
        ["--font-inter" as string]: "var(--font-inter-base)",
        ["--font-fraunces" as string]: "var(--font-fraunces-base), var(--font-serif-cyr)",
      }}
    >
      <head>
        {/* In the HavenSpace apps, before anything paints: platform only, no homepage. */}
        <script dangerouslySetInnerHTML={{ __html: APP_WINDOW_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <AppWindow />
        <AppSplash />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
