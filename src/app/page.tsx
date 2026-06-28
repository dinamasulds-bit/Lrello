import Link from "next/link";
import { and, isNull, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tasks } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { createTask, triageToBoard, deleteTask } from "./actions";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const me = await getCurrentUser();
  if (!me) {
    return <p className="text-slate-500">右上で名前を入れて始めてください。</p>;
  }

  const taskList = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.assigneeId, me.id), isNull(tasks.columnId)))
    .orderBy(desc(tasks.createdAt));

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">📥 Inbox</h2>
        <span className="text-sm text-slate-400">{taskList.length} 件</span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        気になったこと、どんなに小さくてもまず書き込む。あとで整理。
      </p>

      <form
        action={createTask}
        className="mb-5 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row"
      >
        <input
          name="title"
          placeholder="思いついたことを入力…"
          required
          autoFocus
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
        />
        <input
          type="datetime-local"
          name="dueAt"
          className="rounded-lg border border-slate-300 px-3 py-2"
          title="期限（任意）"
        />
        <button className="rounded-lg bg-[#1D9E75] px-5 py-2 font-semibold text-white">
          キャプチャ
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {taskList.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
            Inbox は空です 🎉
          </p>
        )}
        {taskList.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
          >
            <Link href={`/card/${t.id}`} className="min-w-0 flex-1 hover:underline">
              <p className="truncate text-sm">{t.title}</p>
              {t.dueAt && (
                <p className="text-xs text-slate-400">
                  期限{" "}
                  {t.dueAt.toLocaleString("ja-JP", {
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <form action={triageToBoard}>
                <input type="hidden" name="id" value={t.id} />
                <button className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-white">
                  ボードへ →
                </button>
              </form>
              <form action={deleteTask}>
                <input type="hidden" name="id" value={t.id} />
                <button className="px-1 text-slate-300 hover:text-red-500" title="削除">
                  ✕
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
