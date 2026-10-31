"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Fingerprint, Lock, ShieldCheck } from "lucide-react";
import { cx } from "./ui";

export function UniGovMark({ className }: { className?: string }) {
  return (
    <span className={cx("flex items-center gap-2", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/30">
        <ShieldCheck size={20} />
      </span>
      <span>
        <span className="block text-lg font-semibold leading-none tracking-tight">UniGov</span>
        <span className="block text-[11px] leading-tight opacity-80">Bay Area digital identity</span>
      </span>
    </span>
  );
}

/** The "identity provider" frame shared by login, register and verify. */
export function UniGovShell({ step, children }: { step?: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-start justify-center bg-gradient-to-b from-unigov-soft to-canvas px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-line bg-white shadow-xl md:grid-cols-[300px_1fr]">
        <div className="flex flex-col justify-between bg-unigov p-7 text-white">
          <div>
            <UniGovMark />
            <p className="mt-6 text-sm leading-relaxed text-white/85">
              One secure login for Bay Area government services. Polity uses UniGov to make sure every report comes from a real resident.
            </p>
            {step && (
              <ol className="mt-8 space-y-3 text-sm">
                {["Create your account", "Verify your identity", "Start reporting"].map((s, i) => (
                  <li key={s} className={cx("flex items-center gap-2.5", i + 1 > step && "opacity-55")}>
                    <span className={cx("grid h-6 w-6 place-items-center rounded-full text-xs font-semibold", i + 1 < step ? "bg-white text-unigov" : i + 1 === step ? "bg-white/25 ring-2 ring-white" : "bg-white/15")}>
                      {i + 1 < step ? "✓" : i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="mt-8 space-y-2 text-xs text-white/75">
            <div className="flex items-center gap-2"><Lock size={13} /> Encrypted session, password hashed with scrypt</div>
            <div className="flex items-center gap-2"><Fingerprint size={13} /> ID photos are read once, then discarded</div>
            <div className="flex items-center gap-2"><BadgeCheck size={13} /> Only verified residents can file</div>
          </div>
        </div>
        <div className="p-7 sm:p-9">{children}</div>
      </div>
    </div>
  );
}

/** `?next=` without useSearchParams (keeps pages statically renderable). */
export function useNext(fallback = "/feed"): string {
  const [next, setNext] = useState(fallback);
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/")) setNext(n);
  }, []);
  return next;
}
