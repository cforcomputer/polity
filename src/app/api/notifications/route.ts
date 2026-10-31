import { currentUser, json } from "@/lib/auth";
import { db, save } from "@/lib/db";

export async function GET() {
  const user = await currentUser();
  if (!user) return json({ notifications: [] });
  const notifications = db()
    .notifications.filter((n) => n.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 30);
  return json({ notifications });
}

/** Mark all as read. */
export async function POST() {
  const user = await currentUser();
  if (!user) return json({ ok: true });
  for (const n of db().notifications) if (n.userId === user.id) n.read = true;
  save();
  return json({ ok: true });
}
