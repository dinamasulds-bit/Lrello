import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isAdminUser } from "@/lib/teams";
import { addMembership, removeMembership } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/");

  const isAdmin = await isAdminUser(me.id);
  if (!isAdmin) {
    return (
      <p className="text-slate-500">
        このページは全体管理者のみアクセスできます。
      </p>
    );
  }

  const [teams, users] = await Promise.all([
    prisma.team.findMany({ orderBy: { order: "asc" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        memberships: { include: { team: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-6 text-xl font-bold">⚙ 管理者 — チームメンバー設定</h2>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">ユーザー</th>
              {teams.map((t) => (
                <th key={t.id} className="px-3 py-3 text-center font-semibold">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => {
              const memberTeamIds = new Set(u.memberships.map((m) => m.teamId));
              return (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  {teams.map((t) => {
                    const isMember = memberTeamIds.has(t.id);
                    return (
                      <td key={t.id} className="px-3 py-3 text-center">
                        <form action={isMember ? removeMembership : addMembership}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="teamId" value={t.id} />
                          <button
                            className={`h-6 w-6 rounded border text-xs font-bold transition ${
                              isMember
                                ? "border-blue-300 bg-blue-100 text-blue-700 hover:bg-red-100 hover:text-red-700"
                                : "border-slate-200 bg-white text-slate-300 hover:border-blue-300 hover:text-blue-600"
                            }`}
                            title={isMember ? "外す" : "追加"}
                          >
                            {isMember ? "✓" : "+"}
                          </button>
                        </form>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
