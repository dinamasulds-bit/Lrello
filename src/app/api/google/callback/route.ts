import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { exchangeCode } from "@/lib/google";


export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const store = await cookies();
  const expected = store.get("g_state")?.value;
  store.delete("g_state");

  if (!code || !state || state !== expected) {
    return NextResponse.redirect(`${origin}/settings?google=error`);
  }

  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(`${origin}/settings`);

  try {
    const t = await exchangeCode(code);
    await db.update(users).set({
      googleAccessToken: t.access_token,
      ...(t.refresh_token ? { googleRefreshToken: t.refresh_token } : {}),
      googleTokenExpiry: new Date(Date.now() + t.expires_in * 1000),
    }).where(eq(users.id, me.id));
    return NextResponse.redirect(`${origin}/settings?google=connected`);
  } catch (e) {
    console.error("[google] callback", e);
    return NextResponse.redirect(`${origin}/settings?google=error`);
  }
}
