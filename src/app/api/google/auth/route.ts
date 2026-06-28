import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { getAuthUrl, googleConfigured } from "@/lib/google";

export const runtime = "edge";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/settings?google=unconfigured`);
  }
  const me = await getCurrentUser();
  if (!me) return NextResponse.redirect(`${origin}/settings`);

  const arr = new Uint8Array(16);
  globalThis.crypto.getRandomValues(arr);
  const state = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");

  const store = await cookies();
  store.set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(getAuthUrl(state));
}
