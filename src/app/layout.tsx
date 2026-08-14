import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valhalla | Collectibles Market Intelligence",
  description:
    "Collectibles market intelligence built on 44,596 verified auction results, 2004-2026. Comparable sales, fair value, and a deal signal validated on 2,574 repeat sales.",
  keywords: [
    "sports memorabilia",
    "collectibles",
    "investment",
    "machine learning",
    "prediction",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-viking-deep text-viking-snow">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
