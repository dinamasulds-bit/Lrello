import crypto from "node:crypto";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const SECRET = process.env.LINE_CHANNEL_SECRET ?? "";
const API = "https://api.line.me/v2/bot";

// True once the channel token is configured in .env.
export const lineConfigured = () => TOKEN.length > 0;

// Verify the X-Line-Signature header against the raw request body.
// Returns true if no secret is set (so local dev without creds doesn't hard-fail).
export function verifyLineSignature(rawBody: string, signature: string | null) {
  if (!SECRET) return true;
  if (!signature) return false;
  const hmac = crypto
    .createHmac("sha256", SECRET)
    .update(rawBody)
    .digest("base64");
  // timingSafeEqual needs equal-length buffers.
  const a = Buffer.from(hmac);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
