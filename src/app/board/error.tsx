"use client";

export default function BoardError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-semibold">ボードの読み込みに失敗しました</p>
      <p className="mt-1 font-mono text-xs">{error.message}</p>
      {error.digest && <p className="mt-1 text-xs text-red-400">digest: {error.digest}</p>}
    </div>
  );
}
