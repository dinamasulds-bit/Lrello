"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, useState, useRef } from "react";
import {
  moveTask,
  createTask,
  createColumn,
  renameColumn,
  deleteColumn,
  moveColumn,
} from "@/app/actions";

export type Col = { id: string; name: string; isDone: boolean };
export type Card = {
  id: string;
  title: string;
  columnId: string;
  dueLabel: string | null;
  overdue: boolean;
  comments: number;
  checkDone: number;
  checkTotal: number;
};

type OptAction =
  | { type: "move"; id: string; columnId: string }
  | { type: "add"; card: Card };

function optimisticReducer(state: Card[], action: OptAction): Card[] {
  if (action.type === "move") {
    return state.map((c) => (c.id === action.id ? { ...c, columnId: action.columnId } : c));
  }
  if (action.type === "add") {
    return [...state, action.card];
  }
  return state;
}

export function BoardView({
  columns,
  cards,
  meId,
  teamId,
}: {
  columns: Col[];
  cards: Card[];
  meId: string;
  teamId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const [optimisticCards, dispatch] = useOptimistic(cards, optimisticReducer);

  // --- DnD ---
  function drop(columnId: string) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id || optimisticCards.find((c) => c.id === id)?.columnId === columnId) return;
    startTransition(async () => {
      dispatch({ type: "move", id, columnId });
      await moveTask(id, columnId);
      router.refresh();
    });
  }

  // --- Quick card add ---
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleAddCard(col: Col) {
    const input = inputRefs.current[col.id];
    const title = input?.value.trim();
    if (!title || !input) return;
    input.value = "";

    const tempId = `tmp-${Date.now()}`;
    startTransition(async () => {
      dispatch({
        type: "add",
        card: {
          id: tempId,
          title,
          columnId: col.id,
          dueLabel: null,
          overdue: false,
          comments: 0,
          checkDone: 0,
          checkTotal: 0,
        },
      });
      const fd = new FormData();
      fd.set("title", title);
      fd.set("columnId", col.id);
      fd.set("assigneeId", meId);
      await createTask(fd);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
      {columns.map((col, idx) => {
        const items = optimisticCards.filter((c) => c.columnId === col.id);
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.id);
            }}
            onDrop={() => drop(col.id)}
            onDragLeave={() => setOver(null)}
            className={`flex w-[85vw] sm:w-72 shrink-0 flex-col rounded-xl border snap-start ${
              over === col.id
                ? "border-[#1D9E75] bg-[#E1F5EE]"
                : col.isDone
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-slate-100"
            }`}
          >
            {/* Column header */}
            <div className="flex items-center justify-between gap-1 px-2 py-2">
              <form action={renameColumn} className="flex min-w-0 flex-1 items-center">
                <input type="hidden" name="id" value={col.id} />
                <input
                  name="name"
                  defaultValue={col.name}
                  className="w-full bg-transparent text-sm font-semibold outline-none focus:rounded focus:bg-white focus:px-1"
                />
              </form>
              <span className="rounded-full bg-white/70 px-1.5 text-xs text-slate-500">
                {items.length}
              </span>
              <div className="flex items-center text-xs text-slate-400">
                <form action={moveColumn}>
                  <input type="hidden" name="id" value={col.id} />
                  <input type="hidden" name="dir" value="left" />
                  <input type="hidden" name="teamId" value={teamId} />
                  <button disabled={idx === 0} className="px-0.5 disabled:opacity-30">
                    ◀
                  </button>
                </form>
                <form action={moveColumn}>
                  <input type="hidden" name="id" value={col.id} />
                  <input type="hidden" name="dir" value="right" />
                  <input type="hidden" name="teamId" value={teamId} />
                  <button
                    disabled={idx === columns.length - 1}
                    className="px-0.5 disabled:opacity-30"
                  >
                    ▶
                  </button>
                </form>
                <form action={deleteColumn}>
                  <input type="hidden" name="id" value={col.id} />
                  <button className="px-0.5 hover:text-red-500" title="列削除（カードはInboxへ）">
                    🗑
                  </button>
                </form>
              </div>
            </div>

            {/* Cards */}
            <div className="flex min-h-[40px] flex-col gap-2 px-2">
              {items.map((c) => {
                const isTemp = c.id.startsWith("tmp-");
                return (
                  <div
                    key={c.id}
                    draggable={!isTemp}
                    onDragStart={() => !isTemp && setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`rounded-lg border border-slate-200 bg-white p-2 shadow-sm ${
                      isTemp ? "opacity-60" : "cursor-grab active:cursor-grabbing"
                    }`}
                  >
                    <Link
                      href={isTemp ? "#" : `/card/${c.id}`}
                      className={`block text-sm hover:underline ${
                        col.isDone ? "text-slate-400 line-through" : ""
                      }`}
                    >
                      {c.title}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      {c.dueLabel && (
                        <span className={c.overdue ? "font-semibold text-red-600" : ""}>
                          {c.overdue ? "⚠ " : "🕒 "}
                          {c.dueLabel}
                        </span>
                      )}
                      {c.checkTotal > 0 && (
                        <span>☑ {c.checkDone}/{c.checkTotal}</span>
                      )}
                      {c.comments > 0 && <span>💬 {c.comments}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick add */}
            <div className="p-2">
              <input
                ref={(el) => { inputRefs.current[col.id] = el; }}
                placeholder="＋ カード追加"
                className="w-full rounded-md border border-transparent bg-white/60 px-2 py-1 text-sm placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-300 focus:bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCard(col);
                  }
                }}
              />
            </div>
          </section>
        );
      })}

      {/* Add new column */}
      <form
        action={createColumn}
        className="flex h-fit w-56 shrink-0 snap-start items-center gap-1 rounded-xl border border-dashed border-slate-300 p-2"
      >
        <input type="hidden" name="teamId" value={teamId} />
        <input
          name="name"
          placeholder="＋ 列を追加"
          className="w-full bg-transparent px-1 py-1 text-sm outline-none"
        />
        <button className="rounded-md bg-slate-800 px-2 py-1 text-xs text-white">
          追加
        </button>
      </form>
    </div>
  );
}
