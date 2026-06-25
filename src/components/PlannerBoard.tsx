"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { planTask } from "@/app/actions";

type Task = {
  id: string;
  title: string;
  done: boolean;
  plannedFor: string | null;
};
type Day = { iso: string; label: string; wd: string; isToday: boolean };

export function PlannerBoard({ days, tasks }: { days: Day[]; tasks: Task[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null); // drop target key

  const pool = tasks.filter((t) => !t.plannedFor);
  const byDay = (iso: string) => tasks.filter((t) => t.plannedFor === iso);

  function drop(target: string | null) {
    const id = dragId;
    setDragId(null);
    setOver(null);
    if (!id) return;
    startTransition(async () => {
      await planTask(id, target);
      router.refresh();
    });
  }

  function Card({ t }: { t: Task }) {
    return (
      <div
        draggable
        onDragStart={() => setDragId(t.id)}
        onDragEnd={() => setDragId(null)}
        className={`cursor-grab rounded-md border border-slate-200 bg-white px-2 py-1 text-sm shadow-sm active:cursor-grabbing ${
          t.done ? "text-slate-400 line-through" : ""
        }`}
      >
        <span
          className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${t.done ? "bg-emerald-400" : "bg-slate-400"}`}
        />
        {t.title}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 lg:flex-row ${pending ? "opacity-60" : ""}`}>
      {/* Pool */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          setOver("pool");
        }}
        onDrop={() => drop(null)}
        className={`w-full shrink-0 rounded-xl border p-2 lg:w-56 ${
          over === "pool" ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white"
        }`}
      >
        <h3 className="mb-2 px-1 text-sm font-semibold text-slate-600">
          未予定 ({pool.length})
        </h3>
        <div className="flex flex-col gap-2">
          {pool.length === 0 && (
            <p className="px-1 py-2 text-xs text-slate-400">なし</p>
          )}
          {pool.map((t) => (
            <Card key={t.id} t={t} />
          ))}
        </div>
      </section>

      {/* Week */}
      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => (
          <section
            key={d.iso}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(d.iso);
            }}
            onDrop={() => drop(d.iso)}
            className={`flex min-h-[120px] flex-col rounded-xl border p-1.5 ${
              over === d.iso
                ? "border-blue-400 bg-blue-50"
                : d.isToday
                  ? "border-blue-200 bg-blue-50/40"
                  : "border-slate-200 bg-white"
            }`}
          >
            <div className="mb-1 px-1 text-xs font-semibold text-slate-500">
              {d.label}（{d.wd}）{d.isToday && " ·今日"}
            </div>
            <div className="flex flex-col gap-1.5">
              {byDay(d.iso).map((t) => (
                <Card key={t.id} t={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
