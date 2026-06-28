import { NextResponse } from "next/server";
import { runDueNotifications } from "@/lib/notify";


// Deadline notifier. Hit this on a schedule (Vercel Cron / cron-job.org / local cron):
//   GET /api/cron/notify           (header: Authorization: Bearer <CRON_SECRET>)
// Protected by CRON_SECRET when set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return new NextResponse("unauthorized", { status: 401 });
    }
  }
  const result = await runDueNotifications();
  return NextResponse.json(result);
}
