import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { verifyLineSignature, replyText } from "@/lib/line";

export const runtime = "edge";

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-line-signature");
  if (!(await verifyLineSignature(raw, sig))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  for (const ev of body.events ?? []) {
    const userId = ev.source?.userId;

    if (ev.type === "follow" && ev.replyToken) {
      await replyText(
        ev.replyToken,
        "友だち追加ありがとう！\nアプリの「設定」で表示される連携コードを送信してください。",
      );
      continue;
    }

    if (ev.type === "message" && ev.message?.type === "text" && userId) {
      const code = ev.message.text.trim();
      const [user] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.lineLinkCode, code))
        .limit(1);
      if (user) {
        await db.update(users).set({ lineUserId: userId, lineLinkCode: null }).where(eq(users.id, user.id));
        if (ev.replyToken)
          await replyText(ev.replyToken, `連携完了！${user.name} さんに期限通知を送ります。`);
      } else if (ev.replyToken) {
        await replyText(
          ev.replyToken,
          "コードが見つかりません。アプリの「設定」で確認してください。",
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text: string };
};
