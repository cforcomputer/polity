import { escapeXml, phoneConversation, twilioSignatureOk, twiml } from "@/lib/channels";

/**
 * Twilio WhatsApp webhook. Point your WhatsApp sender's "A message comes in" URL at
 * https://<public-host>/api/channels/whatsapp (HTTP POST).
 */
export async function POST(req: Request) {
  const params = new URLSearchParams(await req.text());
  if (!twilioSignatureOk(req, "/api/channels/whatsapp", params)) return new Response("Forbidden", { status: 403 });
  const from = params.get("From") ?? "unknown";
  const body = params.get("Body")?.trim() ?? "";
  if (!body) return twiml(`<Message>Hi! I'm Sam from the Bay Area Civic Desk. What would you like to report?</Message>`);
  const { reply } = await phoneConversation(`wa:${from}`, body, "whatsapp", from);
  return twiml(`<Message>${escapeXml(reply)}</Message>`);
}
