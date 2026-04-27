import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";

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
  title: "皮具护理问答系统",
  description: "描述皮具问题，获取更清晰的清洁、养护与送修建议。",
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
      <body className="min-h-full bg-[color:var(--background)]">
        <div className="relative min-h-screen overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(181,122,51,0.12),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(3,105,161,0.14),_transparent_32%),linear-gradient(180deg,_rgba(250,248,243,0.94),_rgba(240,245,249,0.98))]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.54),_transparent)]" />
          <div className="relative z-10 pb-12">
            <TopNav />
            <main className="mt-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
