import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rallygames.vercel.app"),
  title: { default: "Rally | Free Online Multiplayer Mini Games", template: "%s | Rally" },
  description: "Play free online multiplayer mini games with friends. Create a private room, share the link, and compete in quick live games for 2–4 players.",
  keywords: [
    "online multiplayer games",
    "games to play with friends online",
    "free online games",
    "multiplayer mini games",
    "private game rooms",
    "Rally games",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Rally",
    title: "Rally | Free Online Multiplayer Mini Games",
    description: "Quick, friendly multiplayer games for 2–4 friends. Create a room and play together anywhere.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Rally — Play together, anywhere" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rally | Free Online Multiplayer Mini Games",
    description: "Quick, friendly multiplayer games for 2–4 friends. Create a room and play together anywhere.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rally",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6c47ff",
};

const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('rally_theme') || 'vibrant';
      document.documentElement.setAttribute('data-theme', t);
      if (t === 'dark') document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#6c47ff" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
