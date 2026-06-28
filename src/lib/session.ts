import { auth } from "@/auth";

export async function getCurrentUser() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user?.email) return null;
  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
  };
}
