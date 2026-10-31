"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Keyboard, MessageCircle, Mic, MicOff, Phone, PhoneOff, Send, ShieldCheck, Smartphone } from "lucide-react";
import { api, useSession } from "@/components/session";
import { ConfirmReport, type AnalyzeResponse } from "@/components/confirm-report";
import { createRecognizer, speak, speechSupported, stopSpeaking } from "@/components/speech";
import { Button, Card, cx } from "@/components/ui";
import { priorityLevel } from "@/lib/meta";
import type { Category } from "@/lib/types";

type Turn = { role: "user" | "assistant"; content: string };
type Draft = { text: string; location: string; lat: number; lng: number; label: string };
type AgentResp = { reply: string; ready: boolean; draft: Draft | null; error?: string };
type Filed = { cluster: { id: string; title: string; count: number }; joined: boolean };

const GREETING = "Hi 👋 I'm Sam from the Bay Area Civic Desk. Tell me about a problem in your neighborhood, or an idea to improve it, and I'll get it to the right team.";

export default function ChatPage() {
  const [mode, setMode] = useState<"imessage" | "whatsapp" | "voice">("imessage");
  const { user } = useSession();
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[400px_1fr]">
      <div>
        <div className="mb-4 flex rounded-xl border border-line bg-white p-1 text-sm font-medium">
          <button onClick={() => setMode("imessage")} className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg py-2", mode === "imessage" ? "bg-[#0a84ff] text-white" : "text-muted")}>
            <MessageCircle size={16} /> iMessage
          </button>
          <button onClick={() => setMode("whatsapp")} className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg py-2", mode === "whatsapp" ? "bg-wa text-white" : "text-muted")}>
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button onClick={() => setMode("voice")} className={cx("flex flex-1 items-center justify-center gap-2 rounded-lg py-2", mode === "voice" ? "bg-ink text-white" : "text-muted")}>
            <Phone size={16} /> Phone call
          </button>
        </div>
        <div className="mx-auto w-full max-w-[380px] rounded-[2.6rem] border-[10px] border-ink bg-ink shadow-2xl">
          <div className="h-[680px] overflow-hidden rounded-[2rem]">{mode === "imessage" ? <IMessage /> : mode === "whatsapp" ? <WhatsApp /> : <VoiceCall />}</div>
        </div>
      </div>

      <div className="space-y-5 lg:pt-14">
        <div>
          <div className="text-sm font-semibold text-brand">Conversational intake</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Talk to Sam, no app or form needed</h1>
          <p className="mt-3 max-w-xl leading-relaxed text-muted">
            Sam is Polity&apos;s AI intake agent, powered by Claude Sonnet. Residents describe the problem in their own words, in any language. Sam asks short follow-up questions until it knows <em>what</em> and <em>where</em>, then files it through the same triage as the web form, including the check for similar reports.
          </p>
        </div>
        {!user && (
          <Card className="flex items-start gap-3 border-unigov/30 bg-unigov-soft/40 p-4">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-unigov" />
            <div className="text-sm">
              You can chat without signing in, but filing needs a verified resident.{" "}
              <Link href="/unigov/login?next=/chat" className="font-medium text-unigov">Sign in with UniGov</Link>, or use <span className="font-medium">Citizen</span> in the demo controls.
            </div>
          </Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center gap-2 font-semibold">
              <MessageCircle size={17} className="text-[#25d366]" /> Try these
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>“There&apos;s a huge pothole on 880 by High Street”</li>
              <li>“Los semáforos en International Blvd y 23rd no funcionan”</li>
              <li>“I have an idea for more bike parking at Fruitvale BART”</li>
              <li>“The sidewalk near my house is broken and I use a wheelchair”</li>
            </ul>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 font-semibold">
              <Smartphone size={17} className="text-brand" /> Real channels
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">The iMessage tab is live through Photon: Sam answers real iMessages and texts you when your issue moves. The same agent also has Twilio webhooks for WhatsApp and phone calls:</p>
            <code className="mt-2 block rounded-lg bg-canvas px-2.5 py-1.5 text-xs">POST /api/channels/whatsapp</code>
            <code className="mt-1.5 block rounded-lg bg-canvas px-2.5 py-1.5 text-xs">POST /api/channels/voice</code>
            <p className="mt-2 text-xs text-muted">Callers get a speech-to-text phone line with a synthesized voice; reports are filed automatically.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Shared: analyze a finished draft, then file it with the resident's choices. */
function useFiling() {
  const { user, refresh } = useSession();
  async function analyze(d: Draft) {
    return api<AnalyzeResponse>("/api/reports/analyze", { text: d.text, lat: d.lat, lng: d.lng, address: d.label });
  }
  async function file(d: Draft, r: AnalyzeResponse, category: Category, joinClusterId: string | null, channel: "chat" | "voice") {
    const res = await api<Filed>("/api/reports", { text: d.text, lat: d.lat, lng: d.lng, address: d.label, city: r.city, analysis: r.analysis, category, joinClusterId, channel });
    refresh();
    return res;
  }
  return { user, analyze, file, canFile: !!user?.verified };
}

function filedMessage(f: Filed): string {
  const n = f.cluster.count;
  return f.joined
    ? `Done ✅ I added your report to “${f.cluster.title}”. You're one of ${n} neighbors who reported it, which moves it up the queue. I'll message you here when there's an update.`
    : `Done ✅ I filed “${f.cluster.title}” as a new issue. You're the first to report it. I'll message you here when there's an update.`;
}

// ---------------------------------------------------------------------------
// WhatsApp-style chat
// ---------------------------------------------------------------------------

type ChatItem =
  | { id: number; kind: "msg"; role: "user" | "assistant"; text: string; at: string }
  | { id: number; kind: "confirm"; draft: Draft; result: AnalyzeResponse | null; error?: string; done?: boolean }
  | { id: number; kind: "signin" }
  | { id: number; kind: "link"; href: string; label: string };

type NewChatItem = ChatItem extends infer T ? (T extends ChatItem ? Omit<T, "id"> : never) : never;

function now() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function WhatsApp() {
  const { analyze, file, canFile } = useFiling();
  const [items, setItems] = useState<ChatItem[]>([{ id: 0, kind: "msg", role: "assistant", text: GREETING, at: "" }]);
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [filing, setFiling] = useState(false);
  const [listening, setListening] = useState(false);
  const nextId = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);

  const push = (item: NewChatItem) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { ...item, id } as ChatItem]);
    return id;
  };
  const patch = (id: number, p: Partial<ChatItem>) => setItems((prev) => prev.map((x) => (x.id === id ? ({ ...x, ...p } as ChatItem) : x)));

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items, typing]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || typing) return;
    setInput("");
    push({ kind: "msg", role: "user", text: t, at: now() });
    const history: Turn[] = [...turns, { role: "user", content: t }];
    setTurns(history);
    setTyping(true);
    try {
      const r = await api<AgentResp>("/api/chat", { messages: history, mode: "chat" });
      setTyping(false);
      push({ kind: "msg", role: "assistant", text: r.reply, at: now() });
      setTurns([...history, { role: "assistant", content: r.reply }]);
      if (r.ready && r.draft) startFiling(r.draft);
    } catch (e) {
      setTyping(false);
      push({ kind: "msg", role: "assistant", text: `Sorry, something went wrong (${(e as Error).message}).`, at: now() });
    }
  }

  async function startFiling(d: Draft) {
    if (!canFile) {
      push({ kind: "signin" });
      return;
    }
    const id = push({ kind: "confirm", draft: d, result: null });
    try {
      patch(id, { result: await analyze(d) } as Partial<ChatItem>);
    } catch (e) {
      patch(id, { error: (e as Error).message } as Partial<ChatItem>);
    }
  }

  async function confirm(id: number, d: Draft, r: AnalyzeResponse, category: Category, join: string | null) {
    setFiling(true);
    try {
      const f = await file(d, r, category, join, "chat");
      patch(id, { done: true } as Partial<ChatItem>);
      push({ kind: "msg", role: "assistant", text: filedMessage(f), at: now() });
      push({ kind: "link", href: `/issue/${f.cluster.id}`, label: "Track this issue" });
      // Start a fresh agent conversation for the next report.
      const follow = "Anything else I can help with?";
      push({ kind: "msg", role: "assistant", text: follow, at: now() });
      setTurns([{ role: "assistant", content: follow }]);
    } catch (e) {
      push({ kind: "msg", role: "assistant", text: `I couldn't file that: ${(e as Error).message}`, at: now() });
    } finally {
      setFiling(false);
    }
  }

  function voiceNote() {
    if (listening) return;
    const rec = createRecognizer();
    if (!rec) return;
    rec.interimResults = true;
    setListening(true);
    let finalText = "";
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      finalText = txt;
      setInput(txt);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) send(finalText);
    };
    rec.onerror = () => setListening(false);
    rec.start();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 bg-wa px-4 pb-3 pt-8 text-white">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/20 text-sm font-semibold">S</div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight">Sam · Bay Area Civic Desk</div>
          <div className="text-xs text-white/75">{typing ? "typing…" : "online"}</div>
        </div>
        <Phone size={18} className="opacity-80" />
      </div>
      <div ref={scroller} className="wa-wallpaper flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <div className="mx-auto w-fit rounded-md bg-[#fff5c4] px-2.5 py-1 text-center text-[11px] text-slate-600 shadow-sm">Messages are processed by an AI assistant for your local government</div>
        {items.map((it) => {
          if (it.kind === "msg")
            return (
              <div key={it.id} className={cx("flex", it.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cx("max-w-[82%] rounded-lg px-2.5 py-1.5 text-[14px] leading-snug shadow-sm", it.role === "user" ? "rounded-tr-none bg-wa-bubble" : "rounded-tl-none bg-white")}>
                  {it.text}
                  <span className="float-right ml-2 mt-1.5 flex items-center gap-0.5 text-[10px] text-slate-500">
                    {it.at}
                    {it.role === "user" && <CheckCheck size={13} className="text-sky-500" />}
                  </span>
                </div>
              </div>
            );
          if (it.kind === "signin")
            return (
              <div key={it.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                To file this I need to confirm you&apos;re a Bay Area resident.
                <Link href="/unigov/login?next=/chat" className="mt-2 flex h-8 items-center justify-center gap-1.5 rounded-md bg-unigov text-xs font-medium text-white">
                  <ShieldCheck size={14} /> Verify with UniGov
                </Link>
              </div>
            );
          if (it.kind === "link")
            return (
              <div key={it.id} className="flex justify-start">
                <Link href={it.href} className="rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm font-medium text-wa shadow-sm underline">
                  {it.label} →
                </Link>
              </div>
            );
          return (
            <div key={it.id} className="rounded-lg bg-white p-3 shadow-sm">
              {it.done ? (
                <div className="flex items-center gap-2 text-sm font-medium text-green-700">
                  <Check size={16} /> Report confirmed
                </div>
              ) : it.error ? (
                <div className="text-sm text-red-700">{it.error}</div>
              ) : it.result ? (
                <ConfirmReport compact result={it.result} text={it.draft.text} address={it.draft.label} filing={filing} onConfirm={(cat, join) => confirm(it.id, it.draft, it.result!, cat, join)} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-wa" /> Checking category, priority and similar reports…
                </div>
              )}
            </div>
          );
        })}
        {typing && (
          <div className="flex">
            <div className="flex gap-1 rounded-lg rounded-tl-none bg-white px-3 py-2.5 shadow-sm">
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 bg-[#f0f0f0] px-2 py-2"
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Listening…" : "Message"} className="h-10 flex-1 rounded-full bg-white px-4 text-sm focus:outline-none" />
        {input.trim() ? (
          <button className="grid h-10 w-10 place-items-center rounded-full bg-wa text-white" aria-label="Send">
            <Send size={17} />
          </button>
        ) : (
          <button type="button" onClick={voiceNote} className={cx("grid h-10 w-10 place-items-center rounded-full text-white", listening ? "animate-pulse-ring bg-red-600" : "bg-wa")} aria-label="Voice note">
            <Mic size={17} />
          </button>
        )}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice call: browser speech-to-text in, synthesized voice out.
// ---------------------------------------------------------------------------

type CallState = "idle" | "speaking" | "listening" | "thinking" | "ended";

function listenOnce(onInterim: (t: string) => void): Promise<string> {
  return new Promise((resolve) => {
    const rec = createRecognizer();
    if (!rec) return resolve("");
    rec.interimResults = true;
    rec.continuous = false;
    let text = "";
    rec.onresult = (e) => {
      text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onInterim(text);
    };
    rec.onend = () => resolve(text.trim());
    rec.onerror = () => resolve(text.trim());
    rec.start();
  });
}

function VoiceCall() {
  const { analyze, file, canFile } = useFiling();
  const [state, setState] = useState<CallState>("idle");
  const [lines, setLines] = useState<{ who: "sam" | "you"; text: string }[]>([]);
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [typed, setTyped] = useState("");
  const [typeMode, setTypeMode] = useState(false);
  const [confirm, setConfirm] = useState<{ draft: Draft; result: AnalyzeResponse } | null>(null);
  const active = useRef(false);
  const typedResolver = useRef<((s: string) => void) | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === "idle" || state === "ended") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, interim]);
  useEffect(() => () => {
    active.current = false;
    stopSpeaking();
  }, []);

  async function say(text: string) {
    if (!active.current) return;
    setLines((l) => [...l, { who: "sam", text }]);
    setState("speaking");
    await speak(text);
  }

  async function hear(): Promise<string> {
    if (!active.current) return "";
    setState("listening");
    setInterim("");
    let heard: string;
    if (typeMode || !speechSupported()) {
      heard = await new Promise<string>((res) => (typedResolver.current = res));
    } else {
      heard = await listenOnce(setInterim);
    }
    setInterim("");
    if (heard && active.current) setLines((l) => [...l, { who: "you", text: heard }]);
    return heard;
  }

  async function start() {
    active.current = true;
    setLines([]);
    setSeconds(0);
    setConfirm(null);
    const greeting = "Hi, this is Sam from the Bay Area Civic Desk. This call is transcribed. What would you like to report today?";
    const history: Turn[] = [{ role: "assistant", content: greeting }];
    await say(greeting);
    let silences = 0;
    while (active.current) {
      const heard = await hear();
      if (!active.current) break;
      if (!heard) {
        if (++silences >= 3) {
          await say("I didn't hear anything, so I'll hang up now. Call back any time. Goodbye.");
          break;
        }
        await say("Sorry, I didn't catch that. Could you say it again?");
        continue;
      }
      silences = 0;
      history.push({ role: "user", content: heard });
      setState("thinking");
      const r = await api<AgentResp>("/api/chat", { messages: history, mode: "voice" }).catch(() => null);
      if (!r) {
        await say("Sorry, I'm having trouble on my end. Please try again later.");
        break;
      }
      history.push({ role: "assistant", content: r.reply });
      await say(r.reply);
      if (r.ready && r.draft) {
        await finish(r.draft);
        break;
      }
    }
    hangUp();
  }

  async function finish(d: Draft) {
    if (!canFile) {
      await say("To file this, please sign in with UniGov on your screen, and then call back. Thank you!");
      return;
    }
    setState("thinking");
    const r = await analyze(d).catch(() => null);
    if (!r) return say("Sorry, I couldn't file that right now. Please try again later.");
    setConfirm({ draft: d, result: r });
    const cat = r.analysis.category.replace("&", "and");
    let join: string | null = null;
    if (r.match) {
      const n = r.match.count;
      await say(`I'd file this under ${cat}. ${n} ${n === 1 ? "neighbor has" : "neighbors have"} already reported what sounds like the same problem: ${r.match.title}. Should I add your report to theirs? Please say yes or no.`);
      const ans = (await hear()).toLowerCase();
      join = /\b(yes|yeah|yep|sure|ok|okay|correct|please|sí|si)\b/.test(ans) ? r.match.id : null;
    }
    setState("thinking");
    const f = await file(d, r, r.analysis.category, join, "voice").catch(() => null);
    setConfirm(null);
    if (!f) return say("Sorry, I couldn't file that right now. Please try again later.");
    const level = priorityLevel(r.analysis.priority).label.toLowerCase();
    await say(
      f.joined
        ? `Done. Your report is added. ${f.cluster.count} residents have now reported it, and it's marked ${level} priority. We'll notify you when there's an update. Goodbye!`
        : `Done. I filed it as a new ${cat} issue with ${level} priority, routed to ${r.analysis.department}. We'll notify you when there's an update. Goodbye!`,
    );
  }

  function hangUp() {
    active.current = false;
    stopSpeaking();
    typedResolver.current?.("");
    setState("ended");
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const inCall = state !== "idle" && state !== "ended";

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#1b2540] to-[#0b1022] text-white">
      <div className="px-6 pt-12 text-center">
        <div className={cx("mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/10 text-3xl font-semibold", state === "speaking" && "animate-pulse-ring")}>S</div>
        <div className="mt-4 text-xl font-semibold">Bay Area Civic Desk</div>
        <div className="mt-1 text-sm text-white/60">
          {state === "idle" && "(415) 555-0311 · Polity"}
          {state === "ended" && "Call ended"}
          {inCall && `${mm}:${ss} · ${{ speaking: "Sam is speaking…", listening: "Listening…", thinking: "One moment…" }[state as "speaking" | "listening" | "thinking"]}`}
        </div>
      </div>

      <div ref={scroller} className="mx-4 mt-5 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-white/5 p-3 text-sm">
        {lines.length === 0 && (
          <div className="p-4 text-center text-white/50">
            {speechSupported() ? "Press call and speak naturally. Sam answers with a synthesized voice and the live transcript appears here." : "Your browser can't do speech recognition, so you'll type your side of the call."}
          </div>
        )}
        {lines.map((l, i) => (
          <div key={i} className={cx("leading-snug", l.who === "you" ? "text-right text-sky-200" : "text-white/90")}>
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-60">{l.who === "you" ? "You" : "Sam"}</span>
            <div>{l.text}</div>
          </div>
        ))}
        {interim && <div className="text-right italic text-sky-200/70">{interim}…</div>}
        {confirm && (
          <div className="rounded-xl bg-white p-3 text-ink">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Filing</div>
            <div className="mt-0.5 font-semibold leading-snug">{confirm.result.analysis.title}</div>
            <div className="mt-1 text-xs text-muted">
              {confirm.result.analysis.category} · {priorityLevel(confirm.result.analysis.priority).label} priority · {confirm.result.analysis.department}
            </div>
            {confirm.result.match && (
              <div className="mt-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs text-brand">
                Similar: “{confirm.result.match.title}” ({confirm.result.match.count} reports). Say yes to join.
              </div>
            )}
          </div>
        )}
      </div>

      {inCall && (typeMode || !speechSupported()) && state === "listening" && (
        <form
          className="mx-4 mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            typedResolver.current?.(typed);
            setTyped("");
          }}
        >
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus placeholder="Type what you'd say…" className="h-10 flex-1 rounded-full bg-white/10 px-4 text-sm text-white placeholder:text-white/40 focus:outline-none" />
          <button className="grid h-10 w-10 place-items-center rounded-full bg-white/20">
            <Send size={16} />
          </button>
        </form>
      )}

      <div className="flex items-center justify-center gap-6 pb-10 pt-5">
        {inCall && speechSupported() && (
          <button onClick={() => setTypeMode((t) => !t)} className="grid h-12 w-12 place-items-center rounded-full bg-white/10 hover:bg-white/20" title={typeMode ? "Speak instead" : "Type instead"}>
            {typeMode ? <Mic size={20} /> : <Keyboard size={20} />}
          </button>
        )}
        {inCall ? (
          <button onClick={hangUp} className="grid h-16 w-16 place-items-center rounded-full bg-red-600 shadow-lg hover:bg-red-700" aria-label="Hang up">
            <PhoneOff size={26} />
          </button>
        ) : (
          <button onClick={start} className="grid h-16 w-16 place-items-center rounded-full bg-green-500 shadow-lg hover:bg-green-600" aria-label="Call">
            <Phone size={26} />
          </button>
        )}
        {inCall && (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/60" title="Microphone">
            {state === "listening" && !typeMode ? <Mic size={20} className="text-green-400" /> : <MicOff size={20} />}
          </div>
        )}
      </div>
      {state === "ended" && (
        <div className="-mt-6 pb-6 text-center">
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={start}>
            Call again
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// iMessage via Photon: assign the resident a line to Sam, then they text it.
// ---------------------------------------------------------------------------

function IMessage() {
  const { user, toast } = useSession();
  const [info, setInfo] = useState<{ configured: boolean; enrollment: { handle: string; agentNumber: string; active: boolean } | null } | null>(null);
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/imessage")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo({ configured: false, enrollment: null }));
  }, [user?.id]);

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api<{ handle: string; agentNumber: string }>("/api/imessage", { handle });
      setInfo({ configured: true, enrollment: { ...r, active: false } });
    } catch (err) {
      toast({ title: "Couldn't set up iMessage", body: (err as Error).message, tone: "warn" });
    } finally {
      setBusy(false);
    }
  }

  const en = info?.enrollment;
  const pretty = (n: string) => n.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "+1 ($1) $2-$3");

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-slate-200 bg-[#f6f6f6] px-4 pb-3 pt-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-slate-400 to-slate-500 text-lg font-semibold text-white">S</div>
        <div className="mt-1 text-xs font-medium">Sam · Bay Area Civic Desk</div>
        <div className="text-[10px] text-slate-500">iMessage</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4 text-[14px]">
        <Bubble>Hi! I&apos;m Sam. Text me about a problem or an idea for your neighborhood, right from Messages. 💬</Bubble>
        {!info && <div className="p-4 text-center text-sm text-slate-400">Loading…</div>}
        {info && !info.configured && <Bubble>iMessage isn&apos;t switched on for this server yet.</Bubble>}
        {info?.configured && !user?.verified && (
          <div className="mx-2 rounded-2xl border border-slate-200 p-4 text-sm">
            First, verify you&apos;re a Bay Area resident so I can file reports for you.
            <Link href="/unigov/login?next=/chat" className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-unigov text-sm font-medium text-white">
              <ShieldCheck size={15} /> Sign in with UniGov
            </Link>
          </div>
        )}
        {info?.configured && user?.verified && !en && (
          <form onSubmit={enroll} className="mx-2 space-y-2 rounded-2xl border border-slate-200 p-4 text-sm">
            <div className="font-medium">Get your line to Sam</div>
            <p className="text-xs leading-relaxed text-slate-500">Enter the phone number or Apple ID email you send iMessages from. Only that sender can reach your line.</p>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="+1 415 555 0123 or you@icloud.com" className="h-10 w-full rounded-xl border border-slate-200 px-3 focus:border-[#0a84ff] focus:outline-none" />
            <Button className="w-full !bg-[#0a84ff]" loading={busy} disabled={!handle.trim()}>
              Assign my iMessage line
            </Button>
          </form>
        )}
        {en && (
          <>
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#0a84ff] px-3 py-2 text-white">I&apos;ll text from {en.handle}</div>
            </div>
            <Bubble>
              Perfect. Text me at <span className="font-semibold">{pretty(en.agentNumber)}</span> from {en.handle}. Start a new conversation and make sure it&apos;s blue (iMessage), not green.
            </Bubble>
            <div className="mx-2 rounded-2xl bg-[#f2f2f7] p-4 text-center">
              <div className="text-xs text-slate-500">Your line to Sam</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{pretty(en.agentNumber)}</div>
              <a href={`sms:${en.agentNumber}&body=${encodeURIComponent("Hi Sam, I want to report something")}`} className="mt-3 flex h-10 items-center justify-center rounded-xl bg-[#0a84ff] text-sm font-medium text-white">
                Open in Messages
              </a>
              <div className="mt-2 text-[11px] text-slate-500">{en.active ? "Connected: Sam will also text you updates on your reports." : "Waiting for your first message…"}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%] rounded-2xl rounded-bl-md bg-[#e9e9eb] px-3 py-2 leading-snug text-black">{children}</div>
    </div>
  );
}
