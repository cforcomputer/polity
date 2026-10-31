"use client";

import Link from "next/link";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useSession } from "./session";

export function Toasts() {
  const { toasts, dismiss } = useSession();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[2000] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "warn" ? TriangleAlert : Info;
        const color = t.tone === "success" ? "text-green-600" : t.tone === "warn" ? "text-amber-600" : "text-brand";
        const inner = (
          <div className="flex gap-3">
            <Icon size={18} className={`mt-0.5 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-sm leading-snug text-muted">{t.body}</div>}
            </div>
          </div>
        );
        return (
          <div key={t.id} className="animate-pop-in pointer-events-auto relative rounded-xl border border-line bg-white p-3 pr-8 shadow-lg">
            {t.href ? <Link href={t.href}>{inner}</Link> : inner}
            <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-slate-100" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
