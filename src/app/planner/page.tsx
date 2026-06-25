import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { PlannerBoard } from "@/components/PlannerBoard";

export const dynamic = "force-dynamic";

// Local YYYY-MM-DD (avoids UTC shift from toISOString).
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const WD = ["日", "月", "火", "水", "木", "金", "土"];

export default async function PlannerPage() {
  const me = await getCurrentUser();
  if (!me) return <p className="text-slate-500">右上で名前を入れて始めてください。</p>;

  // Build the 7 days starting today.
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      iso: ymd(d),
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      wd: WD[d.getDay()],
      isToday: i === 0,
    };
  });

  const doneCols = await prisma.column.findMany({
    where: { isDone: true },
    select: { id: true },
  });
  const doneIds = new Set(doneCols.map((c) => c.id));

  const rows = await prisma.task.findMany({
    where: { assigneeId: me.id, columnId: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  const tasks = rows.map((t) => ({
    id: t.id,
    title: t.title,
    done: doneIds.has(t.columnId!),
    plannedFor: t.plannedFor ? ymd(t.plannedFor) : null,
  }));

  return (
    <div>
      <h2 className="mb-1 text-xl font-bold">🗓 プランナー — {me.name}</h2>
      <p className="mb-4 text-sm text-slate-500">
        左の未予定タスクを、やる日にドラッグ＆ドロップ。
      </p>
      <PlannerBoard days={days} tasks={tasks} />
    </div>
  );
}
