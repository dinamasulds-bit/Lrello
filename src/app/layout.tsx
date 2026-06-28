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
  title: "Lrello",
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
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#1D9E75]" />
                <span className="text-base font-semibold tracking-tight">Lrello</span>
              </div>
              <NavTabs />
            </div>
            <IdentityBar />
          </div>
        </header>
        {/* pb-20 on mobile to clear the bottom nav bar */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 md:pb-5">
          {children}
        </main>
      </body>
    </html>
  );
}
