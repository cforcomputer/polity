import { fail, json } from "@/lib/auth";
import { agentStep, type Turn } from "@/lib/channels";

/** In-app WhatsApp-style chat and voice call: one agent turn per request. */
export async function POST(req: Request) {
  const b = (await req.json()) as { messages?: Turn[]; mode?: "chat" | "voice" };
  const messages = (b.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length || messages.at(-1)!.role !== "user") return fail("Send a message first.");
  return json(await agentStep(messages, b.mode === "voice" ? "voice" : "chat"));
}
