import type { Metadata, Viewport } from "next";
import { Creepster, Crimson_Text } from "next/font/google";
import "./globals.css";

const creepster = Creepster({ variable: "--font-creep", weight: "400", subsets: ["latin"] });
const crimson = Crimson_Text({ variable: "--font-body", weight: ["400", "600", "700"], subsets: ["latin"] });

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
    <html lang="en" className={`${creepster.variable} ${crimson.variable}`}>
      <body>{children}</body>
    </html>
  );
}
