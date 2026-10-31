"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Flame, Layers, Search } from "lucide-react";
import { useLive } from "@/components/session";
import { IssueMap } from "@/components/map";
import { CategoryIcon, PriorityPill, StatusPill, cx } from "@/components/ui";
import { CATEGORIES, STATUSES, type Category, type PublicCluster, type PublicReport, type ReportType, type Status } from "@/lib/types";
import { STATUS_META, TYPE_META } from "@/lib/meta";

type Window = "7" | "30" | "all";

export default function MapPage() {
  const { data } = useLive<{ clusters: PublicCluster[] }>("/api/clusters");
  const { data: feed } = useLive<{ reports: PublicReport[] }>("/api/reports?limit=2000");
  const [cats, setCats] = useState<Set<Category>>(new Set());
  const [statuses, setStatuses] = useState<Set<Status>>(new Set(["new", "acknowledged", "in_progress"]));
  const [type, setType] = useState<ReportType | "all">("all");
  const [win, setWin] = useState<Window>("all");
  const [layer, setLayer] = useState<"heat" | "bubbles" | "both">("both");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const since = win === "all" ? 0 : Date.now() - Number(win) * 86_400_000;
  const keep = (c: { category: Category; status: Status; type: ReportType }) =>
    (cats.size === 0 || cats.has(c.category)) && statuses.has(c.status) && (type === "all" || c.type === type);

  const clusters = useMemo(
    () =>
      (data?.clusters ?? []).filter(
        (c) => keep(c) && new Date(c.updatedAt).getTime() >= since && (!q || `${c.title} ${c.city}`.toLowerCase().includes(q.toLowerCase())),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, cats, statuses, type, since, q],
  );
  const ids = new Set(clusters.map((c) => c.id));
  const heat = (feed?.reports ?? [])
    .filter((r) => ids.has(r.clusterId) && new Date(r.createdAt).getTime() >= since)
    .map((r) => ({ lat: r.lat, lng: r.lng, weight: Math.max(0.25, r.cluster.priority / 100) }));

  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    setter(n);
  };

  return (
    <div className="flex flex-1 flex-col lg:h-[calc(100vh-4rem)] lg:flex-none lg:flex-row lg:overflow-hidden">
      <aside className="flex w-full flex-col border-b border-line bg-white lg:h-full lg:min-h-0 lg:w-[380px] lg:border-b-0 lg:border-r">
        <div className="space-y-4 border-b border-line p-4">
          <div>
            <h1 className="text-lg font-semibold">Bay Area issue heatmap</h1>
            <p className="text-sm text-muted">Public, live, weighted by AI priority. Click a bubble for details.</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search issues or cities" className="h-9 w-full rounded-lg border border-line pl-9 pr-3 text-sm focus:border-brand focus:outline-none" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => toggle(cats, c, setCats)}
                className={cx("flex items-center gap-1 rounded-full border px-2 py-1 text-xs", cats.has(c) ? "border-brand bg-brand-soft text-brand" : "border-line text-muted hover:bg-slate-50")}
                title={c}
              >
                <CategoryIcon category={c} size={12} />
                {c.split(" & ")[0]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => toggle(statuses, s, setStatuses)}
                className={cx("rounded-full border px-2.5 py-1 text-xs font-medium", statuses.has(s) ? "border-transparent" : "border-line text-muted")}
                style={statuses.has(s) ? { background: STATUS_META[s].bg, color: STATUS_META[s].color } : undefined}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Seg value={type} onChange={setType} options={[["all", "All types"], ...(["complaint", "recommendation", "idea"] as const).map((t) => [t, TYPE_META[t].label] as [ReportType, string])]} />
            <Seg value={win} onChange={setWin} options={[["7", "7 days"], ["30", "30 days"], ["all", "All time"]]} />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-muted">
          <span>
            {clusters.length} issues · {heat.length} reports
          </span>
          <span>Sorted by priority</span>
        </div>
        <div className="max-h-[50vh] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
          {clusters.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={cx("block w-full border-t border-line px-4 py-3 text-left hover:bg-slate-50", selected === c.id && "bg-brand-soft/60")}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  <CategoryIcon category={c.category} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-snug">
                    {c.title}
                    {c.mine && <span className="ml-1.5 rounded bg-unigov-soft px-1.5 py-0.5 text-[10px] font-semibold text-unigov">YOU</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <PriorityPill priority={c.priority} />
                    <StatusPill status={c.status} />
                    <span>
                      {c.count} · {c.city}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
          {!clusters.length && <div className="p-6 text-sm text-muted">No issues match these filters.</div>}
        </div>
      </aside>
      <div className="relative min-h-[60vh] flex-1">
        <IssueMap clusters={clusters} heat={heat} showHeat={layer !== "bubbles"} showBubbles={layer !== "heat"} selectedId={selected} onSelect={setSelected} className="absolute inset-0" fitToData />
        <div className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-lg border border-line bg-white text-xs font-medium shadow-md">
          {(
            [
              ["heat", <Flame key="h" size={14} />, "Heat"],
              ["both", <Layers key="b" size={14} />, "Both"],
              ["bubbles", <span key="c" className="h-2.5 w-2.5 rounded-full bg-orange-500" />, "Clusters"],
            ] as const
          ).map(([v, icon, label]) => (
            <button key={v} onClick={() => setLayer(v)} className={cx("flex items-center gap-1.5 px-3 py-2", layer === v ? "bg-brand text-white" : "hover:bg-slate-50")}>
              {icon}
              {label}
            </button>
          ))}
        </div>
        <div className="absolute bottom-6 right-3 z-[1000] rounded-xl border border-line bg-white/95 p-3 text-xs shadow-md">
          <div className="mb-1.5 font-semibold">Priority</div>
          <div className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(90deg,#3b82f6,#22c55e,#facc15,#f97316,#dc2626)" }} />
          <div className="mt-1 flex justify-between text-muted">
            <span>Low</span>
            <span>Critical</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-muted">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-unigov" /> Your reports
            <span className="ml-2 h-2.5 w-2.5 rounded-full bg-green-700" /> Resolved
          </div>
          <Link href="/report" className="mt-2.5 block rounded-lg bg-brand py-1.5 text-center font-medium text-white">
            Report an issue here
          </Link>
        </div>
      </div>
    </div>
  );
}

function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-line">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={cx("px-2.5 py-1.5", value === v ? "bg-ink text-white" : "text-muted hover:bg-slate-50")}>
          {label}
        </button>
      ))}
    </div>
  );
}
