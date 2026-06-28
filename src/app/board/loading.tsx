export default function BoardLoading() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-100 p-2"
        >
          <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="mt-2 h-3 w-16 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
