"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",        icon: "📥", label: "Inbox" },
  { href: "/board",   icon: "🗂",  label: "ボード" },
  { href: "/myview",  icon: "🙋", label: "マイビュー" },
  { href: "/planner", icon: "🗓", label: "プランナー" },
  { href: "/team",    icon: "👥", label: "チーム" },
  { href: "/settings",icon: "⚙",  label: "設定" },
];

export function NavTabs() {
  const path = usePathname();

  return (
    <>
      {/* Desktop: top horizontal nav */}
      <nav className="hidden md:flex gap-1">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-[#1D9E75] text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.icon} {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: fixed bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex">
          {TABS.map((t) => {
            const active = path === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition ${
                  active ? "text-[#1D9E75]" : "text-slate-400"
                }`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
