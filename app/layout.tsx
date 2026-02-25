import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthContext";
import ThemeProvider from "@/components/layout/ThemeProvider/ThemeProvider";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import PersistentBottomBar from "@/components/player/PersistentBottomBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://bonnytone.com"),
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
    url: "https://bonnytone.com",
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
    canonical: "https://bonnytone.com",
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
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <PlayerProvider>
              <main className="pb-16">{children}</main>
              <PersistentBottomBar />
            </PlayerProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
