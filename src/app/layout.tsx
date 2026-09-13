import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Martian_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import NavigationWrapper from "@/components/NavigationWrapper";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { HTML_LANG, type Locale } from "@/i18n/config";

/**
 * Three faces, one job each (design.md §3):
 *
 *   Inter          — prose, UI, labels, and every name a human typed. Proportional, so
 *                    "Kristiansand Kings" fits where monospace forced an ellipsis.
 *   JetBrains Mono — numerics only: scores, seeds, seat labels, clocks, invite codes.
 *                    Applied through `.mds-numeric`, not by hand.
 *   Martian Mono   — the Summit wordmark and page titles. The tactical identity, kept
 *                    where it is deliberate rather than everywhere.
 *
 * The variables are applied to <html>, never <body>: they are declared on `:root`, and a
 * <body>-only application silently fell back to serif in production once already.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jet",
  display: "swap",
});

const martianMono = Martian_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-martian",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Summit | Tournament Control",
  description: "Tournament management for teams, brackets, match flow, and live overlays.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility; cap to avoid layout-breaking pinch on the bracket canvas.
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale comes from the cookie / Accept-Language, never the URL (src/i18n/config.ts).
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html
      lang={HTML_LANG[locale] ?? "en"}
      className={`${inter.variable} ${jetMono.variable} ${martianMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased text-fg" suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <NavigationWrapper>
              {children}
            </NavigationWrapper>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
