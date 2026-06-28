import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, tasks } from "@/lib/schema";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/google/callback";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TZ = "Asia/Tokyo";

export const googleConfigured = () => CLIENT_ID.length > 0 && CLIENT_SECRET.length > 0;

export function getAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResp = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function exchangeCode(code: string): Promise<TokenResp> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${await res.text()}`);
  return res.json();
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const [user] = await db
    .select({
      googleAccessToken: users.googleAccessToken,
      googleRefreshToken: users.googleRefreshToken,
      googleTokenExpiry: users.googleTokenExpiry,
    })
    .from(users).where(eq(users.id, userId)).limit(1);

  if (!user?.googleRefreshToken) return null;

  const stillValid =
    user.googleAccessToken &&
    user.googleTokenExpiry &&
    user.googleTokenExpiry.getTime() > Date.now() + 60_000;
  if (stillValid) return user.googleAccessToken;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: user.googleRefreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    console.error("[google] refresh failed", await res.text());
    return null;
  }
  const t: TokenResp = await res.json();
  await db.update(users).set({
    googleAccessToken: t.access_token,
    googleTokenExpiry: new Date(Date.now() + t.expires_in * 1000),
  }).where(eq(users.id, userId));
  return t.access_token;
}

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function eventBody(task: { title: string; dueAt: Date | null; plannedFor: Date | null }) {
  if (task.dueAt) {
    const end = new Date(task.dueAt.getTime() + 60 * 60 * 1000);
    return {
      summary: task.title,
      start: { dateTime: task.dueAt.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
    };
  }
  const day = task.plannedFor!;
  const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  return {
    summary: task.title,
    start: { date: ymd(day) },
    end: { date: ymd(next) },
  };
}

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function syncTask(taskId: string) {
  if (!googleConfigured()) return;

  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      plannedFor: tasks.plannedFor,
      googleEventId: tasks.googleEventId,
      assigneeId: tasks.assigneeId,
    })
    .from(tasks).where(eq(tasks.id, taskId)).limit(1);

  if (!task?.assigneeId) return;

  const token = await getValidAccessToken(task.assigneeId);
  if (!token) return;

  const hasSchedule = !!(task.dueAt || task.plannedFor);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (!hasSchedule) {
    if (task.googleEventId) {
      await fetch(`${CAL}/${task.googleEventId}`, { method: "DELETE", headers });
      await db.update(tasks).set({ googleEventId: null }).where(eq(tasks.id, task.id));
    }
    return;
  }

  const body = JSON.stringify(eventBody(task));
  if (task.googleEventId) {
    await fetch(`${CAL}/${task.googleEventId}`, { method: "PATCH", headers, body });
  } else {
    const res = await fetch(CAL, { method: "POST", headers, body });
    if (res.ok) {
      const ev = await res.json();
      await db.update(tasks).set({ googleEventId: ev.id }).where(eq(tasks.id, task.id));
    } else {
      console.error("[google] create event failed", await res.text());
    }
  }
}

export async function deleteEventForTask(task: {
  assigneeId: string | null;
  googleEventId: string | null;
}) {
  if (!googleConfigured() || !task.googleEventId || !task.assigneeId) return;
  const token = await getValidAccessToken(task.assigneeId);
  if (!token) return;
  await fetch(`${CAL}/${task.googleEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
