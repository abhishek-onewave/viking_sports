import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viking Sports | AI-Powered Collectibles Intelligence",
  description:
    "Machine learning predictions for sports memorabilia investments. Powered by XGBoost analysis of historical collectible deal data.",
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
