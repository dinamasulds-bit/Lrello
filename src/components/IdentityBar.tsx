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
        <button className="rounded-md bg-[#1D9E75] px-3 py-1 text-sm text-white">
          Google でサインイン
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden sm:block text-slate-500 text-xs">{session.user.name}</span>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:bg-slate-50">
          サインアウト
        </button>
      </form>
    </div>
  );
}
