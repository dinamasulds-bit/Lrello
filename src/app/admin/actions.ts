"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, newId } from "@/lib/db";
import { teamMemberships } from "@/lib/schema";
import { getCurrentUser } from "@/lib/session";
import { isAdminUser } from "@/lib/teams";

async function requireAdmin() {
  const me = await getCurrentUser();
  if (!me) throw new Error("Unauthorized");
  const admin = await isAdminUser(me.id);
  if (!admin) throw new Error("Forbidden");
  return me;
}

export async function addMembership(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!userId || !teamId) return;
  await db.insert(teamMemberships)
    .values({ id: newId(), userId, teamId })
    .onConflictDoNothing();
  revalidatePath("/admin");
}

export async function removeMembership(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!userId || !teamId) return;
  await db.delete(teamMemberships)
    .where(and(eq(teamMemberships.userId, userId), eq(teamMemberships.teamId, teamId)));
  revalidatePath("/admin");
}
