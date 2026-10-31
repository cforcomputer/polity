import { fail, json, publicUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEMO_CITIZEN_ID, DEMO_STAFF_ID } from "@/lib/seed";

/** One-click demo sign-in as the seeded citizen or staff member. */
export async function POST(req: Request) {
  const { role } = (await req.json()) as { role?: "citizen" | "staff" };
  const user = db().users.find((u) => u.id === (role === "staff" ? DEMO_STAFF_ID : DEMO_CITIZEN_ID));
  if (!user) return fail("Demo account missing — reset the demo data.", 404);
  await startSession(user.id);
  return json({ user: publicUser(user) });
}
