import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getAccessibleTeams } from "@/lib/teams";

export const dynamic = "force-dynamic";

export default async function MyViewPage() {
  const me = await getCurrentUser();
  if (!me) return <p className="text-slate-500">サインインしてください。</p>;

  const accessibleTeams = await getAccessibleTeams(me.id);
  const accessibleTeamIds = accessibleTeams.map((t) => t.id);

  // All tasks assigned to me across accessible teams
  const [openTasks, doneTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        assigneeId: me.id,
        column: {
          isDone: false,
          ...(accessibleTeamIds.length > 0
            ? { teamId: { in: accessibleTeamIds } }
            : {}),
        },
        columnId: { not: null },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        dueAt: true,
        column: { select: { name: true, teamId: true } },
      },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: me.id,
        column: {
          isDone: true,
          ...(accessibleTeamIds.length > 0
            ? { teamId: { in: accessibleTeamIds } }
            : {}),
        },
        columnId: { not: null },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        dueAt: true,
        column: { select: { name: true, teamId: true } },
      },
    }),
  ]);

  const teamMap = new Map(accessibleTeams.map((t) => [t.id, t.name]));
  const now = Date.now();

  function taskCard(
    t: { id: string; title: string; dueAt: Date | null; column: { name: string; teamId: string | null } | null },
    done: boolean,
  ) {
    const overdue = !done && !!t.dueAt && t.dueAt.getTime() < now;
    const teamName = t.column?.teamId ? teamMap.get(t.column.teamId) : null;
    return (
      <Link
        key={t.id}
        href={`/card/${t.id}`}
        className={`flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-blue-300 ${done ? "opacity-60" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${done ? "line-through text-slate-400" : ""}`}>
            {t.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {teamName && <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5">{teamName}</span>}
            {t.column?.name}
          </p>
        </div>
        {t.dueAt && (
          <span className={`shrink-0 text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-400"}`}>
            {overdue ? "⚠ " : ""}
            {t.dueAt.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-xl font-bold">🙋 マイビュー — {me.name}</h2>
      <p className="mb-4 text-sm text-slate-500">
        アクセス可能な全チームの自分担当タスク
      </p>

      <h3 className="mb-2 text-sm font-semibold text-slate-600">
        進行中 ({openTasks.length})
      </h3>
      <div className="mb-6 flex flex-col gap-2">
        {openTasks.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
            担当タスクなし 🎉
          </p>
        )}
        {openTasks.map((t) => taskCard(t, false))}
      </div>

      {doneTasks.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-semibold text-slate-500">
            完了済み（直近20件）
          </h3>
          <div className="flex flex-col gap-2">
            {doneTasks.map((t) => taskCard(t, true))}
          </div>
        </>
      )}
    </div>
  );
}
