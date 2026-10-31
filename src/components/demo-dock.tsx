"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, FlaskConical, Pause, Play, Plus, RotateCcw, Sparkles, UserRound, Wrench } from "lucide-react";
import { api, useHydrated, useSession } from "./session";
import { cx } from "./ui";
import { STATUS_META } from "@/lib/meta";
import type { Status } from "@/lib/types";

/** Floating presenter controls, shown whenever demo mode is on. */
export function DemoDock() {
  const { demoMode, simulation, refresh, user, toast } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [resolution, setResolution] = useState<{ clusterId: string; startedAt: string } | null>(null);
  const router = useRouter();
  const path = usePathname();
  const hydrated = useHydrated();
  if (!hydrated) return null;

  if (!demoMode || path.startsWith("/unigov")) return resolution ? <ResolutionOverlay {...resolution} onClose={() => setResolution(null)} /> : null;

  async function run(action: string, label: string) {
    setBusy(action);
    try {
      const d = await api<{ clusterId?: string; startedAt?: string; joined?: boolean; report?: { authorName: string; city: string } }>("/api/demo", { action });
      if (action === "resolve" && d.clusterId && d.startedAt) setResolution({ clusterId: d.clusterId, startedAt: d.startedAt });
      if (action === "sim-once" && d.report)
        toast({ title: "New simulated report", body: `${d.report.authorName} in ${d.report.city}${d.joined ? " — joined an existing issue" : " — new issue"}`, tone: "info" });
      if (action === "reset") toast({ title: "Demo data reset", body: "Seeded Bay Area reports restored.", tone: "info" });
      await refresh();
    } catch (e) {
      toast({ title: `${label} failed`, body: (e as Error).message, tone: "warn" });
    } finally {
      setBusy(null);
    }
  }

  async function signIn(role: "citizen" | "staff") {
    setBusy(role);
    await api("/api/auth/demo", { role });
    await refresh();
    setBusy(null);
    router.push(role === "staff" ? "/admin" : "/feed");
  }

  return (
    <>
      <div className="fixed bottom-4 left-4 z-[1500] w-64 rounded-2xl border border-amber-200 bg-white/95 shadow-xl backdrop-blur">
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          <FlaskConical size={16} className="text-amber-600" />
          <span className="text-sm font-semibold">Demo controls</span>
          {simulation && <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-green-500" title="Simulation running" />}
          <span className="ml-auto text-muted">{open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}</span>
        </button>
        {open && (
          <div className="space-y-1.5 border-t border-amber-100 p-3 pt-2.5">
            <DockBtn onClick={() => run(simulation ? "sim-off" : "sim-on", "Simulation")} busy={busy === "sim-on" || busy === "sim-off"} active={simulation}>
              {simulation ? <Pause size={15} /> : <Play size={15} />}
              {simulation ? "Pause live simulation" : "Start live simulation"}
            </DockBtn>
            <DockBtn onClick={() => run("sim-once", "Simulated report")} busy={busy === "sim-once"}>
              <Plus size={15} /> Add one neighbor report
            </DockBtn>
            <DockBtn onClick={() => run("resolve", "Resolution demo")} busy={busy === "resolve"}>
              <Sparkles size={15} /> Run resolution demo
            </DockBtn>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <DockBtn onClick={() => signIn("citizen")} busy={busy === "citizen"} active={user?.role === "citizen" && user.id === "u_maya"} small>
                <UserRound size={14} /> Citizen
              </DockBtn>
              <DockBtn onClick={() => signIn("staff")} busy={busy === "staff"} active={user?.role === "staff"} small>
                <Wrench size={14} /> Staff
              </DockBtn>
            </div>
            <button onClick={() => run("reset", "Reset")} className="flex w-full items-center justify-center gap-1.5 pt-1 text-xs text-muted hover:text-ink">
              <RotateCcw size={12} /> Reset demo data
            </button>
          </div>
        )}
      </div>
      {resolution && <ResolutionOverlay {...resolution} onClose={() => setResolution(null)} />}
    </>
  );
}

function DockBtn({ children, onClick, busy, active, small }: { children: React.ReactNode; onClick: () => void; busy?: boolean; active?: boolean; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cx(
        "flex w-full items-center gap-2 rounded-lg border px-3 text-left font-medium transition-colors disabled:opacity-60",
        small ? "h-8 justify-center text-xs" : "h-9 text-[13px]",
        active ? "border-amber-300 bg-amber-50 text-amber-800" : "border-line bg-white hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

const STEPS: { status: Status; label: string }[] = [
  { status: "acknowledged", label: "Agency acknowledges the cluster" },
  { status: "in_progress", label: "Crew dispatched, work in progress" },
  { status: "resolved", label: "Resolved — every reporter notified" },
];

function ResolutionOverlay({ clusterId, startedAt, onClose }: { clusterId: string; startedAt: string; onClose: () => void }) {
  const { tick } = useSession();
  const [cluster, setCluster] = useState<{ title: string; status: Status; count: number; updates: { status: Status; note: string; at: string }[] } | null>(null);

  useEffect(() => {
    fetch(`/api/clusters/${clusterId}`)
      .then((r) => r.json())
      .then((d) => setCluster(d.cluster));
  }, [clusterId, tick]);

  const reached = new Set(cluster?.updates.filter((u) => u.at >= startedAt).map((u) => u.status));
  const done = reached.has("resolved");

  return (
    <div className="animate-pop-in fixed bottom-4 left-1/2 z-[1600] w-[26rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-line bg-white p-5 shadow-2xl">
      <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Resolution demo</div>
      <div className="mt-1 font-semibold leading-snug">{cluster?.title ?? "Loading…"}</div>
      {cluster && <div className="text-sm text-muted">{cluster.count} residents linked · watch the map, feed and bell update</div>}
      <ol className="mt-4 space-y-3">
        {STEPS.map((s, i) => {
          const ok = reached.has(s.status);
          const current = !ok && (i === 0 || reached.has(STEPS[i - 1].status));
          const note = cluster?.updates.findLast((u) => u.status === s.status && u.at >= startedAt)?.note;
          return (
            <li key={s.status} className="flex gap-3">
              {ok ? (
                <CheckCircle2 size={20} className="shrink-0" style={{ color: STATUS_META[s.status].color }} />
              ) : (
                <Circle size={20} className={cx("shrink-0", current ? "animate-pulse text-brand" : "text-slate-300")} />
              )}
              <div className="min-w-0">
                <div className={cx("text-sm font-medium", !ok && !current && "text-muted")}>{s.label}</div>
                {note && <div className="mt-0.5 text-xs leading-snug text-muted">{note}</div>}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex gap-2">
        <Link href={`/issue/${clusterId}`} className="flex h-9 flex-1 items-center justify-center rounded-lg bg-brand text-sm font-medium text-white hover:bg-brand-hover">
          Open the issue page
        </Link>
        <button onClick={onClose} className="h-9 rounded-lg border border-line px-4 text-sm font-medium hover:bg-slate-50">
          {done ? "Done" : "Hide"}
        </button>
      </div>
    </div>
  );
}
