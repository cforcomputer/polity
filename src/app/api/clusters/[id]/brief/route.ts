import { currentUser, fail, json } from "@/lib/auth";
import { db, save } from "@/lib/db";
import { briefOffline, briefWithClaude, describeError } from "@/lib/ai";

/** Staff: generate an AI brief (root cause, impact, next actions) for a cluster. */
export async function POST(_req: Request, ctx: RouteContext<"/api/clusters/[id]/brief">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (user?.role !== "staff") return fail("Staff only.", 403);
  const store = db();
  const c = store.clusters.find((x) => x.id === id);
  if (!c) return fail("Issue not found.", 404);
  const reports = store.reports.filter((r) => r.clusterId === c.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let warning: string | undefined;
  try {
    c.brief = await briefWithClaude(c, reports);
  } catch (e) {
    warning = `Claude unavailable (${describeError(e)}); showing an offline brief.`;
    c.brief = briefOffline(c, reports);
  }
  save();
  return json({ brief: c.brief, warning });
}
