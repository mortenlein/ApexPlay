import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Martian_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import NavigationWrapper from "@/components/NavigationWrapper";

// Subtick design system: JetBrains Mono for all UI/data, Martian Mono for display headings.
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
  title: "ApexPlay | Tournament Control",
  description: "Tournament management for teams, brackets, match flow, and live overlays.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Allow zoom for accessibility; cap to avoid layout-breaking pinch on the bracket canvas.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${jetMono.variable} ${martianMono.variable} antialiased text-[var(--mds-text-primary)]`}
        suppressHydrationWarning
      >
        <Providers>
          <NavigationWrapper>
            {children}
          </NavigationWrapper>
        </Providers>
      </body>
    </html>
  );
}
