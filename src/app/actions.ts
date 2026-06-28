"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, isNull, asc, max } from "drizzle-orm";
import { db, newId } from "@/lib/db";
import { users, columns, tasks, comments, checklistItems, attachments } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { syncTask, deleteEventForTask } from "@/lib/google";

function revalidateAll() {
  for (const p of ["/", "/board", "/planner", "/team"]) revalidatePath(p);
}

async function requireUser() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");
  return me;
}

export async function generateLineCode() {
  const me = await requireUser();
  const arr = new Uint8Array(3);
  globalThis.crypto.getRandomValues(arr);
  const code = Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  await db.update(users).set({ lineLinkCode: code }).where(eq(users.id, me.id));
  revalidatePath("/settings");
}

export async function unlinkLine() {
  const me = await requireUser();
  await db.update(users).set({ lineUserId: null, lineLinkCode: null }).where(eq(users.id, me.id));
  revalidatePath("/settings");
}

export async function disconnectGoogle() {
  const me = await requireUser();
  await db.update(users).set({
    googleAccessToken: null,
    googleRefreshToken: null,
    googleTokenExpiry: null,
  }).where(eq(users.id, me.id));
  revalidatePath("/settings");
}

// --- Columns ---

export async function createColumn(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!name || !teamId) return;
  const [result] = await db
    .select({ maxOrder: max(columns.order) })
    .from(columns)
    .where(eq(columns.teamId, teamId));
  await db.insert(columns).values({
    id: newId(),
    name,
    order: (result?.maxOrder ?? -1) + 1,
    teamId,
  });
  revalidateAll();
}

export async function renameColumn(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await db.update(columns).set({ name }).where(eq(columns.id, id));
  revalidateAll();
}

export async function deleteColumn(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.delete(columns).where(eq(columns.id, id));
  revalidateAll();
}

export async function moveColumn(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  const cols = await db
    .select({ id: columns.id, order: columns.order })
    .from(columns)
    .where(teamId ? eq(columns.teamId, teamId) : undefined)
    .orderBy(asc(columns.order));
  const i = cols.findIndex((c) => c.id === id);
  const j = dir === "left" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= cols.length) return;
  await db.transaction(async (tx) => {
    await tx.update(columns).set({ order: cols[j].order }).where(eq(columns.id, cols[i].id));
    await tx.update(columns).set({ order: cols[i].order }).where(eq(columns.id, cols[j].id));
  });
  revalidateAll();
}

// --- Tasks ---

export async function createTask(formData: FormData) {
  const me = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "") || me.id;
  const columnId = String(formData.get("columnId") ?? "") || null;

  const [created] = await db.insert(tasks).values({
    id: newId(),
    title,
    dueAt: dueRaw ? new Date(dueRaw) : null,
    assigneeId,
    columnId,
  }).returning({ id: tasks.id, dueAt: tasks.dueAt });

  if (created.dueAt) await syncTask(created.id);
  revalidateAll();
}

function nextDueDate(current: Date, type: string): Date {
  const d = new Date(current);
  if (type === "daily") d.setDate(d.getDate() + 1);
  else if (type === "weekly") d.setDate(d.getDate() + 7);
  else if (type === "monthly") d.setMonth(d.getMonth() + 1);
  return d;
}

export async function moveTask(id: string, columnId: string | null) {
  await requireUser();
  if (!id) return;

  const [task] = await db
    .select({
      repeatType: tasks.repeatType,
      dueAt: tasks.dueAt,
      title: tasks.title,
      description: tasks.description,
      assigneeId: tasks.assigneeId,
      columnId: tasks.columnId,
    })
    .from(tasks).where(eq(tasks.id, id)).limit(1);

  const targetColRows = columnId
    ? await db.select({ isDone: columns.isDone }).from(columns).where(eq(columns.id, columnId)).limit(1)
    : [];
  const targetCol = targetColRows[0] ?? null;

  const maxRows = columnId
    ? await db.select({ maxOrder: max(tasks.order) }).from(tasks).where(eq(tasks.columnId, columnId))
    : [];
  const maxOrder = maxRows[0]?.maxOrder ?? -1;

  await db.update(tasks).set({
    columnId,
    order: maxOrder + 1,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));

  if (task?.repeatType && targetCol?.isDone && task.columnId && task.dueAt) {
    const [origMax] = await db
      .select({ maxOrder: max(tasks.order) })
      .from(tasks)
      .where(eq(tasks.columnId, task.columnId));
    await db.insert(tasks).values({
      id: newId(),
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId,
      columnId: task.columnId,
      repeatType: task.repeatType,
      dueAt: nextDueDate(task.dueAt, task.repeatType),
      order: (origMax?.maxOrder ?? -1) + 1,
      notified: false,
    });
  }

  revalidateAll();
}

export async function triageToBoard(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  let columnId = String(formData.get("columnId") ?? "");
  if (!columnId) {
    const [first] = await db.select({ id: columns.id }).from(columns).orderBy(asc(columns.order)).limit(1);
    columnId = first?.id ?? "";
  }
  if (!columnId) return;
  await moveTask(id, columnId);
}

export async function planTask(id: string, dateISO: string | null) {
  await requireUser();
  if (!id) return;
  const [task] = await db.select({ columnId: tasks.columnId }).from(tasks).where(eq(tasks.id, id)).limit(1);
  const data: { plannedFor: Date | null; columnId?: string; updatedAt: Date } = {
    plannedFor: dateISO ? new Date(dateISO + "T00:00:00") : null,
    updatedAt: new Date(),
  };
  if (dateISO && !task?.columnId) {
    const [first] = await db.select({ id: columns.id }).from(columns).orderBy(asc(columns.order)).limit(1);
    if (first) data.columnId = first.id;
  }
  await db.update(tasks).set(data).where(eq(tasks.id, id));
  await syncTask(id);
  revalidateAll();
}

export async function updateTask(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const repeatType = String(formData.get("repeatType") ?? "") || null;
  await db.update(tasks).set({
    ...(title ? { title } : {}),
    description: description || null,
    dueAt: dueRaw ? new Date(dueRaw) : null,
    repeatType,
    updatedAt: new Date(),
  }).where(eq(tasks.id, id));
  await syncTask(id);
  revalidateAll();
  revalidatePath(`/card/${id}`);
}

export async function deleteTask(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const [task] = await db
    .select({ assigneeId: tasks.assigneeId, googleEventId: tasks.googleEventId })
    .from(tasks).where(eq(tasks.id, id)).limit(1);
  if (task) await deleteEventForTask(task);
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidateAll();
}

export async function deleteTaskAndGoBoard(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    const [task] = await db
      .select({ assigneeId: tasks.assigneeId, googleEventId: tasks.googleEventId })
      .from(tasks).where(eq(tasks.id, id)).limit(1);
    if (task) await deleteEventForTask(task);
    await db.delete(tasks).where(eq(tasks.id, id));
  }
  revalidateAll();
  redirect("/board");
}

// --- Card detail ---

export async function addComment(formData: FormData) {
  const me = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!taskId || !body) return;
  await db.insert(comments).values({ id: newId(), taskId, body, authorId: me.id });
  revalidatePath(`/card/${taskId}`);
}

export async function addChecklistItem(formData: FormData) {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!taskId || !text) return;
  const [result] = await db
    .select({ maxOrder: max(checklistItems.order) })
    .from(checklistItems)
    .where(eq(checklistItems.taskId, taskId));
  await db.insert(checklistItems).values({
    id: newId(),
    taskId,
    text,
    order: (result?.maxOrder ?? -1) + 1,
  });
  revalidatePath(`/card/${taskId}`);
}

export async function toggleChecklistItem(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const [item] = await db.select({ done: checklistItems.done }).from(checklistItems).where(eq(checklistItems.id, id)).limit(1);
  if (!item) return;
  await db.update(checklistItems).set({ done: !item.done }).where(eq(checklistItems.id, id));
  revalidatePath(`/card/${taskId}`);
}

export async function deleteChecklistItem(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!id) return;
  await db.delete(checklistItems).where(eq(checklistItems.id, id));
  revalidatePath(`/card/${taskId}`);
}

export async function addAttachment(formData: FormData) {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const kind = String(formData.get("kind") ?? "link");
  if (!taskId || !url) return;
  await db.insert(attachments).values({ id: newId(), taskId, url, label: label || null, kind });
  revalidatePath(`/card/${taskId}`);
}

export async function deleteAttachment(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!id) return;
  await db.delete(attachments).where(eq(attachments.id, id));
  revalidatePath(`/card/${taskId}`);
}
