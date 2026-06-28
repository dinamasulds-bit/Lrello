import Link from "next/link";
import { and, eq, inArray, asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, columns } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { getAccessibleTeams } from "@/lib/teams";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function MyViewPage() {
  const me = await getCurrentUser();
  if (!me) return <p className="text-slate-500">サインインしてください。</p>;

  const accessibleTeams = await getAccessibleTeams(me.id);
  const accessibleTeamIds = accessibleTeams.map((t) => t.id);

  const accessibleColumns = accessibleTeamIds.length
    ? await db
        .select({ id: columns.id, isDone: columns.isDone, teamId: columns.teamId, name: columns.name })
        .from(columns)
        .where(inArray(columns.teamId, accessibleTeamIds))
    : [];

  const openColIds = accessibleColumns.filter((c) => !c.isDone).map((c) => c.id);
  const doneColIds = accessibleColumns.filter((c) => c.isDone).map((c) => c.id);
  const colMap = new Map(accessibleColumns.map((c) => [c.id, c]));

  const [openTasks, doneTasks] = await Promise.all([
    openColIds.length
      ? db
          .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, columnId: tasks.columnId })
          .from(tasks)
          .where(and(eq(tasks.assigneeId, me.id), inArray(tasks.columnId, openColIds)))
          .orderBy(asc(tasks.dueAt), asc(tasks.createdAt))
      : Promise.resolve([]),
    doneColIds.length
      ? db
          .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, columnId: tasks.columnId })
          .from(tasks)
          .where(and(eq(tasks.assigneeId, me.id), inArray(tasks.columnId, doneColIds)))
          .orderBy(desc(tasks.updatedAt))
          .limit(20)
      : Promise.resolve([]),
  ]);

  const teamMap = new Map(accessibleTeams.map((t) => [t.id, t.name]));
  const now = Date.now();

  function taskCard(
    t: { id: string; title: string; dueAt: Date | null; columnId: string | null },
    done: boolean,
  ) {
    const overdue = !done && !!t.dueAt && t.dueAt.getTime() < now;
    const col = t.columnId ? colMap.get(t.columnId) : null;
    const teamName = col?.teamId ? teamMap.get(col.teamId) : null;
    return (
      <Link
        key={t.id}
        href={`/card/${t.id}`}
        className={`flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-[#1D9E75]/50 ${done ? "opacity-60" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${done ? "line-through text-slate-400" : ""}`}>
            {t.title}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {teamName && (
              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5">{teamName}</span>
            )}
            {col?.name}
          </p>
        </div>
        {t.dueAt && (
          <span
            className={`shrink-0 text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-400"}`}
          >
            {overdue ? "⚠ " : ""}
            {t.dueAt.toLocaleString("ja-JP", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="mb-1 text-xl font-bold">🙋 マイビュー — {me.name}</h2>
      <p className="mb-4 text-sm text-slate-500">アクセス可能な全チームの自分担当タスク</p>

      <h3 className="mb-2 text-sm font-semibold text-slate-600">進行中 ({openTasks.length})</h3>
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
          <h3 className="mb-2 text-sm font-semibold text-slate-500">完了済み（直近20件）</h3>
          <div className="flex flex-col gap-2">{doneTasks.map((t) => taskCard(t, true))}</div>
        </>
      )}
    </div>
  );
}
