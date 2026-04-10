import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import NavigationWrapper from "@/components/NavigationWrapper";

const inter = Inter({ 
  subsets: ["latin"], 
  weight: ["400", "500", "600"], 
  variable: "--font-inter",
  display: "swap"
});

const outfit = Outfit({ 
  subsets: ["latin"], 
  weight: ["600", "700"], 
  variable: "--font-outfit",
  display: "swap"
});

export const metadata: Metadata = {
  title: "ApexPlay | Tournament Control",
  description: "Tournament management for teams, brackets, match flow, and live overlays.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className={`${inter.variable} ${outfit.variable} font-sans antialiased text-[var(--mds-text-primary)]`}
        style={{ fontFeatureSettings: '"kern" 1' }}
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
