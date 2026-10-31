"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bot, Building2, ExternalLink, GitMerge, Search, ShieldAlert, Sparkles } from "lucide-react";
import { api, useLive, useSession } from "@/components/session";
import { IssueMap } from "@/components/map";
import { Button, Card, CategoryChip, CategoryIcon, ChannelIcon, PriorityPill, Spinner, StatusPill, cx, inputCls } from "@/components/ui";
import { STATUS_META, timeAgo } from "@/lib/meta";
import { distanceKm } from "@/lib/geo";
import { CATEGORIES, STATUSES, type Category, type PublicCluster, type Report, type StaffBrief, type Status } from "@/lib/types";

interface Stats {
  reports: number;
  reportsThisWeek: number;
  openClusters: number;
  critical: number;
  resolved: number;
  medianDaysToResolve: number | null;
}

export default function AdminPage() {
  const { user, loaded } = useSession();
  if (!loaded) return <div className="p-10"><Spinner label="Loading…" /></div>;
  if (user?.role !== "staff") return <StaffGate />;
  return <Dashboard />;
}

function StaffGate() {
  const { refresh } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <Card className="p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
          <ShieldAlert size={22} />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Staff dashboard</h1>
        <p className="mt-2 text-sm text-muted">For government staff with a UniGov staff account. Residents can follow issues on the public heatmap and feed.</p>
        <Button
          className="mt-6 w-full"
          size="lg"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await api("/api/auth/demo", { role: "staff" });
            await refresh();
          }}
        >
          Sign in as demo staff (Jordan Rivera)
        </Button>
        <Link href="/map" className="mt-3 block text-sm font-medium text-brand">
          Go to the public heatmap
        </Link>
      </Card>
    </div>
  );
}

function Dashboard() {
  const { data, reload } = useLive<{ clusters: PublicCluster[]; stats: Stats }>("/api/clusters");
  const [status, setStatus] = useState<Status | "open" | "all">("open");
  const [cat, setCat] = useState<Category | "all">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const all = data?.clusters ?? [];
  const rows = useMemo(
    () =>
      all.filter(
        (c) =>
          (status === "all" || (status === "open" ? c.status !== "resolved" : c.status === status)) &&
          (cat === "all" || c.category === cat) &&
          (!q || `${c.title} ${c.city} ${c.department}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [all, status, cat, q],
  );
  useEffect(() => {
    if (!selected && rows.length) setSelected(rows[0].id);
  }, [rows, selected]);

  const s = data?.stats;
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-brand">Bay Area operations</div>
          <h1 className="text-2xl font-semibold tracking-tight">Issue triage</h1>
        </div>
        <div className="text-xs text-muted">Ranked by AI priority · updates live</div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Open issues" value={s?.openClusters} sub={`${s?.reports ?? "–"} reports total`} />
        <Kpi label="Critical (80+)" value={s?.critical} sub="open, needs action now" accent />
        <Kpi label="Reports this week" value={s?.reportsThisWeek} sub="across all channels" />
        <Kpi label="Median days to resolve" value={s?.medianDaysToResolve ?? "–"} sub={`${s?.resolved ?? 0} resolved`} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <div className="relative min-w-40 flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, city, department" className="h-9 w-full rounded-lg border border-line pl-8 pr-2 text-sm focus:border-brand focus:outline-none" />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-9 rounded-lg border border-line bg-white px-2 text-sm">
                <option value="open">All open</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
                <option value="all">Everything</option>
              </select>
              <select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} className="h-9 max-w-44 rounded-lg border border-line bg-white px-2 text-sm">
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-canvas text-left text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Issue</th>
                    <th className="px-3 py-2 text-right font-medium">Reports</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} onClick={() => setSelected(c.id)} className={cx("cursor-pointer border-t border-line hover:bg-slate-50", selected === c.id && "bg-brand-soft/60 hover:bg-brand-soft/60")}>
                      <td className="px-3 py-2.5 align-top">
                        <PriorityPill priority={c.priority} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5">
                            <CategoryIcon category={c.category} size={14} />
                          </span>
                          <div>
                            <div className="font-medium leading-snug">{c.title}</div>
                            <div className="text-xs text-muted">
                              {c.city} · {c.department} · {timeAgo(c.createdAt)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right align-top font-semibold tabular-nums">{c.count}</td>
                      <td className="px-3 py-2.5 align-top">
                        <StatusPill status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && <div className="p-6 text-sm text-muted">No issues match.</div>}
            </div>
          </Card>
          <CategoryBars clusters={all.filter((c) => c.status !== "resolved")} onPick={(c) => setCat(c)} />
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          {selected ? <Detail key={selected} id={selected} all={all} onChanged={reload} onMerged={(id) => setSelected(id)} /> : <Card className="p-6 text-sm text-muted">Select an issue.</Card>}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value?: number | string; sub: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={cx("mt-1 text-3xl font-semibold tabular-nums tracking-tight", accent && Number(value) > 0 ? "text-red-700" : "text-ink")}>{value ?? "–"}</div>
      <div className="mt-0.5 text-xs text-muted">{sub}</div>
    </Card>
  );
}

/** Open issues per category: one measure, one hue, sorted. */
function CategoryBars({ clusters, onPick }: { clusters: PublicCluster[]; onPick: (c: Category) => void }) {
  const counts = CATEGORIES.map((c) => ({ c, n: clusters.filter((x) => x.category === c).length, reports: clusters.filter((x) => x.category === c).reduce((s, x) => s + x.count, 0) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.reports - a.reports);
  const max = Math.max(1, ...counts.map((x) => x.n));
  return (
    <Card className="p-5">
      <div className="font-semibold">Open issues by category</div>
      <div className="text-xs text-muted">Click a row to filter the queue</div>
      <div className="mt-4 space-y-1">
        {counts.map(({ c, n, reports }) => (
          <button key={c} onClick={() => onPick(c)} title={`${c}: ${n} open issues, ${reports} reports`} className="group grid w-full grid-cols-[170px_1fr_28px] items-center gap-3 rounded-md px-1 py-1 text-left hover:bg-slate-50">
            <span className="flex items-center gap-1.5 truncate text-sm">
              <CategoryIcon category={c} size={13} /> {c}
            </span>
            <span className="h-3.5">
              <span className="block h-full rounded-r-[4px] bg-brand/80 group-hover:bg-brand" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="text-right text-sm font-medium tabular-nums">{n}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

type DetailReport = Report & { mine: boolean };

function Detail({ id, all, onChanged, onMerged }: { id: string; all: PublicCluster[]; onChanged: () => void; onMerged: (id: string) => void }) {
  const { toast } = useSession();
  const { data, reload } = useLive<{ cluster: PublicCluster; reports: DetailReport[] }>(`/api/clusters/${id}`);
  const [note, setNote] = useState("");
  const [dept, setDept] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [brief, setBrief] = useState<StaffBrief | null>(null);
  const [mergeId, setMergeId] = useState("");

  if (!data?.cluster) return <Card className="p-6"><Spinner label="Loading…" /></Card>;
  const c = data.cluster;
  const shownBrief = brief ?? c.brief ?? null;
  const nearby = all
    .filter((x) => x.id !== c.id && x.status !== "resolved")
    .map((x) => ({ x, d: distanceKm(c.lat, c.lng, x.lat, x.lng) }))
    .filter(({ d }) => d < 3)
    .sort((a, b) => a.d - b.d);

  async function update(body: { status?: Status; note?: string; department?: string }, label: string) {
    setBusy(label);
    try {
      await api(`/api/clusters/${c.id}`, body, "PATCH");
      setNote("");
      reload();
      onChanged();
      toast({ title: "Issue updated", body: body.status ? `Marked ${STATUS_META[body.status].label}. Linked residents notified.` : "Public update posted.", tone: "success" });
    } catch (e) {
      toast({ title: "Update failed", body: (e as Error).message, tone: "warn" });
    } finally {
      setBusy(null);
    }
  }

  async function genBrief() {
    setBusy("brief");
    try {
      const r = await api<{ brief: StaffBrief; warning?: string }>(`/api/clusters/${c.id}/brief`);
      setBrief(r.brief);
      if (r.warning) toast({ title: "Offline brief", body: r.warning, tone: "warn" });
    } catch (e) {
      toast({ title: "Brief failed", body: (e as Error).message, tone: "warn" });
    } finally {
      setBusy(null);
    }
  }

  async function merge() {
    if (!mergeId) return;
    setBusy("merge");
    try {
      await api("/api/clusters/merge", { targetId: c.id, sourceId: mergeId });
      setMergeId("");
      reload();
      onChanged();
      onMerged(c.id);
      toast({ title: "Issues merged", tone: "success" });
    } catch (e) {
      toast({ title: "Merge failed", body: (e as Error).message, tone: "warn" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <IssueMap clusters={[c]} heat={data.reports.map((r) => ({ lat: r.lat, lng: r.lng, weight: 0.7 }))} className="h-48 w-full" zoom={15} center={[c.lat, c.lng]} scrollWheelZoom={false} highlightMine={false} />
      <div className="space-y-5 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <PriorityPill priority={c.priority} />
            <StatusPill status={c.status} />
            <CategoryChip category={c.category} />
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-snug">{c.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">{c.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span>{c.city}</span>
            <span>{c.count} residents</span>
            <span>opened {timeAgo(c.createdAt)}</span>
            <Link href={`/issue/${c.id}`} className="inline-flex items-center gap-1 text-brand">
              Public page <ExternalLink size={11} />
            </Link>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Move to</div>
          <div className="grid grid-cols-4 gap-1.5">
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={!!busy || s === c.status}
                onClick={() => update({ status: s, note }, s)}
                className={cx("h-9 rounded-lg border text-xs font-semibold transition-colors disabled:cursor-default", s === c.status ? "border-transparent" : "border-line hover:bg-slate-50")}
                style={s === c.status ? { background: STATUS_META[s].bg, color: STATUS_META[s].color } : undefined}
              >
                {busy === s ? "…" : STATUS_META[s].label}
              </button>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Public update for residents (sent with the status change)" className={cx(inputCls, "mt-2 resize-none")} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" disabled={!note.trim()} loading={busy === "note"} onClick={() => update({ note }, "note")}>
              Post update only
            </Button>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
              <Building2 size={12} /> Owning department
            </span>
            <input value={dept ?? c.department} onChange={(e) => setDept(e.target.value)} className={inputCls} />
          </label>
          <Button size="md" variant="secondary" disabled={dept === null || dept === c.department} loading={busy === "dept"} onClick={() => update({ department: dept! }, "dept")}>
            Assign
          </Button>
        </div>

        <div className="rounded-xl border border-line bg-canvas/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot size={16} className="text-brand" /> AI staff brief
            </div>
            <Button size="sm" variant={shownBrief ? "secondary" : "primary"} loading={busy === "brief"} onClick={genBrief}>
              <Sparkles size={14} /> {shownBrief ? "Regenerate" : "Generate brief"}
            </Button>
          </div>
          {shownBrief ? (
            <div className="mt-3 space-y-2.5 text-sm">
              <div>
                <div className="text-xs font-medium text-muted">Likely root cause</div>
                <p className="leading-snug">{shownBrief.rootCause}</p>
              </div>
              <div>
                <div className="text-xs font-medium text-muted">Impact</div>
                <p className="leading-snug">{shownBrief.impact}</p>
              </div>
              <div>
                <div className="text-xs font-medium text-muted">Recommended actions</div>
                <ol className="mt-1 list-decimal space-y-1 pl-5">
                  {shownBrief.actions.map((a) => (
                    <li key={a} className="leading-snug">{a}</li>
                  ))}
                </ol>
              </div>
              <div className="text-xs text-muted">
                Route to <span className="font-medium text-ink">{shownBrief.department}</span> · {shownBrief.aiMode === "claude" ? "Claude Sonnet" : "offline"} · {timeAgo(shownBrief.generatedAt)}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Claude reads all {c.count} reports and proposes a root cause, impact and next actions.</p>
          )}
        </div>

        {nearby.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted">
              <GitMerge size={12} /> Merge a duplicate into this issue
            </div>
            <div className="flex gap-2">
              <select value={mergeId} onChange={(e) => setMergeId(e.target.value)} className={cx(inputCls, "flex-1")}>
                <option value="">Nearby open issues…</option>
                {nearby.map(({ x, d }) => (
                  <option key={x.id} value={x.id}>
                    {x.title} ({x.count}) · {d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`}
                  </option>
                ))}
              </select>
              <Button variant="secondary" disabled={!mergeId} loading={busy === "merge"} onClick={merge}>
                Merge
              </Button>
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Resident reports ({data.reports.length})</div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {data.reports.map((r) => (
              <div key={r.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-ink">{r.authorName}</span>· {timeAgo(r.createdAt)}
                  <PriorityPill priority={r.priority} />
                  <span className="ml-auto">
                    <ChannelIcon channel={r.channel} />
                  </span>
                </div>
                <p className="mt-1 text-sm leading-snug">{r.text}</p>
                {r.aiMode === "claude" && <p className="mt-1 text-xs italic text-muted">AI: {r.priorityReason}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
