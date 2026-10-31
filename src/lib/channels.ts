import crypto from "node:crypto";
import { describeError, intakeTurn, type IntakeTurn } from "./ai";
import { inBayArea } from "./geo";
import { locate } from "./locate";
import { analyze } from "./intake";
import { fileReport } from "./service";
import type { Channel, User } from "./types";

export type Turn = { role: "user" | "assistant"; content: string };

export interface AgentStep {
  reply: string;
  ready: boolean;
  draft: { text: string; location: string; lat: number; lng: number; label: string } | null;
  error?: string;
}

/** Messages must open with a user turn; drop any greeting the client showed first. */
function normalize(history: Turn[]): Turn[] {
  const out = history.filter((m) => m.content.trim());
  while (out[0]?.role === "assistant") out.shift();
  return out;
}

/** Run one agent turn and, once it has a problem + location, geocode it. */
export async function agentStep(history: Turn[], mode: "chat" | "voice"): Promise<AgentStep> {
  const msgs = normalize(history);
  if (!msgs.length) return { reply: "Hi! What would you like to report?", ready: false, draft: null };
  let turn: IntakeTurn;
  try {
    turn = await intakeTurn(msgs, mode);
  } catch (e) {
    return {
      reply: "Sorry, I'm having trouble on my end. Could you try again in a moment?",
      ready: false,
      draft: null,
      error: describeError(e),
    };
  }
  if (!turn.ready || !turn.problem) return { reply: turn.reply, ready: false, draft: null };

  const hit = await locate({
    query: turn.location,
    houseNumber: turn.house_number,
    street: turn.street,
    crossStreet: turn.cross_street,
    place: turn.place,
    city: turn.city,
  });
  if (!hit || !inBayArea(hit.lat, hit.lng)) {
    // Only reachable when we don't even know the city.
    return {
      reply: mode === "voice" ? "Which city in the Bay Area is that in?" : "Got it. Which Bay Area city is that in?",
      ready: false,
      draft: null,
    };
  }
  const where = hit.precision === "city" ? ` I've pinned it to ${hit.label} for now, and staff can refine the exact spot.` : "";
  return {
    reply: turn.reply + where,
    ready: true,
    draft: { text: turn.problem, location: turn.location, lat: hit.lat, lng: hit.lng, label: hit.label || turn.location },
  };
}

// --- Twilio phone + WhatsApp: conversations keyed by caller, filed automatically. ---

const g = globalThis as unknown as { __govConvos?: Map<string, { turns: Turn[]; at: number }> };
const convos = (g.__govConvos ??= new Map());

export async function phoneConversation(key: string, said: string, channel: Extract<Channel, "whatsapp" | "phone" | "imessage">, caller: string, user: User | null = null) {
  const c = convos.get(key) ?? { turns: [], at: Date.now() };
  if (Date.now() - c.at > 30 * 60_000) c.turns = [];
  c.at = Date.now();
  c.turns.push({ role: "user", content: said });
  const step = await agentStep(c.turns, channel === "phone" ? "voice" : "chat");
  c.turns.push({ role: "assistant", content: step.reply });
  convos.set(key, c);
  if (!step.ready || !step.draft) return { reply: step.reply, done: false };

  const d = step.draft;
  const { analysis, city, match } = await analyze(d.text, d.lat, d.lng, d.label);
  const { cluster, joined } = fileReport({
    user,
    authorName: user ? shortName(user.name) : `${{ phone: "Caller", whatsapp: "WhatsApp", imessage: "iMessage" }[channel]} ••${caller.replace(/\D/g, "").slice(-4) || caller.slice(0, 3)}`,
    channel,
    text: d.text,
    lat: d.lat,
    lng: d.lng,
    address: d.label,
    city,
    analysis,
    category: analysis.category,
    joinClusterId: match?.id ?? null,
  });
  convos.delete(key);
  const n = cluster.reportIds.length;
  const spanish = /[¿¡ñ]|\b(gracias|calle|está|reporte)\b/i.test(step.reply);
  const tail = spanish
    ? joined
      ? ` Eres la persona número ${n} en reportarlo, así que ya suma ${n} reportes. ¡Gracias!`
      : " Es el primer reporte de este problema, así que el equipo lo verá como nuevo. ¡Gracias!"
    : joined
      ? ` You're the ${ordinal(n)} person to report this, so it's now ${n} reports strong. Thank you!`
      : " It's the first report of this issue, so crews will see it as new. Thank you!";
  const track = process.env.PUBLIC_BASE_URL ? ` Track it: ${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/issue/${cluster.id}` : "";
  return { reply: `${step.reply}${tail}${channel === "phone" ? "" : track}`, done: true };
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[ch]!);
}

export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "Content-Type": "text/xml" } });
}

/**
 * Validate X-Twilio-Signature when TWILIO_AUTH_TOKEN and PUBLIC_BASE_URL are set.
 * Without them (local demo) every request is accepted.
 */
export function twilioSignatureOk(req: Request, path: string, params: URLSearchParams): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const base = process.env.PUBLIC_BASE_URL;
  if (!token || !base) return true;
  const url = base.replace(/\/$/, "") + path;
  const data = [...params.keys()].sort().reduce((acc, k) => acc + k + params.get(k), url);
  const expected = crypto.createHmac("sha1", token).update(data).digest("base64");
  const given = req.headers.get("x-twilio-signature") ?? "";
  return expected.length === given.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}
