"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HandHeart, Megaphone, ShieldCheck, Users } from "lucide-react";
import { api, useLive, useSession } from "@/components/session";
import { Button, Card, CategoryChip, ChannelIcon, PriorityPill, StatusPill, TypeTag, cx } from "@/components/ui";
import { timeAgo } from "@/lib/meta";
import type { PublicCluster, PublicReport } from "@/lib/types";

export default function FeedPage() {
  const { user, toast, refresh } = useSession();
  const [tab, setTab] = useState<"all" | "mine">("all");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("mine") === "1") setTab("mine");
  }, []);
  const { data, reload } = useLive<{ reports: PublicReport[] }>(`/api/reports?limit=200${tab === "mine" ? "&mine=1" : ""}`, [tab]);
  const { data: cl } = useLive<{ clusters: PublicCluster[] }>("/api/clusters");
  const reports = data?.reports ?? [];

  // Highlight reports that arrive while the page is open.
  const prevIds = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    prevIds.current = null;
  }, [tab]);
  useEffect(() => {
    if (!data) return;
    const ids = new Set(data.reports.map((r) => r.id));
    if (prevIds.current) {
      const added = [...ids].filter((id) => !prevIds.current!.has(id));
      if (added.length) setFresh(new Set(added));
    }
    prevIds.current = ids;
  }, [data]);

  const supported = new Set((cl?.clusters ?? []).filter((c) => c.supported).map((c) => c.id));
  const myClusters = (cl?.clusters ?? []).filter((c) => c.mine);

  async function meToo(clusterId: string) {
    if (!user) return toast({ title: "Sign in with UniGov", body: "Verified residents can add their support to an issue.", href: "/unigov/login?next=/feed", tone: "info" });
    try {
      await api(`/api/clusters/${clusterId}/support`);
      reload();
      refresh();
    } catch (e) {
      toast({ title: "Couldn't add support", body: (e as Error).message, tone: "warn" });
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Community feed</h1>
            <p className="text-sm text-muted">What residents across the Bay Area are reporting, live.</p>
          </div>
          <div className="flex rounded-lg border border-line bg-white p-0.5 text-sm">
            {(["all", "mine"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cx("rounded-md px-3 py-1.5 font-medium", tab === t ? "bg-ink text-white" : "text-muted")}>
                {t === "all" ? "All reports" : "Mine"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {tab === "mine" && !user && (
            <Card className="p-6 text-sm">
              <Link href="/unigov/login?next=/feed?mine=1" className="font-medium text-unigov">Sign in with UniGov</Link> to see your reports.
            </Card>
          )}
          {data && reports.length === 0 && (tab === "all" || user) && (
            <Card className="p-8 text-center text-sm text-muted">
              {tab === "mine" ? "You haven't filed any reports yet." : "No reports yet."}{" "}
              <Link href="/report" className="font-medium text-brand">File one now</Link>
            </Card>
          )}
          {reports.map((r) => (
            <ReportCard key={r.id} r={r} fresh={fresh.has(r.id)} supported={supported.has(r.clusterId)} onMeToo={() => meToo(r.clusterId)} />
          ))}
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {user ? (
          <Card className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck size={16} className="text-unigov" /> Your impact
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Impact label="Issues" value={myClusters.length} />
              <Impact label="Neighbors" value={myClusters.reduce((s, c) => s + c.count, 0)} />
              <Impact label="Resolved" value={myClusters.filter((c) => c.status === "resolved").length} />
            </div>
            <div className="mt-4 space-y-2">
              {myClusters.slice(0, 4).map((c) => (
                <Link key={c.id} href={`/issue/${c.id}`} className="block rounded-lg border border-line p-2.5 hover:bg-slate-50">
                  <div className="text-sm font-medium leading-snug">{c.title}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusPill status={c.status} />
                    <span className="text-xs text-muted">{c.count} reports</span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <div className="font-semibold">Add your voice</div>
            <p className="mt-1 text-sm text-muted">Sign in with UniGov to report issues, support your neighbors&apos; reports and get updates.</p>
            <Link href="/unigov/login?next=/feed" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg bg-unigov text-sm font-medium text-white">
              <ShieldCheck size={16} /> Sign in with UniGov
            </Link>
          </Card>
        )}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone size={16} className="text-brand" /> Most reported right now
          </div>
          <div className="mt-3 space-y-2.5">
            {(cl?.clusters ?? [])
              .filter((c) => c.status !== "resolved")
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
              .map((c) => (
                <Link key={c.id} href={`/issue/${c.id}`} className="flex items-center gap-3 text-sm hover:text-brand">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-canvas text-xs font-semibold tabular-nums">{c.count}</span>
                  <span className="leading-snug">{c.title}</span>
                </Link>
              ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Impact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-canvas py-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] font-medium text-muted">{label}</div>
    </div>
  );
}

function ReportCard({ r, fresh, supported, onMeToo }: { r: PublicReport; fresh: boolean; supported: boolean; onMeToo: () => void }) {
  const others = r.cluster.count - 1;
  return (
    <Card className={cx("overflow-hidden", fresh && "animate-flash-new", r.mine && "ring-2 ring-unigov/30")}>
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          <span className={cx("grid h-8 w-8 place-items-center rounded-full text-xs font-semibold", r.mine ? "bg-unigov text-white" : "bg-slate-100 text-slate-600")}>{r.authorName[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              {r.mine ? "You" : r.authorName}
              {r.mine && <span className="rounded bg-unigov-soft px-1.5 py-0.5 text-[10px] font-semibold text-unigov">YOUR REPORT</span>}
              {fresh && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">NEW</span>}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted">
              {r.city} · {timeAgo(r.createdAt)} · <ChannelIcon channel={r.channel} size={11} />
            </div>
          </div>
          <PriorityPill priority={r.priority} />
        </div>
        <p className="mt-3 text-[15px] leading-relaxed">{r.text}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <CategoryChip category={r.category} />
          <TypeTag type={r.type} />
          {r.address && <span className="text-xs text-muted">· {r.address}</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-canvas/60 px-4 py-2.5">
        <Link href={`/issue/${r.clusterId}`} className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <Users size={15} className="shrink-0 text-brand" />
          <span className="truncate">
            {others > 0 ? (
              <>
                <span className="font-semibold">{others} {others === 1 ? "neighbor" : "neighbors"}</span> also reported{" "}
                <span className="text-muted">“{r.cluster.title}”</span>
              </>
            ) : (
              <span className="text-muted">First report of this issue</span>
            )}
          </span>
        </Link>
        <StatusPill status={r.cluster.status} />
        {!r.mine && r.cluster.status !== "resolved" && (
          <Button size="sm" variant={supported ? "primary" : "secondary"} onClick={onMeToo}>
            <HandHeart size={14} /> {supported ? "Supported" : "Me too"}
          </Button>
        )}
      </div>
    </Card>
  );
}
