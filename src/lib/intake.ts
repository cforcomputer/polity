import { analyzeOffline, analyzeWithClaude, describeError, type Candidate } from "./ai";
import { db } from "./db";
import { nearestCity, reverseGeocode } from "./geo";
import { candidatesNear } from "./service";
import type { Analysis, Status } from "./types";

export interface MatchInfo {
  id: string;
  title: string;
  status: Status;
  count: number;
  distanceKm: number;
  category: string;
}

export interface AnalyzeResult {
  analysis: Analysis;
  city: string;
  match: MatchInfo | null;
  candidates: Candidate[];
  warning?: string;
}

/** Shared by the web form, the chat agent and the phone/WhatsApp webhooks. */
export async function analyze(text: string, lat: number, lng: number, address: string): Promise<AnalyzeResult> {
  const candidates = candidatesNear(lat, lng);
  // Real municipality from OSM, looked up while Claude works; nearest-centroid as fallback.
  const cityLookup = reverseGeocode(lat, lng).then((h) => h?.city ?? null);
  let analysis: Analysis;
  let warning: string | undefined;
  try {
    analysis = await analyzeWithClaude({ text, address, city: nearestCity(lat, lng), lat, lng }, candidates);
  } catch (e) {
    console.error("[analyze] falling back to offline classifier:", e);
    warning = `Claude unavailable (${describeError(e)}); used offline analysis.`;
    analysis = analyzeOffline({ text, address, city: nearestCity(lat, lng) }, candidates);
  }
  const city = (await cityLookup) ?? nearestCity(lat, lng);
  const cand = candidates.find((c) => c.id === analysis.matchClusterId);
  const cluster = cand ? db().clusters.find((c) => c.id === cand.id) : undefined;
  return {
    analysis,
    city,
    candidates,
    warning,
    match:
      cand && cluster
        ? { id: cluster.id, title: cluster.title, status: cluster.status, count: cluster.reportIds.length + cluster.supporters.length, distanceKm: cand.distanceKm, category: cluster.category }
        : null,
  };
}
