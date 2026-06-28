import Link from "next/link";

type TeamInfo = { id: string; name: string; slug: string };

export function TeamTabs({
  teams,
  currentSlug,
  base,
}: {
  teams: TeamInfo[];
  currentSlug: string;
  base: string; // e.g. "/board" or "/team"
}) {
  if (teams.length <= 1) return null;
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {teams.map((t) => {
        const active = t.slug === currentSlug;
        return (
          <Link
            key={t.slug}
            href={`${base}?team=${t.slug}`}
            className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? "-mb-px border-[#1D9E75] text-[#1D9E75]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.name}
          </Link>
        );
      })}
    </div>
  );
}
