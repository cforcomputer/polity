import { db, save } from "./db";
import { phoneConversation } from "./channels";

// Photon (Beta 2.0) iMessage: https://photon.codes/docs/beta
// Shared lines: each resident's handle is assigned an agent number from Photon's pool.
// Inbound messages are polled (the documented pattern without a public webhook), and
// replies go back through POST /messages in the same Space.

const BASE = "https://api.photon.codes/v1";
const KEY = () => process.env.PHOTON_API_KEY ?? process.env.photon_api;
const PROJECT = () => process.env.PHOTON_PROJECT_ID;

export function photonConfigured(): boolean {
  return Boolean(KEY() && PROJECT());
}

export class PhotonError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${BASE}/projects/${PROJECT()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new PhotonError(res.status, data.code ?? "UNKNOWN", data.detail ?? data.title ?? `Photon ${res.status}`);
  return data as T;
}

/** Normalize what a resident types into an iMessage handle: E.164 phone or Apple ID email. */
export function normalizeHandle(input: string): string | null {
  const s = input.trim();
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)) return s.toLowerCase();
  const digits = s.replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{6,14}$/.test(digits)) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+1${bare}`;
  if (bare.length === 11 && bare.startsWith("1")) return `+${bare}`;
  return null;
}

interface Assignment {
  assignmentId: string;
  assignedPhoneNumber: string;
  handle: string;
  releasedAt?: string;
}

/** Assign (or look up) the shared-line agent number for a resident's handle. */
export async function enroll(handle: string): Promise<string> {
  const existing = await findAssignment(handle);
  if (existing) return existing.assignedPhoneNumber;
  const a = await call<Assignment>("POST", "/platforms/imessage/assignments", { handle }, { "Idempotency-Key": `polity-assign:${handle}` });
  return a.assignedPhoneNumber;
}

async function findAssignment(handle: string): Promise<Assignment | null> {
  let token: string | undefined;
  do {
    const page = await call<{ assignments: Assignment[]; nextPageToken?: string }>(
      "GET",
      `/platforms/imessage/assignments?pageSize=200${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`,
    );
    const hit = page.assignments.find((a) => a.handle.toLowerCase() === handle.toLowerCase() && !a.releasedAt);
    if (hit) return hit;
    token = page.nextPageToken;
  } while (token);
  return null;
}

interface Snapshot {
  id: string;
  handle: string;
  kind: "human" | "agent";
}

interface InboundMessage {
  id: string;
  platform: string;
  status: string;
  createdAt: string;
  sentBy: Snapshot;
  receivedBy?: Snapshot;
  space: { id: string; kind: string };
  content: { type: string; format?: string; text?: string };
}

export async function sendText(spaceId: string, senderId: string, text: string, key: string, parentMessageId?: string): Promise<void> {
  await call("POST", "/messages", { spaceId, senderId, ...(parentMessageId ? { parentMessageId } : {}), content: { type: "text", format: "plain", text } }, { "idempotency-key": key });
}

async function typing(spaceId: string, senderId: string, on: boolean): Promise<void> {
  await call("POST", `/spaces/${spaceId}/typing`, { senderId, typing: on }).catch(() => {});
}

/** Handle one inbound iMessage: run Sam, reply in the same thread, remember the thread for updates. */
async function handle(m: InboundMessage): Promise<void> {
  const text = m.content.type === "text" ? m.content.text?.trim() : "";
  const agent = m.receivedBy;
  if (!agent || m.sentBy.kind !== "human" || m.space.kind !== "direct") return;
  if (!text) {
    await sendText(m.space.id, agent.id, "I can only read text for now. Could you describe the issue in words?", `gov-reply:${m.id}`, m.id);
    return;
  }
  const store = db();
  const user = store.users.find((u) => u.imessage?.handle.toLowerCase() === m.sentBy.handle.toLowerCase()) ?? null;
  if (user?.imessage) {
    user.imessage.spaceId = m.space.id;
    user.imessage.agentUserId = agent.id;
    save();
  }
  await typing(m.space.id, agent.id, true);
  try {
    const { reply } = await phoneConversation(`im:${m.sentBy.handle}`, text, "imessage", m.sentBy.handle, user);
    await sendText(m.space.id, agent.id, reply, `gov-reply:${m.id}`, m.id);
  } finally {
    await typing(m.space.id, agent.id, false);
  }
}

const g = globalThis as unknown as { __govPhoton?: boolean };

/** Poll Photon for new inbound iMessages every few seconds. Started once per server process. */
export function startPhotonPoller(): void {
  if (g.__govPhoton || !photonConfigured()) return;
  g.__govPhoton = true;
  let delay = 2500;
  const loop = async () => {
    try {
      await pollOnce();
      delay = 2500;
    } catch (e) {
      const status = e instanceof PhotonError ? e.status : 0;
      // Back off on rate limits and outages; a bad key or project just logs slowly.
      delay = status === 429 ? 30_000 : Math.min(delay * 2, 60_000);
      console.error("[photon]", e instanceof Error ? e.message : e);
    }
    setTimeout(loop, delay);
  };
  setTimeout(loop, 1000);
}

async function pollOnce(): Promise<void> {
  const store = db();
  const state = (store.photon ??= { since: new Date(Date.now() - 60_000).toISOString(), seen: [] });
  const seen = new Set(state.seen);
  // Re-read a short overlap window: listing is eventually consistent.
  const since = new Date(new Date(state.since).getTime() - 30_000).toISOString();
  let token: string | undefined;
  const fresh: InboundMessage[] = [];
  do {
    const q = new URLSearchParams({ createdSince: since, direction: "received", platform: "imessage", order: "asc", pageSize: "100" });
    if (token) q.set("pageToken", token);
    const page = await call<{ items: InboundMessage[]; nextPageToken?: string }>("GET", `/messages?${q}`);
    for (const m of page.items) if (m.status === "received" && !seen.has(m.id)) fresh.push(m);
    token = page.items.length ? page.nextPageToken : undefined;
  } while (token);

  for (const m of fresh) {
    state.seen.push(m.id);
    if (m.createdAt > state.since) state.since = m.createdAt;
    save();
    // Each conversation is handled in order; different senders could run in parallel, but volume is low.
    await handle(m).catch((e) => console.error("[photon] reply failed", m.id, e instanceof Error ? e.message : e));
  }
  state.seen = state.seen.slice(-500);
}

/** Text a resident about an issue update, if they have talked to Sam on iMessage before. */
export function notifyByImessage(userId: string, text: string, key: string): void {
  if (!photonConfigured()) return;
  const u = db().users.find((x) => x.id === userId);
  const im = u?.imessage;
  if (!im?.spaceId || !im.agentUserId) return;
  sendText(im.spaceId, im.agentUserId, text, key).catch((e) => console.error("[photon] notify failed", e instanceof Error ? e.message : e));
}
