import NextAuth from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email) return false;
      let dbUser = await prisma.user.findUnique({ where: { email } });
      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: { name: user.name ?? email, email },
        });
      }
      // Auto-assign admin emails to 全体管理 team on sign-in
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      if (adminEmails.includes(email)) {
        const adminTeam = await prisma.team.findUnique({ where: { slug: "all" } });
        if (adminTeam) {
          await prisma.teamMembership.upsert({
            where: { userId_teamId: { userId: dbUser.id, teamId: adminTeam.id } },
            create: { userId: dbUser.id, teamId: adminTeam.id, role: "admin" },
            update: {},
          });
        }
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, name: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.name = dbUser.name;
        }
      }
      return session;
    },
  },
});
