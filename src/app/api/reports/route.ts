import { currentUser, fail, json } from "@/lib/auth";
import { db } from "@/lib/db";
import { inBayArea, nearestCity } from "@/lib/geo";
import { fileReport, publicReports } from "@/lib/service";
import { CATEGORIES, REPORT_TYPES, type Analysis, type Category, type Channel } from "@/lib/types";

export async function GET(req: Request) {
  const user = await currentUser();
  const p = new URL(req.url).searchParams;
  const limit = Math.min(2000, Number(p.get("limit")) || 120);
  return json({ reports: publicReports(user, { mine: p.get("mine") === "1", limit }) });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail("Sign in with UniGov to file a report.", 401);
  if (!user.verified) return fail("Verify your identity before filing reports.", 403);
  const b = (await req.json()) as {
    text?: string;
    lat?: number;
    lng?: number;
    address?: string;
    analysis?: Analysis;
    category?: string;
    joinClusterId?: string | null;
    channel?: Channel;
    city?: string;
  };
  const a = b.analysis;
  if (!b.text?.trim() || typeof b.lat !== "number" || typeof b.lng !== "number" || !a) return fail("Missing report details.");
  if (!inBayArea(b.lat, b.lng)) return fail("Polity currently covers the nine-county Bay Area only.");
  const category = (CATEGORIES as readonly string[]).includes(b.category ?? "") ? (b.category as Category) : a.category;
  if (!(REPORT_TYPES as readonly string[]).includes(a.type)) return fail("Invalid analysis.");
  const join = b.joinClusterId ? db().clusters.find((c) => c.id === b.joinClusterId) : undefined;
  if (b.joinClusterId && !join) return fail("That issue no longer exists.", 404);

  const analysis: Analysis = {
    ...a,
    priority: Math.max(0, Math.min(100, Math.round(a.priority))),
    severity: Math.max(1, Math.min(5, Math.round(a.severity))),
    category,
  };
  const { report, cluster, joined } = fileReport({
    user,
    authorName: shortName(user.name),
    channel: ["web", "voice", "chat"].includes(b.channel ?? "") ? b.channel! : "web",
    text: b.text.trim().slice(0, 2000),
    lat: b.lat,
    lng: b.lng,
    address: (b.address ?? "").slice(0, 200),
    city: b.city?.trim().slice(0, 40) || nearestCity(b.lat, b.lng),
    analysis,
    category,
    joinClusterId: join?.id ?? null,
  });
  return json({ report, cluster: { id: cluster.id, title: cluster.title, count: cluster.reportIds.length + cluster.supporters.length, status: cluster.status }, joined });
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
}
