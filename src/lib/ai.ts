import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORIES, REPORT_TYPES, type Analysis, type Category, type Cluster, type Report, type StaffBrief } from "./types";
import { CATEGORY_META } from "./meta";

export const MODEL = "claude-sonnet-5-5";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.claude_api ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("No Claude API key: set claude_api in .env");
    _client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  }
  return _client;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.claude_api ?? process.env.ANTHROPIC_API_KEY);
}

/**
 * One structured call: Sonnet with server-side refusal fallback, output parsed against a Zod schema.
 * Throws on refusal or unparseable output so callers can fall back.
 */
async function structured<T extends z.ZodType>(opts: {
  schema: T;
  system: string;
  content: Anthropic.Beta.Messages.BetaContentBlockParam[] | string;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  history?: Anthropic.Beta.Messages.BetaMessageParam[];
}): Promise<z.infer<T>> {
  const res = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    messages: [...(opts.history ?? []), { role: "user", content: opts.content }],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (res.parsed_output == null) throw new Error(`Unparseable output (stop_reason ${res.stop_reason})`);
  return res.parsed_output as z.infer<T>;
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Claude API key rejected";
  if (err instanceof Anthropic.RateLimitError) return "Claude rate limit reached";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}`.trim();
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Report analysis: classify, prioritize, and match against nearby clusters.
// ---------------------------------------------------------------------------

const AnalysisSchema = z.object({
  type: z.enum(REPORT_TYPES),
  category: z.enum(CATEGORIES),
  title: z.string().describe("Neutral issue title, max 60 characters, names the place, e.g. 'Potholes on I-880 near High St'"),
  summary: z.string().describe("One or two sentences describing the issue for government staff"),
  severity: z.number().int().describe("1 (cosmetic) to 5 (imminent danger to life)"),
  priority: z.number().int().describe("0-100 overall priority"),
  priority_reason: z.string().describe("One short sentence justifying the priority"),
  department: z.string().describe("Responsible agency or department"),
  match_cluster_id: z.string().nullable().describe("id of the candidate cluster describing the SAME underlying problem, or null"),
  match_reason: z.string().describe("Why it matches, or why none match; one sentence"),
});

const ANALYSIS_SYSTEM = `You are the intake analyst for Polity, a civic issue-reporting service used by local governments across the nine-county San Francisco Bay Area. Residents submit problems (complaints), recommendations, or ideas tied to a location. You turn each submission into a clean, triaged record for government staff.

Type:
- complaint: something is broken, unsafe, or not working.
- recommendation: a concrete proposed fix to a known problem.
- idea: a new improvement not tied to a failure.

Category: choose exactly one from the allowed list. Default departments by category:
${Object.entries(CATEGORY_META)
  .map(([c, m]) => `- ${c}: ${m.department}`)
  .join("\n")}
Use a more specific real agency when the location clearly calls for it: Caltrans District 4 for state highways and freeways (I-80, I-880, I-280, I-580, I-680, US-101, SR-24, Hwy 1...), BART for BART stations, Caltrain for Caltrain, AC Transit / VTA / Muni / SamTrans for buses in their areas, EBMUD for East Bay water, SFPUC for San Francisco water.

Priority (0-100) reflects how urgently staff should act. Weigh, in order:
1. Risk to life or serious injury (crashes, fire fuel, live wires, sinkholes, flooding on roadways, school-zone speeding) — can push priority above 80.
2. Number of people affected and whether it blocks access or mobility (accessibility barriers for wheelchair users count heavily).
3. Whether it is getting worse or time-sensitive (active leaks, spreading damage, upcoming storms or fire weather).
4. Cosmetic or quality-of-life issues sit below 35; ideas and recommendations usually sit between 15 and 45 unless they address an active danger.
Severity 1-5 is the harm if left unaddressed. Keep priority consistent with severity.

Matching: you receive nearby open clusters (groups of earlier reports). Set match_cluster_id only if the new submission is about the SAME underlying problem at the same place (e.g. the same pothole field, the same dangerous intersection, the same dumping spot). A different problem that happens to be nearby is NOT a match (a pothole next to a broken streetlight). A recommendation or idea that proposes a fix for an existing cluster's problem IS a match. If none match, return null.

Write titles and summaries in plain, neutral English even when the submission is in another language. Do not invent facts not present in the submission.`;

export interface Candidate {
  id: string;
  title: string;
  category: Category;
  summary: string;
  distanceKm: number;
  count: number;
}

export async function analyzeWithClaude(
  input: { text: string; address: string; city: string; lat: number; lng: number },
  candidates: Candidate[],
): Promise<Analysis> {
  const content = `New submission
Location: ${input.address || "(pin on map)"}, ${input.city} (${input.lat.toFixed(5)}, ${input.lng.toFixed(5)})
Text: """${input.text}"""

Nearby open clusters (closest first):
${
  candidates.length
    ? candidates
        .map((c) => `- id=${c.id} | ${c.distanceKm.toFixed(2)} km away | ${c.category} | ${c.count} reports | "${c.title}" — ${c.summary}`)
        .join("\n")
    : "(none within 1.5 km)"
}`;
  const out = await structured({ schema: AnalysisSchema, system: ANALYSIS_SYSTEM, content });
  const match = candidates.some((c) => c.id === out.match_cluster_id) ? out.match_cluster_id : null;
  return {
    type: out.type,
    category: out.category,
    title: out.title.slice(0, 80),
    summary: out.summary,
    severity: clamp(out.severity, 1, 5),
    priority: clamp(out.priority, 0, 100),
    priorityReason: out.priority_reason,
    department: out.department,
    matchClusterId: match,
    matchReason: out.match_reason,
    aiMode: "claude",
  };
}

// Keyword fallback so the demo keeps working without the API.
const KEYWORDS: [Category, RegExp][] = [
  ["Public Safety", /fire|brush|smoke|wildfire|live wire|downed (wire|line)|gas leak/i],
  ["Traffic Safety", /speed|crash|collision|near.?miss|red light|run the red|crosswalk|intersection|school zone|merge|weav|t-?boned/i],
  ["Roads & Potholes", /pothole|asphalt|pavement|sinkhole|crater|road surface|rim|flat tire/i],
  ["Flooding & Drainage", /flood|tide|storm drain|standing water|drainage|under water/i],
  ["Water & Sewer", /water main|leak|pressure|sewage|sewer|hydrant/i],
  ["Streetlights & Signals", /streetlight|street light|signal|traffic light|lights? (are|is) out|dark/i],
  ["Public Transit", /bart|bus|muni|caltrain|vta|transit|escalator|elevator|station/i],
  ["Sanitation & Dumping", /dump|trash|garbage|litter|mattress|debris|basura|tires/i],
  ["Sidewalks & Accessibility", /sidewalk|wheelchair|curb ramp|ada|trip(ped)?|walker/i],
  ["Bike & Pedestrian", /bike|cycl|pedestrian plaza|scooter/i],
  ["Parks & Trees", /park|tree|playground|trail|greenway/i],
  ["Housing & Homelessness", /encampment|homeless|tent|rv /i],
  ["Environment & Noise", /noise|loud|construction|heat|shade|pollution|air quality/i],
];

export function analyzeOffline(input: { text: string; address: string; city: string }, candidates: Candidate[]): Analysis {
  const text = input.text;
  const category = KEYWORDS.find(([, re]) => re.test(text))?.[0] ?? "Other";
  const type = /^(idea|what if)/i.test(text.trim()) || /\bidea\b/i.test(text)
    ? "idea"
    : /recommend|suggest|should (add|install|build)|please add/i.test(text)
      ? "recommendation"
      : "complaint";
  const danger = /(almost|nearly) (hit|fell)|crash|injur|fire|ambulance|danger|death|sinkhole|flood/i.test(text);
  const severity = danger ? 4 : type === "complaint" ? 3 : 2;
  const priority = type === "complaint" ? (danger ? 74 : 50) : 30;
  const match = candidates.find((c) => c.category === category && c.distanceKm < 0.6) ?? null;
  const first = text.split(/[.!?]/)[0].trim();
  return {
    type,
    category,
    title: (first.length > 58 ? first.slice(0, 57) + "…" : first) || `${category} issue`,
    summary: text.slice(0, 220),
    severity,
    priority,
    priorityReason: danger ? "Mentions a risk of injury." : "No immediate danger described.",
    department: CATEGORY_META[category].department,
    matchClusterId: match?.id ?? null,
    matchReason: match ? "Same category within 600 m." : "No similar cluster nearby.",
    aiMode: "offline",
  };
}

// ---------------------------------------------------------------------------
// UniGov identity document check (vision).
// ---------------------------------------------------------------------------

const IdSchema = z.object({
  is_identity_document: z.boolean().describe("true only for a government-issued photo ID: driver license, state ID, passport, passport card, residence permit"),
  document_type: z.string().describe("e.g. 'California Driver License'; empty if not an ID"),
  full_name: z.string().describe("Holder's full name exactly as printed; empty if unreadable"),
  expiry_date: z.string().nullable().describe("Expiry date as YYYY-MM-DD, or null if not visible"),
  issuer: z.string().describe("Issuing state or country"),
  issues: z.string().describe("Anything that looks wrong: unreadable, cropped, screenshot of a sample, obviously edited. Empty if none."),
});

export async function readIdDocument(imageBase64: string, mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif") {
  return structured({
    schema: IdSchema,
    system:
      "You assist UniGov, a government identity service, in verifying that a resident uploaded a genuine government-issued photo ID during account registration. Read the document fields exactly as printed. Do not guess unreadable fields.",
    content: [
      { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
      { type: "text", text: "Extract the identity document fields." },
    ],
  });
}

// ---------------------------------------------------------------------------
// Staff brief for a cluster.
// ---------------------------------------------------------------------------

const BriefSchema = z.object({
  root_cause: z.string().describe("Most likely underlying cause, 1-2 sentences"),
  impact: z.string().describe("Who is affected and how badly, 1-2 sentences"),
  actions: z.array(z.string()).describe("3-5 concrete next actions for staff, most urgent first"),
  department: z.string().describe("Agency that should own this"),
});

export async function briefWithClaude(cluster: Cluster, reports: Report[]): Promise<StaffBrief> {
  const content = `Cluster: "${cluster.title}" (${cluster.category}, ${cluster.city}, status ${cluster.status}, priority ${cluster.priority}/100)
Location: ${reports[0]?.address ?? ""}, ${cluster.city}
${reports.length} resident reports, oldest first:
${reports.map((r) => `- [${r.createdAt.slice(0, 10)} via ${r.channel}] ${r.text}`).join("\n")}
Staff updates so far:
${cluster.updates.map((u) => `- ${u.at.slice(0, 10)} ${u.status}: ${u.note}`).join("\n") || "(none)"}`;
  const out = await structured({
    schema: BriefSchema,
    effort: "medium",
    system:
      "You brief Bay Area local-government operations staff on a cluster of resident reports about the same issue. Be specific, practical, and grounded only in the reports. No preamble.",
    content,
  });
  return {
    rootCause: out.root_cause,
    impact: out.impact,
    actions: out.actions.slice(0, 5),
    department: out.department,
    generatedAt: new Date().toISOString(),
    aiMode: "claude",
  };
}

export function briefOffline(cluster: Cluster, reports: Report[]): StaffBrief {
  return {
    rootCause: `Residents describe a recurring ${cluster.category.toLowerCase()} problem at ${reports[0]?.address ?? cluster.city}.`,
    impact: `${reports.length} residents reported this; current priority ${cluster.priority}/100.`,
    actions: ["Send an inspector to confirm conditions on site", "Post a public update to linked residents", "Schedule repair or mitigation with the owning department"],
    department: cluster.department,
    generatedAt: new Date().toISOString(),
    aiMode: "offline",
  };
}

// ---------------------------------------------------------------------------
// Conversational intake agent (WhatsApp-style chat and voice line).
// ---------------------------------------------------------------------------

const IntakeSchema = z.object({
  reply: z.string().describe("What Sam says next to the resident"),
  ready: z.boolean().describe("true once both the problem and a specific location are known and the resident has nothing to add"),
  problem: z.string().describe("The resident's issue rewritten as a first-person report with all useful details; empty until known"),
  location: z.string().describe("The place in plain words as the resident described it, e.g. 'North Point St & Webster St, San Francisco'; empty until known"),
  house_number: z.string().describe("Street number if given (first number of a range like 1600-1698 → '1600'); else empty"),
  street: z.string().describe("Main street name with its suffix spelled out, e.g. 'North Point Street'; else empty"),
  cross_street: z.string().describe("Cross street if the place is an intersection or 'near X', e.g. 'Webster Street'; else empty"),
  place: z.string().describe("Landmark, park, station, school or business name if that is how they described it; else empty"),
  city: z.string().describe("Official Bay Area city name, normalizing nicknames (SF, San Fran → San Francisco; SJ → San Jose); else empty"),
});

export type IntakeTurn = z.infer<typeof IntakeSchema>;

export async function intakeTurn(history: { role: "user" | "assistant"; content: string }[], mode: "chat" | "voice"): Promise<IntakeTurn> {
  const style =
    mode === "voice"
      ? "This is a phone call read aloud by a text-to-speech voice: plain sentences, no emoji, no lists, at most 30 words per reply. Latency-sensitive; begin your visible answer immediately."
      : "This is a WhatsApp chat: warm and brief, at most 2 short sentences per reply; one emoji is fine occasionally.";
  const system = `You are Sam from the Bay Area Civic Desk, the friendly front line of Polity, a service residents of the nine-county San Francisco Bay Area use to report problems, recommendations, and ideas to local government.
Your job: understand the issue and where it is, then file it. A location is good enough when you have a city plus ANY of: a street address, two cross streets, a landmark or business, or a single street. Never ask again for something the resident already told you; if they gave one street, you may ask once for the nearest cross street or house number, but if they don't know, file with what you have. Ask ONE question at a time, only when it helps crews (how big, since when, is anyone in danger). Ask at most about 3 questions in total, then file.
Fill house_number, street, cross_street, place and city from everything said so far in the conversation, every turn, even before ready.
If the place is outside the Bay Area, explain kindly that Polity currently covers only the Bay Area.
If someone describes an emergency happening right now (fire, crash with injuries, crime in progress), tell them to call 911 first.
When you have the problem and location, set ready=true and in reply briefly read back what you will file and say you're filing it now.
Reply in the resident's language. ${style}`;
  const prior = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
  const last = history.at(-1)?.content ?? "";
  return structured({ schema: IntakeSchema, system, content: last, history: prior, maxTokens: 2000 });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
}
