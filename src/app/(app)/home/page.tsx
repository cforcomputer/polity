"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPinned, MessageCircle, Plus } from "lucide-react";
import { useHydrated, useLive, useSession } from "@/components/session";
import { IssueMap } from "@/components/map";
import { CategoryIcon, StatusPill, cx } from "@/components/ui";
import { timeAgo } from "@/lib/meta";
import type { PublicCluster, PublicReport } from "@/lib/types";

interface ClustersResp {
  clusters: PublicCluster[];
  stats: { reports: number; openClusters: number; critical: number; resolved: number; cities: number; reportsThisWeek: number };
}

export default function AppHome() {
  const session = useSession();
  const user = useHydrated() ? session.user : null;
  const { data } = useLive<ClustersResp>("/api/clusters");
  const { data: feed } = useLive<{ reports: PublicReport[] }>("/api/reports?limit=500");
  const clusters = data?.clusters ?? [];
  const reports = feed?.reports ?? [];
  const heat = reports.map((r) => ({ lat: r.lat, lng: r.lng, weight: Math.max(0.25, r.cluster.priority / 100) }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">{user ? `Hi, ${user.name.split(" ")[0]}` : "What needs fixing?"}</h1>
      <p className="mt-1 text-muted">
        {data ? `${data.stats.openClusters} open issues across ${data.stats.cities} Bay Area cities.` : "Loading the Bay Area…"}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Action href="/report" icon={<Plus size={18} />} title="Report an issue" body="Type or talk, then drop a pin" primary />
        <Action href="/chat" icon={<MessageCircle size={18} />} title="Chat or call Sam" body="Our AI intake agent" />
        <Action href="/map" icon={<MapPinned size={18} />} title="Live heatmap" body="See where problems cluster" />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Latest reports</h2>
            <Link href="/feed" className="inline-flex items-center gap-1 text-sm font-medium text-brand">
              Full feed <ArrowRight size={14} />
            </Link>
          </div>
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
            {reports.slice(0, 6).map((r) => (
              <Link key={r.id} href={`/issue/${r.clusterId}`} className="flex gap-3 p-4 hover:bg-canvas">
                <div className="mt-0.5">
                  <CategoryIcon category={r.category} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-1 text-sm font-medium">{r.cluster.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                    <span>{r.city}</span>·<span>{timeAgo(r.createdAt)}</span>
                    <span className="ml-auto">
                      <StatusPill status={r.cluster.status} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
            {!reports.length && <div className="p-6 text-sm text-muted">No reports yet. Turn on demo mode to see seeded Bay Area data.</div>}
          </div>
        </section>

        <Link href="/map" className="group relative block overflow-hidden rounded-2xl border border-line bg-white">
          <IssueMap clusters={clusters} heat={heat} className="pointer-events-none h-[360px] w-full lg:h-full lg:min-h-[400px]" zoom={9} scrollWheelZoom={false} highlightMine={false} fitToData />
          <span className="absolute right-3 top-3 z-[1000] inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium shadow-sm group-hover:bg-white">
            Open map <ArrowUpRight size={13} />
          </span>
        </Link>
      </div>
    </div>
  );
}

function Action({ href, icon, title, body, primary }: { href: string; icon: React.ReactNode; title: string; body: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        "group flex items-center gap-4 rounded-2xl border p-5 transition-colors",
        primary ? "border-transparent bg-brand text-white hover:bg-brand-hover" : "border-line bg-white hover:border-ink/15",
      )}
    >
      <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl", primary ? "bg-white/15" : "bg-brand-soft text-brand")}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className={cx("block text-sm", primary ? "text-white/75" : "text-muted")}>{body}</span>
      </span>
      <ArrowRight size={16} className={cx("ml-auto shrink-0 transition-transform group-hover:translate-x-0.5", primary ? "text-white/80" : "text-muted")} />
    </Link>
  );
}
