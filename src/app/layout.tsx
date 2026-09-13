import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Rally — Play together, anywhere", template: "%s · Rally" },
  description: "Quick, friendly 1-vs-1 games made for two. Invite a friend and turn any moment into game time.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f9fd" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
