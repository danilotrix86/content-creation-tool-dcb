import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Creator | AI-Powered Article Generator",
  description:
    "Generate SEO-optimized articles with competitor research, outlines, and AI-powered content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans bg-[#f8f9fa]">
        {children}
      </body>
    </html>
  );
}
