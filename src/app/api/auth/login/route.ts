import { fail, json, publicUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const b = (await req.json()) as { email?: string; password?: string };
  const email = b.email?.trim().toLowerCase() ?? "";
  const user = db().users.find((u) => u.email === email);
  if (!user || !verifyPassword(b.password ?? "", user.passwordHash)) return fail("Email or password is incorrect.", 401);
  await startSession(user.id);
  return json({ user: publicUser(user) });
}
