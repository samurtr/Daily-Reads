import type { Metadata, Viewport } from "next";
import { Newsreader } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import AppearanceSync from "@/components/AppearanceSync";
import AppGate from "@/components/AppGate";
import PasscodePrompt from "@/components/PasscodePrompt";
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
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          reloadOnOnline={false}
        >
          <AppearanceSync />
          <AppGate>{children}</AppGate>
          <PasscodePrompt />
        </SerwistProvider>
      </body>
    </html>
  );
}
