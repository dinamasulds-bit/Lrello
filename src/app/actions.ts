"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

// Generate a one-time LINE link code for the current user.
// The user sends this code to the bot; the webhook then stores their lineUserId.
export async function generateLineCode() {
  const me = await requireUser();
  const code = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 hex chars
  await prisma.user.update({ where: { id: me.id }, data: { lineLinkCode: code } });
  revalidatePath("/settings");
}

export async function unlinkLine() {
  const me = await requireUser();
  await prisma.user.update({
    where: { id: me.id },
    data: { lineUserId: null, lineLinkCode: null },
  });
  revalidatePath("/settings");
}

export async function disconnectGoogle() {
  const me = await requireUser();
  await prisma.user.update({
    where: { id: me.id },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    },
  });
  revalidatePath("/settings");
}

// --- Columns (customizable board lists) ---

export async function createColumn(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!name || !teamId) return;
  const max = await prisma.column.aggregate({
    where: { teamId },
    _max: { order: true },
  });
  await prisma.column.create({
    data: { name, order: (max._max.order ?? -1) + 1, teamId },
  });
  revalidateAll();
}

export async function renameColumn(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;
  await prisma.column.update({ where: { id }, data: { name } });
  revalidateAll();
}

export async function deleteColumn(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Tasks fall back to Inbox (columnId set null via onDelete: SetNull).
  await prisma.column.delete({ where: { id } });
  revalidateAll();
}

export async function moveColumn(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? ""); // "left" | "right"
  const teamId = String(formData.get("teamId") ?? "");
  const cols = await prisma.column.findMany({
    where: teamId ? { teamId } : undefined,
    orderBy: { order: "asc" },
  });
  const i = cols.findIndex((c) => c.id === id);
  const j = dir === "left" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= cols.length) return;
  await prisma.$transaction([
    prisma.column.update({ where: { id: cols[i].id }, data: { order: cols[j].order } }),
    prisma.column.update({ where: { id: cols[j].id }, data: { order: cols[i].order } }),
  ]);
  revalidateAll();
}

// --- Tasks ---

// Quick capture → Inbox (columnId null) by default. Pass columnId to drop on a column.
export async function createTask(formData: FormData) {
  const me = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const dueRaw = String(formData.get("dueAt") ?? "").trim();
  const assigneeId = String(formData.get("assigneeId") ?? "") || me.id;
  const columnId = String(formData.get("columnId") ?? "") || null;

  const created = await prisma.task.create({
    data: {
      title,
      dueAt: dueRaw ? new Date(dueRaw) : null,
      assigneeId,
      columnId,
    },
  });
  if (created.dueAt) await syncTask(created.id);
  revalidateAll();
}

// Board DnD: move a card to a column (or back to Inbox with columnId null).
export async function moveTask(id: string, columnId: string | null) {
  await requireUser();
  if (!id) return;
  const max = columnId
    ? await prisma.task.aggregate({
        where: { columnId },
        _max: { order: true },
      })
    : null;
  await prisma.task.update({
    where: { id },
    data: { columnId, order: (max?._max.order ?? -1) + 1 },
  });
  revalidateAll();
}

// Form variant: send an Inbox card to a chosen column (default first).
export async function triageToBoard(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  let columnId = String(formData.get("columnId") ?? "");
  if (!columnId) {
    const first = await prisma.column.findFirst({ orderBy: { order: "asc" } });
    columnId = first?.id ?? "";
  }
  if (!columnId) return;
  await moveTask(id, columnId);
}

// Planner DnD: place on a day (dateISO "YYYY-MM-DD") or clear (null).
export async function planTask(id: string, dateISO: string | null) {
  await requireUser();
  if (!id) return;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { column: true },
  });
  const data: { plannedFor: Date | null; columnId?: string } = {
    plannedFor: dateISO ? new Date(dateISO + "T00:00:00") : null,
  };
  // Planning an Inbox task pulls it onto the board (first column).
  if (dateISO && !task?.columnId) {
    const first = await prisma.column.findFirst({ orderBy: { order: "asc" } });
    if (first) data.columnId = first.id;
  }
  await prisma.task.update({ where: { id }, data });
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
  await prisma.task.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      description: description || null,
      dueAt: dueRaw ? new Date(dueRaw) : null,
    },
  });
  await syncTask(id);
  revalidateAll();
  revalidatePath(`/card/${id}`);
}

export async function deleteTask(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const task = await prisma.task.findUnique({ where: { id } });
  if (task) await deleteEventForTask(task);
  await prisma.task.delete({ where: { id } });
  revalidateAll();
}

// Delete from the card detail page, then return to the board.
export async function deleteTaskAndGoBoard(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    const task = await prisma.task.findUnique({ where: { id } });
    if (task) await deleteEventForTask(task);
    await prisma.task.delete({ where: { id } });
  }
  revalidateAll();
  redirect("/board");
}

// --- Card detail: comments / checklist / attachments ---

export async function addComment(formData: FormData) {
  const me = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!taskId || !body) return;
  await prisma.comment.create({ data: { taskId, body, authorId: me.id } });
  revalidatePath(`/card/${taskId}`);
}

export async function addChecklistItem(formData: FormData) {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!taskId || !text) return;
  const max = await prisma.checklistItem.aggregate({
    where: { taskId },
    _max: { order: true },
  });
  await prisma.checklistItem.create({
    data: { taskId, text, order: (max._max.order ?? -1) + 1 },
  });
  revalidatePath(`/card/${taskId}`);
}

export async function toggleChecklistItem(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const item = await prisma.checklistItem.findUnique({ where: { id } });
  if (!item) return;
  await prisma.checklistItem.update({
    where: { id },
    data: { done: !item.done },
  });
  revalidatePath(`/card/${taskId}`);
}

export async function deleteChecklistItem(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!id) return;
  await prisma.checklistItem.delete({ where: { id } });
  revalidatePath(`/card/${taskId}`);
}

export async function addAttachment(formData: FormData) {
  await requireUser();
  const taskId = String(formData.get("taskId") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const kind = String(formData.get("kind") ?? "link");
  if (!taskId || !url) return;
  await prisma.attachment.create({
    data: { taskId, url, label: label || null, kind },
  });
  revalidatePath(`/card/${taskId}`);
}

export async function deleteAttachment(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!id) return;
  await prisma.attachment.delete({ where: { id } });
  revalidatePath(`/card/${taskId}`);
}
