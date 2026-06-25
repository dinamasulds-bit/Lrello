import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  updateTask,
  deleteTaskAndGoBoard,
  addComment,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  addAttachment,
  deleteAttachment,
} from "@/app/actions";

export const dynamic = "force-dynamic";

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(d: Date | null) {
  if (!d) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      column: true,
      assignee: true,
      checklist: { orderBy: { order: "asc" } },
      attachments: true,
      comments: {
        orderBy: { createdAt: "desc" },
        include: { author: true },
      },
    },
  });
  if (!task) notFound();

  const checkTotal = task.checklist.length;
  const checkDone = task.checklist.filter((c) => c.done).length;
  const pct = checkTotal ? Math.round((checkDone / checkTotal) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/board" className="text-sm text-slate-500 hover:underline">
        ← 戻る
      </Link>

      <div className="mt-2 mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-0.5">
          {task.column ? task.column.name : "📥 Inbox"}
        </span>
        {task.assignee && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            担当: {task.assignee.name}
          </span>
        )}
      </div>

      {/* Title / description / due */}
      <form action={updateTask} className="rounded-xl border border-slate-200 bg-white p-4">
        <input type="hidden" name="id" value={task.id} />
        <input
          name="title"
          defaultValue={task.title}
          className="w-full border-b border-transparent text-lg font-bold outline-none focus:border-slate-300"
        />
        <textarea
          name="description"
          defaultValue={task.description ?? ""}
          placeholder="詳細・メモ…"
          rows={3}
          className="mt-3 w-full resize-y rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-slate-300"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-500">期限</label>
          <input
            type="datetime-local"
            name="dueAt"
            defaultValue={toLocalInput(task.dueAt)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
          />
          <button className="ml-auto rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white">
            保存
          </button>
        </div>
      </form>

      {/* Checklist */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">☑ チェックリスト</h3>
          <span className="text-xs text-slate-400">
            {checkDone}/{checkTotal}
          </span>
        </div>
        {checkTotal > 0 && (
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
          </div>
        )}
        <div className="flex flex-col gap-1">
          {task.checklist.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <form action={toggleChecklistItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="taskId" value={task.id} />
                <button
                  className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                    item.done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300"
                  }`}
                >
                  {item.done ? "✓" : ""}
                </button>
              </form>
              <span
                className={`flex-1 text-sm ${item.done ? "text-slate-400 line-through" : ""}`}
              >
                {item.text}
              </span>
              <form action={deleteChecklistItem}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="taskId" value={task.id} />
                <button className="text-slate-300 hover:text-red-500">✕</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addChecklistItem} className="mt-2 flex gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <input
            name="text"
            placeholder="項目を追加…"
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <button className="rounded-md border border-slate-300 px-3 py-1 text-sm">
            追加
          </button>
        </form>
      </section>

      {/* Attachments / links */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 font-semibold">🔗 リンク・画像</h3>
        <div className="flex flex-col gap-2">
          {task.attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              {a.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.url}
                  alt={a.label ?? ""}
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                <span>🔗</span>
              )}
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-blue-600 hover:underline"
              >
                {a.label || a.url}
              </a>
              <form action={deleteAttachment}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="taskId" value={task.id} />
                <button className="text-slate-300 hover:text-red-500">✕</button>
              </form>
            </div>
          ))}
        </div>
        <form action={addAttachment} className="mt-2 flex flex-wrap gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <select name="kind" className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            <option value="link">リンク</option>
            <option value="image">画像URL</option>
          </select>
          <input
            name="url"
            placeholder="https://…"
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <input
            name="label"
            placeholder="ラベル（任意）"
            className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <button className="rounded-md border border-slate-300 px-3 py-1 text-sm">
            追加
          </button>
        </form>
        <p className="mt-1 text-xs text-slate-400">
          ※ファイルアップロードは公開版で対応予定（要ストレージ）。今はURLで。
        </p>
      </section>

      {/* Comments */}
      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 font-semibold">💬 コメント</h3>
        <form action={addComment} className="mb-3 flex gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <input
            name="body"
            placeholder="コメントを追加…"
            className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
          <button className="rounded-md bg-slate-800 px-3 py-1 text-sm text-white">
            投稿
          </button>
        </form>
        <div className="flex flex-col gap-3">
          {task.comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-semibold">{c.author?.name ?? "誰か"}</span>{" "}
              <span className="text-xs text-slate-400">
                {c.createdAt.toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Danger */}
      <form action={deleteTaskAndGoBoard} className="mt-6">
        <input type="hidden" name="id" value={task.id} />
        <button className="text-sm text-red-500 hover:underline">
          このカードを削除
        </button>
      </form>
    </div>
  );
}
