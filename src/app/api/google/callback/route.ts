import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
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
    await prisma.user.update({
      where: { id: me.id },
      data: {
        googleAccessToken: t.access_token,
        // Google only returns refresh_token on first consent — keep the old one otherwise.
        ...(t.refresh_token ? { googleRefreshToken: t.refresh_token } : {}),
        googleTokenExpiry: new Date(Date.now() + t.expires_in * 1000),
      },
    });
    return NextResponse.redirect(`${origin}/settings?google=connected`);
  } catch (e) {
    console.error("[google] callback", e);
    return NextResponse.redirect(`${origin}/settings?google=error`);
  }
}
