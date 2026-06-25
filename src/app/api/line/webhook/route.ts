import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLineSignature, replyText } from "@/lib/line";

// LINE webhook. Set this URL in the LINE Developers console:
//   https://<your-domain>/api/line/webhook
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-line-signature");
  if (!verifyLineSignature(raw, sig)) {
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
        "友だち追加ありがとう！\nアプリの「設定」で表示される連携コードを送信してください。"
      );
      continue;
    }

    if (ev.type === "message" && ev.message?.type === "text" && userId) {
      const code = ev.message.text.trim();
      const user = await prisma.user.findFirst({ where: { lineLinkCode: code } });
      if (user) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lineUserId: userId, lineLinkCode: null },
        });
        if (ev.replyToken)
          await replyText(ev.replyToken, `連携完了！${user.name} さんに期限通知を送ります。`);
      } else if (ev.replyToken) {
        await replyText(ev.replyToken, "コードが見つかりません。アプリの「設定」で確認してください。");
      }
    }
  }

  // LINE expects 200 quickly.
  return NextResponse.json({ ok: true });
}

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text: string };
};
