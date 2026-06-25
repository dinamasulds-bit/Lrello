import { prisma } from "@/lib/prisma";

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
    access_type: "offline", // get a refresh token
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

// Return a valid access token for the user, refreshing if expired. null if not connected.
async function getValidAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
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
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: t.access_token,
      googleTokenExpiry: new Date(Date.now() + t.expires_in * 1000),
    },
  });
  return t.access_token;
}

function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Build a Calendar event body from a task. Prefer a timed event (dueAt), else all-day (plannedFor).
function eventBody(task: { title: string; dueAt: Date | null; plannedFor: Date | null }) {
  if (task.dueAt) {
    const end = new Date(task.dueAt.getTime() + 60 * 60 * 1000);
    return {
      summary: task.title,
      start: { dateTime: task.dueAt.toISOString(), timeZone: TZ },
      end: { dateTime: end.toISOString(), timeZone: TZ },
    };
  }
  // all-day on plannedFor
  const day = task.plannedFor!;
  const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  return {
    summary: task.title,
    start: { date: ymd(day) },
    end: { date: ymd(next) },
  };
}

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Create/update/delete the Google Calendar event mirroring a task. No-op if user not connected.
export async function syncTask(taskId: string) {
  if (!googleConfigured()) return;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignee: true },
  });
  if (!task?.assignee) return;

  const token = await getValidAccessToken(task.assignee.id);
  if (!token) return; // user hasn't connected Google

  const hasSchedule = !!(task.dueAt || task.plannedFor);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Nothing to schedule → remove any existing event.
  if (!hasSchedule) {
    if (task.googleEventId) {
      await fetch(`${CAL}/${task.googleEventId}`, { method: "DELETE", headers });
      await prisma.task.update({ where: { id: task.id }, data: { googleEventId: null } });
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
      await prisma.task.update({
        where: { id: task.id },
        data: { googleEventId: ev.id },
      });
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
