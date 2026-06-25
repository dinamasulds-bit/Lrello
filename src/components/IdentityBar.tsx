import { auth, signIn, signOut } from "@/auth";

export async function IdentityBar() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white">
          Google でサインイン
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-700">{session.user.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-600">
          サインアウト
        </button>
      </form>
    </div>
  );
}
