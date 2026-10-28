import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PNG RTA Motor Vehicle Registration & Payment System",
    template: "%s · PNG RTA Motor Vehicle Registration",
  },
  description: "Road Traffic Authority — Papua New Guinea · Motor Vehicle Registration & Payment System (demo prototype).",
  icons: { icon: "/brand/rta-logo.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0b0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Inter + JetBrains Mono from the design; falls back to system fonts when offline. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SessionProvider>{children}</SessionProvider>
        <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: "Inter, system-ui, sans-serif" } }} />
      </body>
    </html>
  );
}
