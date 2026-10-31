import { currentUser, fail, json } from "@/lib/auth";
import { inBayArea } from "@/lib/geo";
import { analyze } from "@/lib/intake";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail("Sign in with UniGov to file a report.", 401);
  const b = (await req.json()) as { text?: string; lat?: number; lng?: number; address?: string };
  const text = b.text?.trim() ?? "";
  if (text.length < 8) return fail("Describe the issue in a bit more detail.");
  if (typeof b.lat !== "number" || typeof b.lng !== "number") return fail("Set a location on the map.");
  if (!inBayArea(b.lat, b.lng)) return fail("Polity currently covers the nine-county Bay Area only.");
  return json(await analyze(text, b.lat, b.lng, b.address ?? ""));
}
