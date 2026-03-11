import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthContext";
import ThemeProvider from "@/components/layout/ThemeProvider/ThemeProvider";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import PersistentBottomBar from "@/components/player/PersistentBottomBar";
import CookieConsent from "@/components/gdpr/CookieConsent";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "BonnyTone Radio — Miami Club & House Music Internet Radio",
  description:
    "Stream Miami's club music internet radio 24/7 — house, deep house, tech house, breaks, progressive & electronic music. Tune in to BonnyTone Radio for the perfect vibe.",
  keywords: [
    "miami club music radio",
    "club music internet radio",
    "deep house internet radio",
    "house internet radio",
    "tech house radio",
    "progressive house radio",
    "electronic music radio",
    "online radio miami",
    "deep house streaming",
    "house music 24/7",
    "BonnyTone Radio",
    "miami radio station",
    "club radio online",
    "breaks music radio",
  ],
  authors: [{ name: "BonnyTone Radio" }],
  creator: "BonnyTone Radio",
  publisher: "BonnyTone Radio",
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large" as const,
    "max-video-preview": -1,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    siteName: "BonnyTone Radio",
    title: "BonnyTone Radio — Miami Club & House Music Internet Radio",
    description:
      "Stream Miami's club music internet radio 24/7 — house, deep house, tech house, breaks, progressive & electronic music. Tune in for the perfect vibe.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BonnyTone Radio — Miami Club & House Music Internet Radio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BonnyTone Radio — Miami Club & House Music Internet Radio",
    description:
      "Stream Miami's club music internet radio 24/7 — house, deep house, tech house, breaks & progressive electronic music.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
  other: {
    "geo.region": "US-FL",
    "geo.placename": "Miami, Florida",
    "geo.position": "25.7617;-80.1918",
    ICBM: "25.7617, -80.1918",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <AuthProvider>
            <PlayerProvider>
              <main id="main-content" className="pb-16">{children}</main>
              <PersistentBottomBar />
              <CookieConsent />
            </PlayerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
