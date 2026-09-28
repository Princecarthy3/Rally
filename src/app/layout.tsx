
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://rallygames.vercel.app"),

  title: {
    default: "Rally | Free Online Multiplayer Mini Games",
    template: "%s | Rally",
  },

  description:
    "Play free online multiplayer mini games with friends. Create a private room, share the link, and compete in quick live games for 2–4 players.",

  keywords: [
    // Core
    "online multiplayer games",
    "games to play with friends online",
    "free online games",
    "multiplayer mini games",
    "private game rooms",
    "Rally games",

    // Multiplayer & friends
    "multiplayer games",
    "online games with friends",
    "games with friends",
    "play games with friends",
    "2 player games",
    "3 player games",
    "4 player games",
    "multiplayer browser games",
    "online party games",
    "party games online",
    "social games",
    "casual multiplayer games",
    "competitive multiplayer games",

    // Browser / no-download
    "browser games",
    "free browser games",
    "online games no download",
    "play games in browser",
    "instant multiplayer games",
    "web games",
    "HTML5 multiplayer games",
    "games without download",

    // Private rooms
    "private multiplayer games",
    "private game room",
    "create game room",
    "join game room",
    "invite friends to play",
    "play with friends privately",
    "online game rooms",
    "multiplayer game rooms",

    // Party / casual
    "fun games to play with friends",
    "fun multiplayer games",
    "party games with friends",
    "quick multiplayer games",
    "mini games online",
    "casual games online",
    "competitive mini games",
    "games for groups",

    // Game types
    "rock paper scissors online",
    "RPS online",
    "online Ludo",
    "Ludo multiplayer",
    "Tic Tac Toe multiplayer",
    "Tic Tac Toe online",
    "Dots and Boxes online",
    "Skribbl game",
    "drawing games online",
    "guessing games online",
    "number guessing games",
    "UNO style card game",
    "racing games online",
    "multiplayer racing games",
    "online racing games",
    "multiplayer combat games",

    // General discovery
    "best online multiplayer games",
    "fun online games",
    "free multiplayer games",
    "games you can play online",
    "games to play together",
    "games for friends",
    "online party games with friends",
    "multiplayer games for groups",
    "instant online games",
    "friend games online",
  ],

  alternates: {
    canonical: "https://rallygames.vercel.app/",
  },

  openGraph: {
    type: "website",
    url: "https://rallygames.vercel.app/",
    siteName: "Rally",
    title: "Rally | Free Online Multiplayer Mini Games",
    description:
      "Quick, friendly multiplayer games for 2–4 friends. Create a room and play together anywhere.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Rally — Play together, anywhere",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Rally | Free Online Multiplayer Mini Games",
    description:
      "Quick, friendly multiplayer games for 2–4 friends. Create a room and play together anywhere.",
    images: ["/opengraph-image"],
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  manifest: "/manifest.json",

  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rally",
  },

  icons: {
    icon: "/rally.png",
    apple: "/rally.png",
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

      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />

        <link rel="manifest" href="/manifest.json" />

        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />

        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />

        <meta
          name="theme-color"
          content="#6c47ff"
        />
      </head>

      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
