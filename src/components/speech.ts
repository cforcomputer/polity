"use client";

// Minimal typings for the Web Speech API (Chrome/Edge/Safari prefix it).
export interface SpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

export function createRecognizer(): SpeechRec | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r = new Ctor();
  r.lang = "en-US";
  return r;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

let robotVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (robotVoice !== undefined) return robotVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer a deliberately robotic voice where the OS has one, else any English voice.
  robotVoice =
    voices.find((v) => /^(Fred|Zarvox|Trinoids|Ralph)\b/.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("en") && /Google US English|Samantha|Daniel/.test(v.name)) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null;
  return robotVoice;
}

/** Speak text with a synthesized voice; resolves when finished. */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ""));
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.02;
    u.pitch = 0.85;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}
