"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Crosshair, Loader2, MapPin, Mic, MicOff, Search, Sparkles, Users } from "lucide-react";
import { api, useLive, useSession } from "@/components/session";
import { VerifiedGate } from "@/components/gate";
import { LocationPicker } from "@/components/map";
import { ConfirmReport, type AnalyzeResponse } from "@/components/confirm-report";
import { createRecognizer, speechSupported, type SpeechRec } from "@/components/speech";
import { Button, Card, cx } from "@/components/ui";
import { inBayArea } from "@/lib/geo";
import type { Category, PublicCluster } from "@/lib/types";

const EXAMPLES = [
  "Huge pothole in the right lane that's been there for weeks, cars swerve into the next lane to avoid it.",
  "The crosswalk signal is too short, my elderly neighbor can't make it across before the light changes.",
  "Idea: turn the empty lot next to the library into a community garden.",
  "Someone dumped a mattress and paint cans on the sidewalk, it's blocking strollers.",
];

export default function ReportPage() {
  return (
    <VerifiedGate next="/report">
      <ReportFlow />
    </VerifiedGate>
  );
}

type Phase = "compose" | "analyzing" | "confirm" | "filing" | "done";

function ReportFlow() {
  const { refresh, toast } = useSession();
  const [text, setText] = useState("");
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [phase, setPhase] = useState<Phase>("compose");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filed, setFiled] = useState<{ clusterId: string; title: string; count: number; joined: boolean } | null>(null);
  const [usedVoice, setUsedVoice] = useState(false);
  const { data } = useLive<{ clusters: PublicCluster[] }>("/api/clusters");

  // Reverse-geocode the pin into a readable address.
  useEffect(() => {
    if (!loc) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/geocode?lat=${loc.lat}&lng=${loc.lng}`).then((x) => x.json());
      setAddress(r.label ?? "");
    }, 400);
    return () => clearTimeout(t);
  }, [loc]);

  function useMyLocation() {
    if (!navigator.geolocation) return setError("Your browser can't share location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        if (!inBayArea(p.coords.latitude, p.coords.longitude)) return setError("You appear to be outside the Bay Area. Drop a pin on the map instead.");
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        setLocating(false);
        setError("Couldn't get your location. Drop a pin on the map instead.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function analyze() {
    setError(null);
    if (text.trim().length < 8) return setError("Describe the issue in a few more words.");
    if (!loc) return setError("Set the location: search, use your location, or click the map.");
    setPhase("analyzing");
    try {
      const r = await api<AnalyzeResponse>("/api/reports/analyze", { text, lat: loc.lat, lng: loc.lng, address });
      setResult(r);
      setPhase("confirm");
    } catch (e) {
      setError((e as Error).message);
      setPhase("compose");
    }
  }

  async function file(category: Category, joinClusterId: string | null) {
    if (!result || !loc) return;
    setPhase("filing");
    try {
      const r = await api<{ cluster: { id: string; title: string; count: number }; joined: boolean }>("/api/reports", {
        text,
        lat: loc.lat,
        lng: loc.lng,
        address,
        city: result.city,
        analysis: result.analysis,
        category,
        joinClusterId,
        channel: usedVoice ? "voice" : "web",
      });
      setFiled({ clusterId: r.cluster.id, title: r.cluster.title, count: r.cluster.count, joined: r.joined });
      setPhase("done");
      refresh();
    } catch (e) {
      toast({ title: "Couldn't file the report", body: (e as Error).message, tone: "warn" });
      setPhase("confirm");
    }
  }

  if (phase === "done" && filed) return <Done filed={filed} onAgain={() => { setText(""); setLoc(null); setAddress(""); setResult(null); setFiled(null); setPhase("compose"); }} />;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[440px_1fr]">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Report an issue</h1>
          <p className="mt-1 text-sm text-muted">A problem, a recommendation or an idea, anywhere in the Bay Area.</p>
        </div>

        <Card className="p-5">
          <StepLabel n={1} label="What's going on?" />
          <Dictation text={text} setText={setText} onUsed={() => setUsedVoice(true)} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button key={e} onClick={() => setText(e)} className="rounded-full border border-line px-2.5 py-1 text-left text-xs text-muted hover:bg-slate-50">
                {e.length > 46 ? e.slice(0, 44) + "…" : e}
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <StepLabel n={2} label="Where is it?" />
          <AddressSearch onPick={(lat, lng, label) => { setLoc({ lat, lng }); setAddress(label); }} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button onClick={useMyLocation} className="flex items-center gap-1.5 text-sm font-medium text-brand">
              {locating ? <Loader2 size={15} className="animate-spin" /> : <Crosshair size={15} />} Use my location
            </button>
            <span className="text-xs text-muted">or click the map</span>
          </div>
          <div className={cx("mt-3 flex items-start gap-2 rounded-lg p-2.5 text-sm", loc ? "bg-brand-soft/60" : "bg-canvas text-muted")}>
            <MapPin size={15} className={cx("mt-0.5 shrink-0", loc ? "text-brand" : "")} />
            {loc ? address || "Finding address…" : "No location set yet"}
          </div>
        </Card>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <Button size="lg" className="w-full" onClick={analyze} loading={phase === "analyzing"}>
          {phase === "analyzing" ? "Claude is analyzing your report…" : (
            <>
              <Sparkles size={18} /> Analyze and continue
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted">Claude suggests a category, priority and similar reports. You confirm before anything is filed.</p>
      </div>

      <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-line lg:min-h-0">
        <LocationPicker value={loc} onChange={(lat, lng) => { if (inBayArea(lat, lng)) setLoc({ lat, lng }); else setError("That spot is outside the Bay Area."); }} nearby={data?.clusters ?? []} className="absolute inset-0" />
        {!loc && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full bg-ink/85 px-4 py-2 text-sm text-white shadow-lg">Click the map to drop a pin</div>
        )}
      </div>

      {(phase === "confirm" || phase === "filing") && result && (
        <div className="fixed inset-0 z-[1700] grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
          <Card className="animate-pop-in max-h-[92vh] w-full max-w-xl overflow-y-auto p-6">
            <h2 className="mb-4 text-lg font-semibold">Confirm your report</h2>
            <ConfirmReport result={result} text={text} address={address} filing={phase === "filing"} onBack={() => setPhase("compose")} onConfirm={file} />
          </Card>
        </div>
      )}
    </div>
  );
}

function StepLabel({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-xs font-semibold text-white">{n}</span>
      <span className="font-semibold">{label}</span>
    </div>
  );
}

function Dictation({ text, setText, onUsed }: { text: string; setText: (s: string) => void; onUsed: () => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const base = useRef("");
  useEffect(() => setSupported(speechSupported()), []);

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = createRecognizer();
    if (!r) return;
    r.continuous = true;
    r.interimResults = true;
    base.current = text ? text.trimEnd() + " " : "";
    r.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setText(base.current + finalText + interim);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    onUsed();
    setListening(true);
  }

  return (
    <div className="relative">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Describe it in your own words, in any language. For example: the streetlights on my block have been out for two weeks and people walk here at night."
        className="w-full resize-none rounded-xl border border-line p-3 pr-14 text-[15px] leading-relaxed placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
      />
      {supported && (
        <button
          onClick={toggle}
          className={cx("absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full text-white shadow", listening ? "animate-pulse-ring bg-red-600" : "bg-brand hover:bg-brand-hover")}
          title={listening ? "Stop dictation" : "Dictate with your voice"}
        >
          {listening ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
      )}
      {listening && <div className="mt-1.5 text-xs font-medium text-red-600">Listening… speak naturally, then tap to stop.</div>}
    </div>
  );
}

function AddressSearch({ onPick }: { onPick: (lat: number, lng: number, label: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ lat: number; lng: number; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`).then((x) => x.json());
    setResults(r.results ?? []);
    setBusy(false);
  }
  return (
    <div className="relative">
      <form onSubmit={search} className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an address or intersection" className="h-10 w-full rounded-lg border border-line pl-9 pr-20 text-sm focus:border-brand focus:outline-none" />
        <button className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 rounded-md bg-ink px-2.5 text-xs font-medium text-white">{busy ? "…" : "Search"}</button>
      </form>
      {results.length > 0 && (
        <div className="absolute z-[1200] mt-1 w-full overflow-hidden rounded-lg border border-line bg-white shadow-lg">
          {results.map((r) => (
            <button
              key={`${r.lat},${r.lng}`}
              onClick={() => {
                onPick(r.lat, r.lng, r.label);
                setResults([]);
                setQ(r.label);
              }}
              className="block w-full border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Done({ filed, onAgain }: { filed: { clusterId: string; title: string; count: number; joined: boolean }; onAgain: () => void }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <Card className="animate-pop-in p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 size={30} />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Report filed. Thank you!</h1>
        <p className="mt-2 text-muted">
          {filed.joined ? (
            <>
              You joined <span className="font-medium text-ink">“{filed.title}”</span>.
            </>
          ) : (
            <>
              You started a new issue: <span className="font-medium text-ink">“{filed.title}”</span>.
            </>
          )}
        </p>
        <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
          <Users size={16} />
          {filed.count > 1 ? `${filed.count} residents have now reported this` : "You're the first to report this"}
        </div>
        <p className="mt-4 text-sm text-muted">We&apos;ll notify you when staff acknowledge it, start work, and resolve it.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Link href={`/issue/${filed.clusterId}`} className="flex h-10 items-center justify-center rounded-lg bg-brand text-sm font-medium text-white">
            Track this issue
          </Link>
          <Link href="/feed?mine=1" className="flex h-10 items-center justify-center rounded-lg border border-line text-sm font-medium">
            See it in the feed
          </Link>
        </div>
        <button onClick={onAgain} className="mt-4 text-sm font-medium text-brand">
          Report something else
        </button>
      </Card>
    </div>
  );
}
