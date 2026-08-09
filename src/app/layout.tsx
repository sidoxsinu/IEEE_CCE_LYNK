import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "LYNK — IEEE CCE Event Networking",
  description:
    "Connect with fellow participants at the IEEE CCE event through our interactive human bingo networking game. Discover, connect, and climb the leaderboard!",
  keywords: ["IEEE", "CCE", "networking", "event", "LYNK", "human bingo"],
  openGraph: {
    title: "LYNK — IEEE CCE Event Networking",
    description: "Connect with fellow participants through interactive networking challenges.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#F7F7F2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
