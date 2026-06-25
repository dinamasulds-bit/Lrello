import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getAccessibleTeams } from "@/lib/teams";
import { BoardView, type Card } from "@/components/BoardView";
import { TeamTabs } from "@/components/TeamTabs";

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

  const columns = await prisma.column.findMany({
    where: { teamId: team.id },
    orderBy: { order: "asc" },
    select: { id: true, name: true, isDone: true, order: true },
  });

  const columnIds = columns.map((c) => c.id);

  const rows = columnIds.length
    ? await prisma.task.findMany({
        where: { columnId: { in: columnIds } },
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          columnId: true,
          dueAt: true,
          _count: { select: { comments: true } },
          checklist: { select: { done: true } },
        },
      })
    : [];

  const doneColIds = new Set(columns.filter((c) => c.isDone).map((c) => c.id));
  const now = Date.now();

  const cards: Card[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    columnId: t.columnId!,
    dueLabel: t.dueAt ? dueLabel(t.dueAt) : null,
    overdue: !!t.dueAt && !doneColIds.has(t.columnId!) && t.dueAt.getTime() < now,
    comments: t._count.comments,
    checkTotal: t.checklist.length,
    checkDone: t.checklist.filter((c) => c.done).length,
  }));

  return (
    <div>
      <TeamTabs teams={teams} currentSlug={team.slug} base="/board" />
      <h2 className="mb-4 text-xl font-bold">🗂 {team.name} ボード</h2>
      <BoardView columns={columns} cards={cards} meId={me.id} teamId={team.id} />
    </div>
  );
}
