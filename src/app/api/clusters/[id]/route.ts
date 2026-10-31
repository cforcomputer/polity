import { currentUser, fail, json } from "@/lib/auth";
import { db, save } from "@/lib/db";
import { setStatus, toPublicCluster } from "@/lib/service";
import { STATUSES, type Status } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/clusters/[id]">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  const store = db();
  const c = store.clusters.find((x) => x.id === id);
  if (!c) return fail("Issue not found.", 404);
  const reports = store.reports
    .filter((r) => r.clusterId === c.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r, mine: !!user && r.userId === user.id, userId: undefined }));
  return json({ cluster: toPublicCluster(c, user), reports });
}

/** Staff: change status, department, or post a public update. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/clusters/[id]">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (user?.role !== "staff") return fail("Staff only.", 403);
  const c = db().clusters.find((x) => x.id === id);
  if (!c) return fail("Issue not found.", 404);
  const b = (await req.json()) as { status?: Status; department?: string; note?: string };
  if (b.department?.trim()) c.department = b.department.trim();
  const note = b.note?.trim() ?? "";
  if (b.status && STATUSES.includes(b.status)) {
    setStatus(c, b.status, note, `${user.name}, ${c.department}`);
  } else if (note) {
    c.updates.push({ at: new Date().toISOString(), status: c.status, note, by: `${user.name}, ${c.department}` });
    c.updatedAt = new Date().toISOString();
  }
  save();
  return json({ cluster: toPublicCluster(c, user) });
}
