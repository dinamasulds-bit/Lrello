import { prisma } from "@/lib/prisma";

export type TeamInfo = {
  id: string;
  name: string;
  slug: string;
  order: number;
};

export async function getUserTeams(userId: string): Promise<TeamInfo[]> {
  const memberships = await prisma.teamMembership.findMany({
    where: { userId },
    include: { team: { select: { id: true, name: true, slug: true, order: true } } },
    orderBy: { team: { order: "asc" } },
  });
  return memberships.map((m) => m.team);
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const m = await prisma.teamMembership.findFirst({
    where: { userId, team: { slug: "all" } },
  });
  return !!m;
}

export async function getAllTeams(): Promise<TeamInfo[]> {
  return prisma.team.findMany({
    select: { id: true, name: true, slug: true, order: true },
    orderBy: { order: "asc" },
  });
}

export async function getAccessibleTeams(userId: string): Promise<TeamInfo[]> {
  const [isAdmin, myTeams] = await Promise.all([
    isAdminUser(userId),
    getUserTeams(userId),
  ]);
  if (isAdmin) return getAllTeams();
  return myTeams;
}
