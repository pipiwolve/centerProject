import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";

import { LocalModeBanner } from "@/components/local-mode-banner";
import { TopNav } from "@/components/top-nav";

import "./globals.css";

const headingFont = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bodyFont = Montserrat({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Leather Care RAG Assistant",
  description: "Vercel-ready frontend for a leather care RAG graduation project.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(202,138,4,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(30,58,138,0.18),_transparent_28%),linear-gradient(180deg,_rgba(248,250,252,0.92),_rgba(240,244,250,0.98))]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.56),_transparent)]" />
          <div className="relative z-10 pb-12">
            <TopNav />
            <main className="mt-6 space-y-6">
              <LocalModeBanner />
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
