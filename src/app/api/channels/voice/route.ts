import { escapeXml, phoneConversation, twilioSignatureOk, twiml } from "@/lib/channels";

const VOICE = 'voice="Polly.Matthew"';
const gather = (prompt: string) =>
  `<Gather input="speech" action="/api/channels/voice" method="POST" speechTimeout="auto" language="en-US"><Say ${VOICE}>${escapeXml(prompt)}</Say></Gather>` +
  `<Say ${VOICE}>I didn't catch that. Please call back any time. Goodbye.</Say>`;

/**
 * Twilio Voice webhook. Set your number's "A call comes in" URL to
 * https://<public-host>/api/channels/voice (HTTP POST).
 */
export async function POST(req: Request) {
  const params = new URLSearchParams(await req.text());
  if (!twilioSignatureOk(req, "/api/channels/voice", params)) return new Response("Forbidden", { status: 403 });
  const callSid = params.get("CallSid") ?? "call";
  const speech = params.get("SpeechResult")?.trim();
  if (!speech) {
    return twiml(gather("Hi, this is Sam from the Bay Area Civic Desk. This call is transcribed. What problem or idea would you like to report?"));
  }
  const { reply, done } = await phoneConversation(`call:${callSid}`, speech, "phone", params.get("From") ?? "");
  return done ? twiml(`<Say ${VOICE}>${escapeXml(reply)} Goodbye.</Say><Hangup/>`) : twiml(gather(reply));
}
