import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavTabs } from "@/components/NavTabs";
import { IdentityBar } from "@/components/IdentityBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "チームタスク",
  description: "Inbox・ボード・プランナーでタスク整理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="text-base font-bold">📋 チームタスク</span>
              <NavTabs />
            </div>
            <IdentityBar />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5">
          {children}
        </main>
      </body>
    </html>
  );
}
