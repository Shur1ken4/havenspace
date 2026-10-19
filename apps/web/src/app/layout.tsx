import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Source_Serif_4 } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import "./globals.css";

const inter = Inter({ variable: "--font-inter-base", subsets: ["latin", "cyrillic"], display: "swap" });
const fraunces = Fraunces({ variable: "--font-fraunces-base", subsets: ["latin"], axes: ["SOFT", "opsz"], display: "swap" });
// Fraunces has no Cyrillic, so Russian and Ukrainian headings fall back to Source Serif.
const sourceSerif = Source_Serif_4({ variable: "--font-serif-cyr", subsets: ["latin", "cyrillic"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: "%s · CouchNote" },
    description: t("description"),
    applicationName: "CouchNote",
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F5" },
    { media: "(prefers-color-scheme: dark)", color: "#1E2421" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${fraunces.variable} ${sourceSerif.variable}`}
      style={{
        // Combine the self-hosted fonts into the stacks used by the tokens.
        ["--font-inter" as string]: "var(--font-inter-base)",
        ["--font-fraunces" as string]: "var(--font-fraunces-base), var(--font-serif-cyr)",
      }}
    >
      <body className="min-h-dvh">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
