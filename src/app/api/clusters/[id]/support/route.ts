import { currentUser, fail, json } from "@/lib/auth";
import { support, toPublicCluster } from "@/lib/service";

/** "Me too": add (or remove) the signed-in resident's support without a new report. */
export async function POST(_req: Request, ctx: RouteContext<"/api/clusters/[id]/support">) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user) return fail("Sign in with UniGov to add your support.", 401);
  if (!user.verified) return fail("Verify your identity first.", 403);
  const c = support(id, user);
  if (!c) return fail("Issue not found.", 404);
  return json({ cluster: toPublicCluster(c, user) });
}
