import { currentUser, json } from "@/lib/auth";
import { publicClusters, stats } from "@/lib/service";

export async function GET() {
  const user = await currentUser();
  return json({ clusters: publicClusters(user), stats: stats() });
}
