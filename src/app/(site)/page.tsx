"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { IssueMap } from "@/components/map";
import { Logo } from "@/components/logo";
import { CategoryIcon } from "@/components/ui";
import { CATEGORIES } from "@/lib/types";
import type { PublicCluster, PublicReport } from "@/lib/types";

interface Stats {
  reports: number;
  openClusters: number;
  resolved: number;
  cities: number;
}

// App links are plain anchors: on polity.geckur.com the proxy can send them to app.polity.geckur.com.
const APP = "/home";

const STEPS = [
  ["Report", "Type, talk, WhatsApp or call, then drop a pin."],
  ["Triage", "AI sets the category, priority and agency, and groups matching reports."],
  ["Resolve", "Staff work a ranked queue. You're notified at every step."],
];

export default function Site() {
  const [clusters, setClusters] = useState<PublicCluster[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<PublicReport[]>([]);

  useEffect(() => {
    fetch("/api/clusters")
      .then((r) => r.json())
      .then((d) => {
        setClusters(d.clusters);
        setStats(d.stats);
      })
      .catch(() => {});
    fetch("/api/reports?limit=500")
      .then((r) => r.json())
      .then((d) => setReports(d.reports))
      .catch(() => {});
  }, []);

  const heat = reports.map((r) => ({ lat: r.lat, lng: r.lng, weight: Math.max(0.25, r.cluster.priority / 100) }));

  return (
    <div className="flex-1 bg-white">
      <nav className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" aria-label="Polity home">
            <Logo />
          </Link>
          <div className="hidden gap-5 text-sm text-muted sm:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="/map" className="hover:text-ink">Heatmap</a>
            <a href="/feed" className="hover:text-ink">Feed</a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="/unigov/login" className="hidden h-9 items-center rounded-md px-3 text-sm font-medium text-muted hover:text-ink sm:flex">
              Sign in
            </a>
            <a href={APP} className="flex h-9 items-center rounded-md bg-ink px-3.5 text-sm font-medium text-white hover:bg-brand-dark">
              Open app
            </a>
          </div>
        </div>
      </nav>

      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:py-16">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Tell your city what&apos;s broken.
              <span className="block text-brand">Watch it get fixed.</span>
            </h1>
            <p className="mt-4 max-w-md text-lg text-muted">Report problems and ideas in your own words. Polity sends them to the right agency and keeps you posted.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/report" className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-5 font-medium text-white hover:bg-brand-hover">
                Report an issue <ArrowRight size={17} />
              </a>
              <a href="/map" className="inline-flex h-11 items-center rounded-md border border-line px-5 font-medium hover:bg-canvas">
                View the heatmap
              </a>
            </div>
            <ul className="mt-7 space-y-2 text-sm text-muted">
              {["Text, voice, WhatsApp or phone", "Verified residents only, via UniGov", "Public status on every issue"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check size={15} className="text-brand" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-lg border border-line">
            <IssueMap clusters={clusters} heat={heat} className="h-[320px] w-full sm:h-[380px]" zoom={9} scrollWheelZoom={false} highlightMine={false} fitToData />
            <dl className="grid grid-cols-3 divide-x divide-line border-t border-line">
              <Stat label="Reports" value={stats?.reports} />
              <Stat label="Open issues" value={stats?.openClusters} />
              <Stat label="Resolved" value={stats?.resolved} />
            </dl>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="bg-white p-5">
                <div className="font-mono text-xs text-muted">0{i + 1}</div>
                <div className="mt-2 font-semibold">{title}</div>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">Report anything, from potholes to noise</h2>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {CATEGORIES.map((c) => (
              <div key={c} className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2.5 text-sm">
                <CategoryIcon category={c} size={16} />
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-xs text-muted sm:px-6">
        <Logo />
        <span>Bay Area pilot · Analysis by Claude</span>
        <span className="sm:ml-auto">Map tiles © Esri · Data © OpenStreetMap contributors</span>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value?: number }) {
  return (
    <div className="px-4 py-3">
      <dd className="text-xl font-semibold tabular-nums">{value ?? "–"}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
