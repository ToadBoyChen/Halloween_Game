import type { Metadata, Viewport } from "next";
import { Creepster, Crimson_Text, Nunito } from "next/font/google";
import "./globals.css";

const creepster = Creepster({ variable: "--font-creep", weight: "400", subsets: ["latin"] });
// Nunito keeps buttons and instructions easy to read for kids; Crimson is for spooky flavor lines.
const nunito = Nunito({ variable: "--font-body", weight: ["400", "600", "800"], subsets: ["latin"] });
const crimson = Crimson_Text({ variable: "--font-flavor", weight: ["400"], style: ["italic"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POSSESSED",
  description: "One among you is no longer… themselves.",
};

export const viewport: Viewport = {
  themeColor: "#050203",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${creepster.variable} ${nunito.variable} ${crimson.variable}`}>
      <body>{children}</body>
    </html>
  );
}
