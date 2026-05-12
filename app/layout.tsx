import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaInstallGate from "./pwa-install-gate";

export const metadata: Metadata = {
  title: "Pirogram",
  description: "Dark gold mobile-first messenger with chats, media, calls, read receipts and PWA support.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pirogram"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon-192.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#facc15",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body><PwaInstallGate>{children}</PwaInstallGate></body>
    </html>
  );
}
