export default function Loading() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3"
        >
          <div className="h-5 w-20 animate-pulse rounded bg-slate-200" />
          {[1, 2].map((j) => (
            <div key={j} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
