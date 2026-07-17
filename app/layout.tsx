import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Mitr, Sarabun } from "next/font/google";

import "./globals.css";
import { GlobalScrollControls } from "./scroll-controls";

const sarabun = Sarabun({
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap"
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans-thai",
  display: "swap"
});

const mitr = Mitr({
  subsets: ["latin", "thai"],
  weight: ["500", "600"],
  variable: "--font-mitr",
  display: "swap"
});

export const metadata: Metadata = {
  title: "PCON Project Control",
  description: "Local-first construction project control, BOQ, and daily report app."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#eef2ec",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} ${ibmPlexSansThai.variable} ${mitr.variable}`}>
        {children}
        <GlobalScrollControls />
      </body>
    </html>
  );
}
