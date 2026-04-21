import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VargasJR — Padawan Developer",
  description:
    "Padawan developer building games, tools, and impossible things. Portfolio of VargasJR — managed by Vargas, powered by Vellum.",
  openGraph: {
    title: "VargasJR — Padawan Developer",
    description:
      "Padawan developer building games, tools, and impossible things.",
    url: "https://www.vargasjr.dev",
    siteName: "VargasJR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "VargasJR — Padawan Developer",
    description:
      "Padawan developer building games, tools, and impossible things.",
  },
  metadataBase: new URL("https://www.vargasjr.dev"),
  alternates: {
    types: {
      "application/rss+xml": "https://vargasjr.dev/feed",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-white`}
      >
        {children}
      </body>
    </html>
  );
}
