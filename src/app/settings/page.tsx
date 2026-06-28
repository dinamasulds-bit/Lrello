import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { generateLineCode, unlinkLine, disconnectGoogle } from "../actions";
import { lineConfigured } from "@/lib/line";
import { googleConfigured } from "@/lib/google";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) return <p className="text-slate-500">右上で名前を入れて始めてください。</p>;

  const { google } = await searchParams;
  const [user] = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
  const linked = !!user?.lineUserId;
  const configured = lineConfigured();
  const gConfigured = googleConfigured();
  const gConnected = !!user?.googleRefreshToken;

  return (
    <div className="mx-auto max-w-xl">
      <h2 className="mb-4 text-xl font-bold">⚙ 設定 — {me.name}</h2>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold">📲 LINE 期限通知</h3>
        <p className="mt-1 text-sm text-slate-500">
          連携すると、タスクの期限になったとき LINE に通知が届きます。
        </p>

        {!configured && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ 管理者がまだ LINE チャネルを設定していません（
            <code>LINE_CHANNEL_ACCESS_TOKEN</code> 未設定）。
            設定後に下記の連携が有効になります。
          </div>
        )}

        <div className="mt-4">
          {linked ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
              <span className="text-sm text-emerald-800">✅ 連携済み</span>
              <form action={unlinkLine}>
                <button className="text-xs text-red-500 hover:underline">解除</button>
              </form>
            </div>
          ) : (
            <div>
              {user?.lineLinkCode ? (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm text-slate-600">
                    LINE で bot を友だち追加し、このコードを送信してください:
                  </p>
                  <p className="my-2 text-center text-2xl font-bold tracking-widest">
                    {user.lineLinkCode}
                  </p>
                  <form action={generateLineCode}>
                    <button className="text-xs text-slate-400 hover:underline">
                      コードを再発行
                    </button>
                  </form>
                </div>
              ) : (
                <form action={generateLineCode}>
                  <button className="rounded-lg bg-[#06C755] px-4 py-2 text-sm font-semibold text-white">
                    連携コードを発行
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="font-semibold">🗓 Google カレンダー連携</h3>
        <p className="mt-1 text-sm text-slate-500">
          連携すると、期限・予定日のあるタスクが自動でカレンダーに登録されます。
        </p>

        {google === "connected" && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✅ 連携しました。
          </p>
        )}
        {google === "error" && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            連携に失敗しました。もう一度お試しください。
          </p>
        )}

        {!gConfigured && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ 管理者がまだ Google OAuth を設定していません（
            <code>GOOGLE_CLIENT_ID</code> 未設定）。
          </div>
        )}

        <div className="mt-4">
          {gConnected ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2">
              <span className="text-sm text-emerald-800">✅ 連携済み</span>
              <form action={disconnectGoogle}>
                <button className="text-xs text-red-500 hover:underline">解除</button>
              </form>
            </div>
          ) : (
            <a
              href="/api/google/auth"
              className="inline-block rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white"
            >
              Google で連携
            </a>
          )}
        </div>
      </section>

      <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          管理者向け: LINE / Google / Cron セットアップ手順
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-600">
          <li>
            LINE Developers でプロバイダー＆Messaging APIチャネル作成 →
            チャネルアクセストークン（長期）とチャネルシークレット取得
          </li>
          <li>
            <code>.env</code> に設定:
            <pre className="mt-1 rounded bg-slate-50 p-2 text-xs">
LINE_CHANNEL_ACCESS_TOKEN=xxx{"\n"}LINE_CHANNEL_SECRET=xxx{"\n"}CRON_SECRET=任意の文字列
            </pre>
          </li>
          <li>
            Webhook URL を <code>https://&lt;ドメイン&gt;/api/line/webhook</code>{" "}
            に設定し、Webhook を ON（応答メッセージは OFF 推奨）
          </li>
          <li>
            期限チェックを定期実行（例: 毎分）。
            <code>GET /api/cron/notify</code> に{" "}
            <code>Authorization: Bearer &lt;CRON_SECRET&gt;</code> を付けて叩く
          </li>
          <li>
            Google Cloud で OAuth クライアント(ウェブ)作成 → Calendar API 有効化 →
            承認済みリダイレクト URI に{" "}
            <code>https://&lt;ドメイン&gt;/api/google/callback</code> を登録。
          </li>
        </ol>
      </details>
    </div>
  );
}
