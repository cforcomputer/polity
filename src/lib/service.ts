import { db, newId, save } from "./db";
import { distanceKm } from "./geo";
import { CATEGORY_META } from "./meta";
import { clusterPriority } from "./scoring";
import type { Candidate } from "./ai";
import { notifyByImessage } from "./photon";
import type { Analysis, Category, Channel, Cluster, PublicCluster, PublicReport, Report, Status, User } from "./types";

const MATCH_RADIUS_KM = 1.5;

function visible<T extends { demo: boolean }>(items: T[]): T[] {
  return db().settings.demoMode ? items : items.filter((i) => !i.demo);
}

export function candidatesNear(lat: number, lng: number): Candidate[] {
  return visible(db().clusters)
    .filter((c) => c.status !== "resolved")
    .map((c) => ({ c, d: distanceKm(lat, lng, c.lat, c.lng) }))
    .filter((x) => x.d <= MATCH_RADIUS_KM)
    .sort((a, b) => a.d - b.d)
    .slice(0, 8)
    .map(({ c, d }) => ({ id: c.id, title: c.title, category: c.category, summary: c.summary, distanceKm: d, count: c.reportIds.length }));
}

export function toPublicCluster(c: Cluster, user: User | null): PublicCluster {
  const reports = db().reports;
  return {
    ...c,
    brief: user?.role === "staff" ? c.brief : undefined,
    count: c.reportIds.length + c.supporters.length,
    mine: !!user && c.reportIds.some((id) => reports.find((r) => r.id === id)?.userId === user.id),
    supported: !!user && c.supporters.includes(user.id),
  };
}

export function publicClusters(user: User | null): PublicCluster[] {
  return visible(db().clusters)
    .map((c) => toPublicCluster(c, user))
    .sort((a, b) => b.priority - a.priority);
}

export function publicReports(user: User | null, opts: { mine?: boolean; limit?: number } = {}): PublicReport[] {
  const { clusters } = db();
  let rows = visible(db().reports);
  if (opts.mine) rows = rows.filter((r) => user && r.userId === user.id);
  return rows
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, opts.limit ?? 120)
    .map((r) => {
      const c = clusters.find((x) => x.id === r.clusterId)!;
      return {
        ...r,
        mine: !!user && r.userId === user.id,
        cluster: { id: c.id, title: c.title, status: c.status, count: c.reportIds.length + c.supporters.length, priority: c.priority },
      };
    });
}

export interface NewReportInput {
  user: User | null;
  authorName: string;
  channel: Channel;
  text: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  analysis: Analysis;
  category: Category;
  joinClusterId: string | null;
  demo?: boolean;
  createdAt?: string;
}

export function fileReport(input: NewReportInput): { report: Report; cluster: Cluster; joined: boolean } {
  const store = db();
  const now = input.createdAt ?? new Date().toISOString();
  const a = input.analysis;
  let cluster = input.joinClusterId ? store.clusters.find((c) => c.id === input.joinClusterId) : undefined;
  const joined = !!cluster;

  const report: Report = {
    id: newId("r"),
    userId: input.user?.id ?? null,
    authorName: input.authorName,
    channel: input.channel,
    text: input.text,
    type: a.type,
    category: input.category,
    title: a.title,
    severity: a.severity,
    priority: a.priority,
    priorityReason: a.priorityReason,
    department: a.department || CATEGORY_META[input.category].department,
    lat: input.lat,
    lng: input.lng,
    address: input.address,
    city: input.city,
    clusterId: "",
    createdAt: now,
    aiMode: a.aiMode,
    demo: input.demo ?? false,
  };

  if (!cluster) {
    cluster = {
      id: newId("c"),
      title: a.title,
      summary: a.summary,
      category: input.category,
      type: a.type,
      status: "new",
      priority: 0,
      department: report.department,
      lat: input.lat,
      lng: input.lng,
      city: input.city,
      reportIds: [],
      supporters: [],
      createdAt: now,
      updatedAt: now,
      updates: [],
      demo: input.demo ?? false,
    };
    store.clusters.push(cluster);
  } else if (cluster.status === "resolved") {
    setStatus(cluster, "new", "Reopened: a resident reported the issue again.", "Polity");
  }

  report.clusterId = cluster.id;
  store.reports.push(report);
  cluster.reportIds.push(report.id);
  recompute(cluster);
  save();
  return { report, cluster, joined };
}

function recompute(cluster: Cluster): void {
  const reports = db().reports.filter((r) => r.clusterId === cluster.id);
  cluster.priority = clusterPriority(reports.map((r) => r.priority), reports.length + cluster.supporters.length);
  // Centroid of all reports keeps the heat spot honest as the cluster grows.
  cluster.lat = reports.reduce((s, r) => s + r.lat, 0) / reports.length;
  cluster.lng = reports.reduce((s, r) => s + r.lng, 0) / reports.length;
  cluster.updatedAt = new Date().toISOString();
}

export function support(clusterId: string, user: User): Cluster | null {
  const c = db().clusters.find((x) => x.id === clusterId);
  if (!c) return null;
  if (c.supporters.includes(user.id)) c.supporters = c.supporters.filter((id) => id !== user.id);
  else c.supporters.push(user.id);
  recompute(c);
  save();
  return c;
}

/** Linked residents: everyone who reported into the cluster or pressed "me too". */
function linkedUserIds(cluster: Cluster): string[] {
  const ids = new Set<string>(cluster.supporters);
  for (const r of db().reports) if (r.clusterId === cluster.id && r.userId) ids.add(r.userId);
  return [...ids];
}

const STATUS_VERB: Record<Status, string> = {
  new: "was reopened",
  acknowledged: "was acknowledged",
  in_progress: "is now in progress",
  resolved: "has been resolved",
};

export function setStatus(cluster: Cluster, status: Status, note: string, by: string): void {
  const now = new Date().toISOString();
  cluster.status = status;
  cluster.updatedAt = now;
  cluster.updates.push({ at: now, status, note, by });
  const base = process.env.PUBLIC_BASE_URL?.replace(/\/$/, "");
  for (const userId of linkedUserIds(cluster)) {
    notifyByImessage(
      userId,
      `Update on “${cluster.title}”: it ${STATUS_VERB[status]}.${note ? ` ${note}` : ""}${base ? ` ${base}/issue/${cluster.id}` : ""}`,
      `gov-status:${cluster.id}:${status}:${now}`,
    );
    db().notifications.push({
      id: newId("n"),
      userId,
      clusterId: cluster.id,
      message: `“${cluster.title}” ${STATUS_VERB[status]}${note ? `: ${note}` : "."}`,
      createdAt: now,
      read: false,
    });
  }
  save();
}

export function mergeClusters(targetId: string, sourceId: string): Cluster | null {
  const store = db();
  const target = store.clusters.find((c) => c.id === targetId);
  const source = store.clusters.find((c) => c.id === sourceId);
  if (!target || !source || target === source) return null;
  for (const r of store.reports) if (r.clusterId === source.id) r.clusterId = target.id;
  target.reportIds.push(...source.reportIds);
  target.supporters = [...new Set([...target.supporters, ...source.supporters])];
  store.clusters = store.clusters.filter((c) => c !== source);
  recompute(target);
  target.updates.push({ at: new Date().toISOString(), status: target.status, note: `Merged ${source.reportIds.length} report(s) from “${source.title}”.`, by: "Staff" });
  save();
  return target;
}

export function stats() {
  const clusters = visible(db().clusters);
  const reports = visible(db().reports);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const resolved = clusters.filter((c) => c.status === "resolved");
  const days = resolved
    .map((c) => {
      const end = c.updates.findLast((u) => u.status === "resolved")?.at ?? c.updatedAt;
      return (new Date(end).getTime() - new Date(c.createdAt).getTime()) / 86_400_000;
    })
    .sort((a, b) => a - b);
  return {
    reports: reports.length,
    reportsThisWeek: reports.filter((r) => new Date(r.createdAt).getTime() > weekAgo).length,
    openClusters: clusters.filter((c) => c.status !== "resolved").length,
    critical: clusters.filter((c) => c.status !== "resolved" && c.priority >= 80).length,
    resolved: resolved.length,
    medianDaysToResolve: days.length ? Math.round(days[Math.floor(days.length / 2)] * 10) / 10 : null,
    cities: new Set(reports.map((r) => r.city)).size,
  };
}
