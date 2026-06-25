import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { getAuthUrl, googleConfigured } from "@/lib/google";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/settings?google=unconfigured`);
  }
  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(`${origin}/settings`);

  const state = crypto.randomBytes(16).toString("hex");
  const store = await cookies();
  store.set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(getAuthUrl(state));
}
