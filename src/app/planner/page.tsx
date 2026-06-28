import { and, eq, isNotNull, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, columns } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { PlannerBoard } from "@/components/PlannerBoard";

export const runtime = "edge";
export const dynamic = "force-dynamic";

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

  const doneCols = await db
    .select({ id: columns.id })
    .from(columns)
    .where(eq(columns.isDone, true));
  const doneIds = new Set(doneCols.map((c) => c.id));

  const rows = await db
    .select({ id: tasks.id, title: tasks.title, columnId: tasks.columnId, plannedFor: tasks.plannedFor })
    .from(tasks)
    .where(and(eq(tasks.assigneeId, me.id), isNotNull(tasks.columnId)))
    .orderBy(asc(tasks.createdAt));

  const taskList = rows.map((t) => ({
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
      <PlannerBoard days={days} tasks={taskList} />
    </div>
  );
}
