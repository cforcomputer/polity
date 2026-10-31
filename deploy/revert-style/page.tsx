"use client";

import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, GitMerge, MapPinned, MessageCircle, Mic, Phone, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useLive } from "@/components/session";
import { IssueMap } from "@/components/map";
import { CategoryIcon, StatusPill, cx } from "@/components/ui";
import { timeAgo } from "@/lib/meta";
import type { PublicCluster, PublicReport } from "@/lib/types";

interface ClustersResp {
  clusters: PublicCluster[];
  stats: { reports: number; openClusters: number; critical: number; resolved: number; cities: number; reportsThisWeek: number };
}

export default function Home() {
  const { data } = useLive<ClustersResp>("/api/clusters");
  const { data: feed } = useLive<{ reports: PublicReport[] }>("/api/reports?limit=500");
  const clusters = data?.clusters ?? [];
  const reports = feed?.reports ?? [];
  const heat = reports.map((r) => ({ lat: r.lat, lng: r.lng, weight: Math.max(0.25, r.cluster.priority / 100) }));

  return (
    <div>
      <section className="relative overflow-hidden border-b border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-line bg-canvas px-3 py-1 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Bay Area pilot · 9 counties · 101 cities
            </div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              Tell your government what&apos;s broken.
              <span className="block text-brand">Watch it get fixed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Report a pothole, a dangerous intersection or an idea in your own words, by text, voice or WhatsApp. Polity uses AI to triage every report, group it with your neighbors&apos;, and put the most urgent problems in front of the people who can fix them.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/report" className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand px-5 font-medium text-white shadow-sm hover:bg-blue-800">
                Report an issue <ArrowRight size={18} />
              </Link>
              <Link href="/chat" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-5 font-medium hover:bg-slate-50">
                <MessageCircle size={18} className="text-[#25d366]" /> Chat or call Sam
              </Link>
              <Link href="/map" className="inline-flex h-12 items-center gap-2 rounded-xl px-4 font-medium text-brand hover:bg-brand-soft">
                Explore the heatmap
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-muted">
              <ShieldCheck size={16} className="text-unigov" />
              Every report comes from a resident verified with <span className="font-semibold text-unigov">UniGov</span>.
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-3xl border border-line shadow-xl">
              <IssueMap clusters={clusters} heat={heat} className="h-[420px] w-full lg:h-[480px]" zoom={9} scrollWheelZoom={false} highlightMine={false} fitToData />
            </div>
            <div className="absolute -bottom-5 left-5 right-5 z-[1000] grid grid-cols-3 gap-3 sm:left-8 sm:right-8">
              <Stat label="Reports" value={data?.stats.reports} />
              <Stat label="Open issues" value={data?.stats.openClusters} />
              <Stat label="Resolved" value={data?.stats.resolved} tone="green" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <p className="mt-2 max-w-2xl text-muted">From a resident&apos;s words to a crew on site, without forms or phone trees.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Step n={1} icon={<Mic size={18} />} title="Report your way" body="Type, dictate, chat on WhatsApp or call. Drop a pin anywhere in the Bay Area." />
          <Step n={2} icon={<Sparkles size={18} />} title="AI triage in seconds" body="Claude assigns a category, a priority from 0 to 100 and the right agency, and finds matching reports nearby." />
          <Step n={3} icon={<GitMerge size={18} />} title="Join your neighbors" body="If others reported the same thing, you confirm, and your voice adds weight to one issue instead of a pile." />
          <Step n={4} icon={<CheckCircle2 size={18} />} title="See it resolved" body="Staff work a ranked queue. You're notified at every step, through to the fix." />
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-brand">Live from the Bay</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">What residents are reporting</h2>
            <div className="mt-6 divide-y divide-line rounded-2xl border border-line">
              {reports.slice(0, 5).map((r) => (
                <Link key={r.id} href={`/issue/${r.clusterId}`} className="flex gap-3 p-4 hover:bg-slate-50">
                  <div className="mt-0.5">
                    <CategoryIcon category={r.category} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm leading-snug">{r.text}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                      <span>{r.authorName}</span>·<span>{r.city}</span>·<span>{timeAgo(r.createdAt)}</span>
                      <span className="ml-auto">
                        <StatusPill status={r.cluster.status} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
              {!reports.length && <div className="p-6 text-sm text-muted">No reports yet. Turn on demo mode to see seeded Bay Area data.</div>}
            </div>
            <Link href="/feed" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
              Open the full feed <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <Feature icon={<Users size={18} />} title="For residents" body="See that you're not alone: every report shows how many neighbors reported the same thing, with yours marked." />
            <Feature icon={<Bot size={18} />} title="For staff" body="A priority queue of clusters, not 10,000 loose tickets, with AI briefs that propose a root cause and next actions." />
            <Feature icon={<MapPinned size={18} />} title="Public heatmap" body="Anyone can see where problems concentrate, by category, status and time." />
            <Feature icon={<Phone size={18} />} title="No smartphone needed" body="Call or WhatsApp Sam, the AI intake agent, who asks the right questions and files for you." />
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-7xl px-4 py-10 text-sm text-muted sm:px-6">
        Polity demo · Bay Area pilot · Analysis by Claude Sonnet · Map tiles © Esri, data © OpenStreetMap contributors
      </footer>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value?: number; tone?: "green" }) {
  return (
    <div className="rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className={cx("text-2xl font-semibold tabular-nums", tone === "green" ? "text-green-700" : "text-ink")}>{value ?? "–"}</div>
      <div className="text-xs font-medium text-muted">{label}</div>
    </div>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>
        <span className="text-xs font-semibold text-muted">STEP {n}</span>
      </div>
      <div className="mt-4 font-semibold">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-5">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-brand shadow-sm">{icon}</span>
      <div className="mt-3 font-semibold">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
