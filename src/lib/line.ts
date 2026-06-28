const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const API = "https://api.line.me/v2/bot";

export const lineConfigured = () => TOKEN.length > 0;

export async function verifyLineSignature(rawBody: string, signature: string | null) {
  if (!SECRET) return true;
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hmac = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return hmac === signature;
}

async function call(path: string, body: unknown) {
  if (!lineConfigured()) {
    console.warn("[line] LINE_CHANNEL_ACCESS_TOKEN not set — skipping", path);
    return { ok: false, skipped: true };
  }
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("[line] API error", res.status, await res.text());
    return { ok: false, skipped: false };
  }
  return { ok: true, skipped: false };
}

export function pushText(to: string, text: string) {
  return call("/message/push", { to, messages: [{ type: "text", text }] });
}

export function replyText(replyToken: string, text: string) {
  return call("/message/reply", {
    replyToken,
    messages: [{ type: "text", text }],
  });
}
