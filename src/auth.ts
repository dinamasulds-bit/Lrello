import NextAuth from "next-auth";
import { eq } from "drizzle-orm";
import { db, newId } from "@/lib/db";
import { users, teams, teamMemberships } from "@/lib/schema";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;

      let [dbUser] = await db.select({ id: users.id, name: users.name })
        .from(users).where(eq(users.email, email)).limit(1);

      if (!dbUser) {
        const [created] = await db.insert(users)
          .values({ id: newId(), name: user.name ?? email, email })
          .returning({ id: users.id, name: users.name });
        dbUser = created;
      }

      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",").map((e) => e.trim()).filter(Boolean);

      if (adminEmails.includes(email) && dbUser) {
        const [adminTeam] = await db.select({ id: teams.id })
          .from(teams).where(eq(teams.slug, "all")).limit(1);
        if (adminTeam) {
          await db.insert(teamMemberships)
            .values({ id: newId(), userId: dbUser.id, teamId: adminTeam.id, role: "admin" })
            .onConflictDoNothing();
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.email) {
        const [dbUser] = await db.select({ id: users.id, name: users.name })
          .from(users).where(eq(users.email, user.email)).limit(1);
        if (dbUser) {
          token.dbId = dbUser.id;
          token.dbName = dbUser.name;
        }
      } else if (!token.dbId && token.email) {
        const [dbUser] = await db.select({ id: users.id, name: users.name })
          .from(users).where(eq(users.email, token.email as string)).limit(1);
        if (dbUser) {
          token.dbId = dbUser.id;
          token.dbName = dbUser.name;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.dbId) {
        session.user.id = token.dbId as string;
        session.user.name = token.dbName as string;
      }
      return session;
    },
  },
});
