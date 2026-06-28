import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, asc, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, columns, tasks, teamMemberships } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { getAccessibleTeams } from "@/lib/teams";
import { TeamTabs } from "@/components/TeamTabs";
import { createTask, deleteTask } from "../actions";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <p className="text-slate-500">サインインしてください。</p>;

  const params = await searchParams;
  const teams = await getAccessibleTeams(me.id);

  if (teams.length === 0) {
    return (
      <p className="text-slate-500">
        チームに割り当てられていません。管理者に連絡してください。
      </p>
    );
  }

  const team =
    (params.team ? teams.find((t) => t.slug === params.team) : null) ?? teams[0];

  if (!params.team || !teams.find((t) => t.slug === params.team)) {
    redirect(`/team?team=${team.slug}`);
  }

  const columnList = await db
    .select({ id: columns.id, name: columns.name, isDone: columns.isDone })
    .from(columns)
    .where(eq(columns.teamId, team.id))
    .orderBy(asc(columns.order));

  const columnIds = columnList.map((c) => c.id);
  const doneIds = new Set(columnList.filter((c) => c.isDone).map((c) => c.id));

  const memberRows = await db
    .select({ userId: teamMemberships.userId })
    .from(teamMemberships)
    .where(eq(teamMemberships.teamId, team.id));
  const memberIds = memberRows.map((m) => m.userId);

  const userList = memberIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, memberIds))
        .orderBy(asc(users.createdAt))
    : [];

  const taskRows =
    columnIds.length && memberIds.length
      ? await db
          .select({
            id: tasks.id,
            title: tasks.title,
            columnId: tasks.columnId,
            dueAt: tasks.dueAt,
            assigneeId: tasks.assigneeId,
            columnName: columns.name,
            columnIsDone: columns.isDone,
          })
          .from(tasks)
          .leftJoin(columns, eq(tasks.columnId, columns.id))
          .where(
            inArray(tasks.columnId, columnIds),
          )
          .orderBy(asc(tasks.columnId), asc(tasks.dueAt))
      : [];

  const tasksByUser = new Map<string, typeof taskRows>();
  for (const t of taskRows) {
    if (!t.assigneeId) continue;
    if (!tasksByUser.has(t.assigneeId)) tasksByUser.set(t.assigneeId, []);
    tasksByUser.get(t.assigneeId)!.push(t);
  }

  const firstCol = columnList[0];

  return (
    <div>
      <TeamTabs teams={teams} currentSlug={team.slug} base="/team" />
      <h2 className="mb-4 text-xl font-bold">👥 {team.name} — メンバー</h2>

      {me && firstCol && (
        <form
          action={createTask}
          className="mb-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="columnId" value={firstCol.id} />
          <input
            name="title"
            placeholder="タスクを誰かに割り当て…"
            required
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
          />
          <input
            type="datetime-local"
            name="dueAt"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <select
            name="assigneeId"
            defaultValue={me.id}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            {userList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-[#1D9E75] px-5 py-2 font-semibold text-white">
            追加
          </button>
        </form>
      )}

      {userList.length === 0 ? (
        <p className="text-slate-500">
          このチームにメンバーがいません。
          <Link href="/admin" className="ml-1 text-[#1D9E75] underline">
            管理者ページ
          </Link>
          で割り当ててください。
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {userList.map((u) => {
            const userTasks = tasksByUser.get(u.id) ?? [];
            const open = userTasks.filter((t) => !doneIds.has(t.columnId!)).length;
            return (
              <section
                key={u.id}
                className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="font-semibold">{u.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    残 {open}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-2">
                  {userTasks.length === 0 && (
                    <p className="px-1 py-3 text-xs text-slate-400">タスクなし</p>
                  )}
                  {userTasks.map((t) => {
                    const isDone = t.columnIsDone ?? false;
                    const overdue = t.dueAt && !isDone && t.dueAt.getTime() < Date.now();
                    return (
                      <div
                        key={t.id}
                        className={`rounded-lg border border-slate-200 p-2 ${isDone ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/card/${t.id}`}
                            className={`text-sm hover:underline ${isDone ? "line-through" : ""}`}
                          >
                            {t.title}
                          </Link>
                          <form action={deleteTask}>
                            <input type="hidden" name="id" value={t.id} />
                            <button className="text-slate-300 hover:text-red-500">✕</button>
                          </form>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                            {t.columnName}
                          </span>
                          {t.dueAt && (
                            <span
                              className={`text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-400"}`}
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
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
