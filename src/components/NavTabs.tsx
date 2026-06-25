"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "📥 Inbox" },
  { href: "/board", label: "🗂 ボード" },
  { href: "/myview", label: "🙋 マイビュー" },
  { href: "/planner", label: "🗓 プランナー" },
  { href: "/team", label: "👥 チーム" },
  { href: "/settings", label: "⚙" },
];

export function NavTabs() {
  const path = usePathname();
  return (
    <nav className="flex gap-1">
      {TABS.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
