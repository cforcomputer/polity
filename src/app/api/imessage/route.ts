import { currentUser, fail, json } from "@/lib/auth";
import { save } from "@/lib/db";
import { PhotonError, enroll, normalizeHandle, photonConfigured } from "@/lib/photon";

export async function GET() {
  const user = await currentUser();
  return json({ configured: photonConfigured(), enrollment: user?.imessage ? { handle: user.imessage.handle, agentNumber: user.imessage.agentNumber, active: !!user.imessage.spaceId } : null });
}

/** Give a verified resident their own iMessage line to Sam (a Photon shared-line assignment). */
export async function POST(req: Request) {
  if (!photonConfigured()) return fail("iMessage isn't configured on this server yet.", 503);
  const user = await currentUser();
  if (!user) return fail("Sign in with UniGov first.", 401);
  if (!user.verified) return fail("Verify your identity first.", 403);
  const { handle: raw } = (await req.json()) as { handle?: string };
  const handle = normalizeHandle(raw ?? "");
  if (!handle) return fail("Enter the phone number (with area code) or Apple ID email you use for iMessage.");
  try {
    const agentNumber = await enroll(handle);
    user.imessage = { handle, agentNumber };
    save();
    return json({ handle, agentNumber });
  } catch (e) {
    const msg = e instanceof PhotonError ? `${e.code}: ${e.message}` : "Photon is unreachable.";
    console.error("[imessage enroll]", msg);
    return fail(`Couldn't assign an iMessage line (${msg}).`, 502);
  }
}
