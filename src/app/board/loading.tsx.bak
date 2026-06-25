export default function Loading() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-100 p-3"
        >
          <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-14 animate-pulse rounded-lg bg-white" />
          ))}
        </div>
      ))}
    </div>
  );
}
