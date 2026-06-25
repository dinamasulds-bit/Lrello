"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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
  await prisma.teamMembership.upsert({
    where: { userId_teamId: { userId, teamId } },
    create: { userId, teamId },
    update: {},
  });
  revalidatePath("/admin");
}

export async function removeMembership(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!userId || !teamId) return;
  await prisma.teamMembership.deleteMany({ where: { userId, teamId } });
  revalidatePath("/admin");
}
