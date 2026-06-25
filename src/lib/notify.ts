import { prisma } from "@/lib/prisma";
import { pushText } from "@/lib/line";

// Find tasks whose deadline has arrived and notify the assignee on LINE.
// Idempotent: each task is notified at most once (notified flag).
export async function runDueNotifications(now = new Date()) {
  const tasks = await prisma.task.findMany({
    where: {
      dueAt: { lte: now },
      notified: false,
      assignee: { lineUserId: { not: null } },
    },
    include: { assignee: true, column: true },
  });

  const sent: string[] = [];
  for (const t of tasks) {
    if (t.column?.isDone) continue; // already completed — skip
    const to = t.assignee?.lineUserId;
    if (!to) continue;

    const when = t.dueAt!.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const res = await pushText(to, `⏰ 期限になりました\n「${t.title}」\n期限: ${when}`);
    if (res.ok) {
      await prisma.task.update({ where: { id: t.id }, data: { notified: true } });
      sent.push(t.id);
    }
  }
  return { checked: tasks.length, sent };
}
