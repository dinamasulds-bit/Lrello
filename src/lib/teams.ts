import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { teams, teamMemberships, columns } from "@/lib/schema";

export type TeamInfo = {
  id: string;
  name: string;
  slug: string;
  order: number;
};

export async function getAllTeams(): Promise<TeamInfo[]> {
  return db.select({ id: teams.id, name: teams.name, slug: teams.slug, order: teams.order })
    .from(teams).orderBy(asc(teams.order));
}

export async function getAccessibleTeams(userId: string): Promise<TeamInfo[]> {
  const memberships = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, order: teams.order })
    .from(teamMemberships)
    .innerJoin(teams, eq(teamMemberships.teamId, teams.id))
    .where(eq(teamMemberships.userId, userId))
    .orderBy(asc(teams.order));

  const isAdmin = memberships.some((t) => t.slug === "all");
  if (isAdmin) return getAllTeams();
  return memberships;
}

export async function getColumns(teamId: string) {
  return db
    .select({ id: columns.id, name: columns.name, isDone: columns.isDone, order: columns.order })
    .from(columns)
    .where(eq(columns.teamId, teamId))
    .orderBy(asc(columns.order));
}

// Keep getCachedColumns as alias (no caching on edge — short-lived workers)
export const getCachedColumns = getColumns;

export async function isAdminUser(userId: string): Promise<boolean> {
  const teams = await getAccessibleTeams(userId);
  return teams.some((t) => t.slug === "all");
}
