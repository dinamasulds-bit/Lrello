import { and, eq, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks, users, columns } from "@/lib/schema";
import { pushText } from "@/lib/line";

export async function runDueNotifications(now = new Date()) {
  const dueTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      columnId: tasks.columnId,
      lineUserId: users.lineUserId,
      columnIsDone: columns.isDone,
    })
    .from(tasks)
    .innerJoin(users, eq(tasks.assigneeId, users.id))
    .leftJoin(columns, eq(tasks.columnId, columns.id))
    .where(
      and(
        lte(tasks.dueAt, now),
        eq(tasks.notified, false),
        isNotNull(users.lineUserId),
      ),
    );

  const sent: string[] = [];
  for (const t of dueTasks) {
    if (t.columnIsDone) continue;
    const to = t.lineUserId;
    if (!to) continue;

    const when = t.dueAt!.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const res = await pushText(to, `⏰ 期限になりました\n「${t.title}」\n期限: ${when}`);
    if (res.ok) {
      await db.update(tasks).set({ notified: true }).where(eq(tasks.id, t.id));
      sent.push(t.id);
    }
  }
  return { checked: dueTasks.length, sent };
}
