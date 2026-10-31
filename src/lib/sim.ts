import { db, save } from "./db";
import { CATEGORY_META } from "./meta";
import { DEMO_CITIZEN_ID, RESOLUTION_DEMO_CLUSTER, SIM_SCRIPT } from "./seed";
import { fileReport, setStatus } from "./service";
import type { Analysis } from "./types";

const g = globalThis as unknown as { __govTicker?: boolean };

/** Start the background simulation loop once per server process. */
export function ensureTicker(): void {
  if (g.__govTicker) return;
  g.__govTicker = true;
  const loop = () => {
    try {
      const s = db().settings;
      if (s.demoMode && s.simulation) simulateOne();
    } catch (e) {
      console.error("[sim]", e);
    }
    setTimeout(loop, 8000 + Math.random() * 4000);
  };
  setTimeout(loop, 4000);
}

export function simulateOne() {
  const store = db();
  const item = SIM_SCRIPT[store.settings.simulationCursor % SIM_SCRIPT.length];
  store.settings.simulationCursor++;
  const target = item.joinKey ? store.clusters.find((c) => c.id === `c_${item.joinKey}`) : undefined;
  const nc = item.newCluster;
  const category = target?.category ?? nc?.category ?? "Other";
  const analysis: Analysis = {
    type: nc?.type ?? "complaint",
    category,
    title: target?.title ?? nc?.title ?? item.text.slice(0, 60),
    summary: item.text,
    severity: nc?.severity ?? 3,
    priority: nc?.priority ?? Math.max(30, (target?.priority ?? 50) - 8),
    priorityReason: "Simulated report.",
    department: target?.department ?? CATEGORY_META[category].department,
    matchClusterId: target?.id ?? null,
    matchReason: "",
    aiMode: "offline",
  };
  const res = fileReport({
    user: null,
    authorName: item.author,
    channel: item.channel,
    text: item.text,
    lat: item.lat + (Math.random() - 0.5) * 0.0015,
    lng: item.lng + (Math.random() - 0.5) * 0.0015,
    address: item.address,
    city: item.city,
    analysis,
    category,
    joinClusterId: target?.id ?? null,
    demo: true,
  });
  save();
  return res;
}

const RESOLUTION_STEPS = [
  { at: 0, status: "acknowledged" as const, note: "Caltrans District 4 confirmed the damage from resident photos and scheduled an overnight repair." },
  { at: 7000, status: "in_progress" as const, note: "Crew on site: right lane of northbound I-880 closed 10pm–5am for full-depth pavement repair." },
  { at: 15000, status: "resolved" as const, note: "Potholes patched and the lane resurfaced. Thank you to every resident who reported this." },
];

/** Walk the demo citizen's I-880 cluster from acknowledged to resolved over ~15 seconds. */
export function startResolutionDemo(): { clusterId: string; startedAt: string; steps: { at: number; status: string }[] } | null {
  const store = db();
  const cluster =
    store.clusters.find((c) => c.id === RESOLUTION_DEMO_CLUSTER) ??
    store.clusters
      .filter((c) => c.status !== "resolved" && store.reports.some((r) => r.clusterId === c.id && r.userId === DEMO_CITIZEN_ID))
      .sort((a, b) => b.priority - a.priority)[0];
  if (!cluster) return null;
  if (cluster.status === "resolved") setStatus(cluster, "new", "Reopened for the resolution demo.", "Polity");
  const startedAt = new Date().toISOString();
  const id = cluster.id;
  for (const step of RESOLUTION_STEPS) {
    setTimeout(() => {
      const c = db().clusters.find((x) => x.id === id);
      if (c) setStatus(c, step.status, step.note, c.department);
    }, step.at);
  }
  return { clusterId: id, startedAt, steps: RESOLUTION_STEPS.map(({ at, status }) => ({ at, status })) };
}
