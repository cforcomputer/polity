import { currentUser, json, publicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai";
import { ensureTicker } from "@/lib/sim";

export async function GET() {
  ensureTicker();
  const user = await currentUser();
  const store = db();
  const mine = user ? store.notifications.filter((n) => n.userId === user.id) : [];
  return json({
    user: publicUser(user),
    demoMode: store.settings.demoMode,
    simulation: store.settings.simulation,
    unread: mine.filter((n) => !n.read).length,
    latestNotification: mine.at(-1) ?? null,
    aiConfigured: aiConfigured(),
  });
}
