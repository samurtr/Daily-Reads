import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import ApiKeyPrompt from "@/components/ApiKeyPrompt";
import AppearanceSync from "@/components/AppearanceSync";
import AppGate from "@/components/AppGate";
import ServiceWorker from "@/components/ServiceWorker";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "Daily Reads",
  title: "Daily Reads",
  description: "Five fresh article ideas a day, written for you when you tap one.",
  appleWebApp: {
    capable: true,
    title: "Daily Reads",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={serif.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
      </head>
      <body>
        <ServiceWorker />
        <AppearanceSync />
        <AppGate>{children}</AppGate>
        <ApiKeyPrompt />
      </body>
    </html>
  );
}
