import { currentUser, fail, json } from "@/lib/auth";
import { mergeClusters, toPublicCluster } from "@/lib/service";

export async function POST(req: Request) {
  const user = await currentUser();
  if (user?.role !== "staff") return fail("Staff only.", 403);
  const { targetId, sourceId } = (await req.json()) as { targetId?: string; sourceId?: string };
  const merged = mergeClusters(targetId ?? "", sourceId ?? "");
  if (!merged) return fail("Pick two different issues to merge.");
  return json({ cluster: toPublicCluster(merged, user) });
}
