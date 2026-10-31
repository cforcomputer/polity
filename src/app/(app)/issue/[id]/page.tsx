"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Building2, CheckCircle2, Circle, HandHeart, MapPin, Users } from "lucide-react";
import { api, useLive, useSession } from "@/components/session";
import { IssueMap } from "@/components/map";
import { Button, Card, CategoryChip, ChannelIcon, PriorityPill, Spinner, StatusPill, TypeTag, cx } from "@/components/ui";
import { STATUS_META, timeAgo } from "@/lib/meta";
import { STATUSES, type PublicCluster, type Report } from "@/lib/types";

type IssueReport = Report & { mine: boolean };

export default function IssuePage() {
  return (
    <Suspense fallback={<div className="p-10"><Spinner label="Loading issue…" /></div>}>
      <Issue />
    </Suspense>
  );
}

function Issue() {
  const { id } = useParams<{ id: string }>();
  const { user, toast, refresh } = useSession();
  const { data, reload } = useLive<{ cluster: PublicCluster; reports: IssueReport[]; error?: string }>(`/api/clusters/${id}`);

  if (!data) return <div className="p-10"><Spinner label="Loading issue…" /></div>;
  if (!data.cluster) return <div className="mx-auto max-w-lg p-10 text-center text-muted">This issue doesn&apos;t exist (it may have been merged). <Link href="/map" className="text-brand">Back to the map</Link></div>;
  const c = data.cluster;
  const reports = data.reports;
  const reached = STATUSES.indexOf(c.status);

  async function meToo() {
    if (!user) return toast({ title: "Sign in with UniGov", body: "Verified residents can support an issue.", href: `/unigov/login?next=/issue/${id}`, tone: "info" });
    try {
      await api(`/api/clusters/${id}/support`);
      reload();
      refresh();
    } catch (e) {
      toast({ title: "Couldn't add support", body: (e as Error).message, tone: "warn" });
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/map" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Heatmap
      </Link>
      <div className="mt-3 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CategoryChip category={c.category} />
              <TypeTag type={c.type} />
              <PriorityPill priority={c.priority} />
              {c.mine && <span className="rounded bg-unigov-soft px-1.5 py-0.5 text-[11px] font-semibold text-unigov">YOU REPORTED THIS</span>}
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">{c.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              <span className="flex items-center gap-1">
                <MapPin size={14} /> {reports.at(-1)?.address ? `${reports.at(-1)!.address}, ` : ""}
                {c.city}
              </span>
              <span className="flex items-center gap-1">
                <Building2 size={14} /> {c.department}
              </span>
              <span>First reported {timeAgo(c.createdAt)}</span>
            </div>
            <p className="mt-4 text-[15px] leading-relaxed">{c.summary}</p>
          </div>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Progress</h2>
              <StatusPill status={c.status} />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {STATUSES.map((s, i) => (
                <div key={s}>
                  <div className={cx("h-1.5 rounded-full", i <= reached ? "" : "bg-slate-200")} style={i <= reached ? { background: STATUS_META[c.status].color } : undefined} />
                  <div className={cx("mt-1.5 text-xs font-medium", i <= reached ? "text-ink" : "text-muted")}>{STATUS_META[s].label}</div>
                </div>
              ))}
            </div>
            <ol className="mt-5 space-y-4">
              {[...c.updates].reverse().map((u, i) => (
                <li key={u.at + i} className="flex gap-3">
                  {u.status === "resolved" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-green-600" /> : <Circle size={18} className="mt-0.5 shrink-0" style={{ color: STATUS_META[u.status].color }} />}
                  <div>
                    <div className="text-sm">
                      <span className="font-medium">{STATUS_META[u.status].label}</span> <span className="text-muted">· {timeAgo(u.at)} · {u.by}</span>
                    </div>
                    {u.note && <p className="mt-0.5 text-sm leading-snug text-muted">{u.note}</p>}
                  </div>
                </li>
              ))}
              <li className="flex gap-3">
                <Circle size={18} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="text-sm">
                  <span className="font-medium">Reported</span> <span className="text-muted">· {timeAgo(c.createdAt)} · by residents</span>
                </div>
              </li>
            </ol>
          </Card>

          <div>
            <h2 className="mb-3 font-semibold">
              {reports.length} resident {reports.length === 1 ? "report" : "reports"}
            </h2>
            <div className="space-y-2.5">
              {reports.map((r) => (
                <Card key={r.id} className={cx("p-4", r.mine && "ring-2 ring-unigov/30")}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{r.mine ? "You" : r.authorName}</span>
                    {r.mine && <span className="rounded bg-unigov-soft px-1.5 py-0.5 text-[10px] font-semibold text-unigov">YOUR REPORT</span>}
                    <span className="text-xs text-muted">· {timeAgo(r.createdAt)}</span>
                    <span className="ml-auto">
                      <ChannelIcon channel={r.channel} />
                    </span>
                  </div>
                  <p className="mt-1.5 text-[15px] leading-relaxed">{r.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden">
            <IssueMap clusters={[c]} heat={reports.map((r) => ({ lat: r.lat, lng: r.lng, weight: 0.7 }))} className="h-60 w-full" zoom={15} center={[c.lat, c.lng]} scrollWheelZoom={false} />
          </Card>
          <Card className="p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-3xl font-semibold tabular-nums">
              <Users size={24} className="text-brand" />
              {c.count}
            </div>
            <div className="text-sm text-muted">residents reported or support this</div>
            {c.status !== "resolved" && !c.mine && (
              <Button className="mt-4 w-full" variant={c.supported ? "primary" : "secondary"} onClick={meToo}>
                <HandHeart size={16} /> {c.supported ? "You support this" : "Me too: this affects me"}
              </Button>
            )}
            {c.status !== "resolved" && (
              <Link href="/report" className="mt-2 block text-sm font-medium text-brand">
                Add details in a new report
              </Link>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
