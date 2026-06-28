import { redirect } from "next/navigation";
import { eq, asc, inArray, count } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, comments, checklistItems } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { getAccessibleTeams, getCachedColumns } from "@/lib/teams";
import { BoardView, type Card } from "@/components/BoardView";
import { TeamTabs } from "@/components/TeamTabs";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function dueLabel(d: Date) {
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function BoardPage({
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
    (params.team ? teams.find((t) => t.slug === params.team) : null) ??
    teams[0];

  if (!params.team || !teams.find((t) => t.slug === params.team)) {
    redirect(`/board?team=${team.slug}`);
  }

  const columns = await getCachedColumns(team.id);
  const columnIds = columns.map((c) => c.id);

  if (!columnIds.length) {
    return (
      <div>
        <TeamTabs teams={teams} currentSlug={team.slug} base="/board" />
        <h2 className="mb-4 text-xl font-bold">🗂 {team.name} ボード</h2>
        <BoardView columns={columns} cards={[]} meId={me.id} teamId={team.id} />
      </div>
    );
  }

  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      columnId: tasks.columnId,
      dueAt: tasks.dueAt,
    })
    .from(tasks)
    .where(inArray(tasks.columnId, columnIds))
    .orderBy(asc(tasks.order));

  const taskIds = rows.map((r) => r.id);

  const [commentCounts, checklistRows] = await Promise.all([
    taskIds.length
      ? db
          .select({ taskId: comments.taskId, cnt: count(comments.id) })
          .from(comments)
          .where(inArray(comments.taskId, taskIds))
          .groupBy(comments.taskId)
      : Promise.resolve([]),
    taskIds.length
      ? db
          .select({ taskId: checklistItems.taskId, done: checklistItems.done })
          .from(checklistItems)
          .where(inArray(checklistItems.taskId, taskIds))
      : Promise.resolve([]),
  ]);

  const commentMap = new Map(commentCounts.map((c) => [c.taskId, c.cnt]));
  const checkMap = new Map<string, { total: number; done: number }>();
  for (const ci of checklistRows) {
    const entry = checkMap.get(ci.taskId!) ?? { total: 0, done: 0 };
    entry.total++;
    if (ci.done) entry.done++;
    checkMap.set(ci.taskId!, entry);
  }

  const doneColIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id));
  const now = Date.now();

  const cards: Card[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    columnId: t.columnId!,
    dueLabel: t.dueAt ? dueLabel(t.dueAt) : null,
    overdue: !!t.dueAt && !doneColIds.has(t.columnId!) && t.dueAt.getTime() < now,
    comments: commentMap.get(t.id) ?? 0,
    checkTotal: checkMap.get(t.id)?.total ?? 0,
    checkDone: checkMap.get(t.id)?.done ?? 0,
  }));

  return (
    <div>
      <TeamTabs teams={teams} currentSlug={team.slug} base="/board" />
      <h2 className="mb-4 text-xl font-bold">🗂 {team.name} ボード</h2>
      <BoardView columns={columns} cards={cards} meId={me.id} teamId={team.id} />
    </div>
  );
}
