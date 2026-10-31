import { BAY_BOUNDS, cityCenter, distanceKm, inBayArea, nearestCity } from "./geo";

/**
 * Turn whatever a resident said about "where" into a point, with a cascade that
 * never dead-ends inside the Bay Area:
 *   street address → intersection → named place → free text → street → city center.
 * Nominatim can't geocode intersections, so those are computed from the two streets'
 * OSM geometry (the nearest pair of points where the lines meet).
 */

export interface LocationParts {
  /** Free-text description, e.g. "North Point St & Webster St, San Francisco". */
  query?: string;
  houseNumber?: string;
  street?: string;
  crossStreet?: string;
  place?: string;
  city?: string;
}

export type Precision = "address" | "intersection" | "place" | "street" | "city";

export interface Located {
  lat: number;
  lng: number;
  label: string;
  precision: Precision;
}

const UA = "Polity/0.2 (civic issue reporting; polity.geckur.com)";
const VIEWBOX = `${BAY_BOUNDS.west},${BAY_BOUNDS.north},${BAY_BOUNDS.east},${BAY_BOUNDS.south}`;

// Nominatim's usage policy allows one request per second; queue ours.
let nextSlot = 0;
async function nominatim(params: Record<string, string>): Promise<NominatimRow[]> {
  const wait = Math.max(0, nextSlot - Date.now());
  nextSlot = Math.max(Date.now(), nextSlot) + 1050;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const q = new URLSearchParams({ format: "jsonv2", countrycodes: "us", viewbox: VIEWBOX, bounded: "1", ...params });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
    return res.ok ? ((await res.json()) as NominatimRow[]) : [];
  } catch {
    return [];
  }
}

interface NominatimRow {
  lat: string;
  lon: string;
  display_name: string;
  geojson?: { type: string; coordinates: unknown };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

const SUFFIX: Record<string, string> = {
  st: "Street", str: "Street", ave: "Avenue", av: "Avenue", blvd: "Boulevard", bl: "Boulevard", rd: "Road", dr: "Drive",
  ln: "Lane", ct: "Court", pl: "Place", hwy: "Highway", pkwy: "Parkway", pky: "Parkway", ter: "Terrace", cir: "Circle",
  sq: "Square", expy: "Expressway", fwy: "Freeway", aly: "Alley", wy: "Way", plz: "Plaza", trl: "Trail",
};
const DIRECTION: Record<string, string> = { n: "North", s: "South", e: "East", w: "West" };

/** "north point st" → "North Point Street"; "w. san carlos" → "West San Carlos". */
export function normalizeStreet(raw: string): string {
  const words = raw
    .replace(/[.,]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .map((w, i) => {
      const lw = w.toLowerCase();
      if (i === words.length - 1 && i > 0 && SUFFIX[lw]) return SUFFIX[lw];
      if (i === 0 && words.length > 1 && DIRECTION[lw]) return DIRECTION[lw];
      if (/^\d+(st|nd|rd|th)$/i.test(w)) return lw;
      if (/^[a-z]+-\d+$/i.test(w)) return w.toUpperCase();
      return w.length <= 2 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

const CITY_ALIASES: Record<string, string> = {
  sf: "San Francisco", "san fran": "San Francisco", "san fransisco": "San Francisco", frisco: "San Francisco", "the city": "San Francisco",
  oak: "Oakland", "the town": "Oakland", sj: "San Jose", "san josé": "San Jose", ssf: "South San Francisco", epa: "East Palo Alto",
  "palo alto": "Palo Alto", berkley: "Berkeley",
};

export function normalizeCity(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined;
  const c = raw.trim().replace(/,?\s*(ca|california|usa)$/i, "").trim();
  return CITY_ALIASES[c.toLowerCase()] ?? c.replace(/\b\w/g, (m) => m.toUpperCase());
}

/** "1600-1698" or "1600–98" → "1600". */
function firstNumber(raw?: string): string | undefined {
  return raw?.match(/\d+[A-Za-z]?/)?.[0];
}

/** Split free text like "North Point & Webster" / "Webster at North Point" into two streets. */
export function splitIntersection(text: string): [string, string] | null {
  const m = text.split(/\s*(?:&|\/|@|\bat\b|\band\b|\bcorner of\b|\bx\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  if (m.length !== 2) return null;
  // Drop a trailing ", City" from the second street.
  const b = m[1].split(",")[0].trim();
  const a = m[0].replace(/^(the )?(intersection|corner) of\s+/i, "").trim();
  return a && b ? [a, b] : null;
}

// ---------------------------------------------------------------------------
// Intersection from street geometry
// ---------------------------------------------------------------------------

type Pt = [number, number]; // [lng, lat]

/** Freeways are tagged by ref in OSM ("I 880", "US 101", "CA 24"), not by the name people say. */
function highwayRef(street: string): string | null {
  const s = street.trim().replace(/\./g, "");
  let m = s.match(/^(?:i|interstate)[\s-]*(\d+)$/i);
  if (m) return `I ${m[1]}`;
  m = s.match(/^us(?:\s*highway)?[\s-]*(\d+)$/i);
  if (m) return `US ${m[1]}`;
  m = s.match(/^(?:sr|ca|hwy|highway|state route|route)[\s-]*(\d+)$/i);
  if (m) return m[1] === "101" ? "US 101" : `CA ${m[1]}`;
  return null;
}

/** A street's OSM geometry. `near` narrows the search to a box, so long streets and freeways return the right stretch. */
async function streetLines(street: string, city?: string, near?: string): Promise<Pt[][]> {
  const ref = highwayRef(street);
  const center = city ? cityCenter(city) : null;
  // Unincorporated areas sit outside a city's legal limits: also search a box around its center.
  const cityBox = center ? `${center[1] - 0.12},${center[0] + 0.1},${center[1] + 0.12},${center[0] - 0.1}` : undefined;
  const names = ref ? [ref] : hasSuffix(street) ? [street] : [street, `${street} Street`, `${street} Avenue`];
  const attempts: Record<string, string>[] = [];
  for (const name of names) {
    if (near) attempts.push({ q: name, viewbox: near });
    else if (ref) attempts.push({ q: city ? `${name}, ${city}` : name }, ...(cityBox ? [{ q: name, viewbox: cityBox }] : []));
    else if (city) attempts.push({ street: name, city, state: "California" }, ...(cityBox ? [{ q: name, viewbox: cityBox }] : []));
    else attempts.push({ q: name });
  }
  for (const a of attempts) {
    const lines = toLines(await nominatim({ ...a, polygon_geojson: "1", dedupe: "0", limit: "50" }));
    if (lines.length) return lines;
  }
  return [];
}

function hasSuffix(street: string): boolean {
  const last = street.trim().split(/\s+/).at(-1)!.toLowerCase();
  return Object.values(SUFFIX).some((v) => v.toLowerCase() === last) || last in SUFFIX || /^(way|walk|row|loop|mall|bridge|tunnel|crossing)$/.test(last);
}

function toLines(rows: NominatimRow[]): Pt[][] {
  const lines: Pt[][] = [];
  for (const r of rows) {
    const g = r.geojson;
    if (!g) continue;
    if (g.type === "LineString") lines.push(g.coordinates as Pt[]);
    else if (g.type === "MultiLineString") lines.push(...(g.coordinates as Pt[][]));
  }
  return lines;
}

/** Meters between two [lng,lat] points (equirectangular is plenty at street scale). */
function meters(a: Pt, b: Pt): number {
  const k = Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  return Math.hypot((a[0] - b[0]) * 111_320 * k, (a[1] - b[1]) * 110_574);
}

/** Proper crossing point of segments p1p2 and p3p4, if any. */
function crossing(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-15) return null;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] : null;
}

/** All places where the two streets meet (shared nodes, crossings, or near-touches under 40 m). */
function meetings(a: Pt[][], b: Pt[][]): Pt[] {
  const out: Pt[] = [];
  for (const la of a)
    for (const lb of b) {
      let best: { d: number; p: Pt } | null = null;
      for (let i = 0; i < la.length; i++)
        for (let j = 0; j < lb.length; j++) {
          const d = meters(la[i], lb[j]);
          if (!best || d < best.d) best = { d, p: [(la[i][0] + lb[j][0]) / 2, (la[i][1] + lb[j][1]) / 2] };
          if (i + 1 < la.length && j + 1 < lb.length) {
            const x = crossing(la[i], la[i + 1], lb[j], lb[j + 1]);
            if (x) best = { d: 0, p: x };
          }
        }
      if (best && best.d < 40) out.push(best.p);
    }
  return out;
}

/** "west,north,east,south" around the points, padded by `pad` degrees (~400 m). */
function boxAround(pts: Pt[], pad: number): string {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return `${Math.min(...xs) - pad},${Math.max(...ys) + pad},${Math.max(...xs) + pad},${Math.min(...ys) - pad}`;
}

async function intersection(s1: string, s2: string, city?: string): Promise<Located | null> {
  const a = normalizeStreet(s1);
  const b = normalizeStreet(s2);
  // Look up the ordinary street first (freeways second), then the other only around it.
  const [first, second] = highwayRef(a) && !highwayRef(b) ? [b, a] : [a, b];
  const l1 = await streetLines(first, city);
  if (!l1.length) return null;
  const box = boxAround(l1.flat(), 0.004);
  const l2 = await streetLines(second, city, box);
  const hits = meetings(l1, l2).filter(([lng, lat]) => inBayArea(lat, lng));
  if (!hits.length) return null;
  // Streets can meet more than once; prefer the meeting nearest the named city's center.
  const center = city ? cityCenter(city) : null;
  hits.sort((p, q) => (center ? distanceKm(p[1], p[0], center[0], center[1]) - distanceKm(q[1], q[0], center[0], center[1]) : 0));
  const [lng, lat] = hits[0];
  return { lat, lng, label: `${a} & ${b}, ${city ?? nearestCity(lat, lng)}`, precision: "intersection" };
}

// ---------------------------------------------------------------------------
// Point lookups
// ---------------------------------------------------------------------------

function short(display: string): string {
  return display
    .split(",")
    .map((s) => s.trim())
    .filter((s) => !/County|California|United States|^\d{5}$/.test(s))
    .slice(0, 3)
    .join(", ");
}

function pick(rows: NominatimRow[], city?: string): NominatimRow | null {
  const center = city ? cityCenter(city) : null;
  const inside = rows.filter((r) => inBayArea(Number(r.lat), Number(r.lon)));
  if (!center) return inside[0] ?? null;
  // With a city named, reject same-named streets elsewhere in the Bay.
  return inside.find((r) => distanceKm(Number(r.lat), Number(r.lon), center[0], center[1]) < 25) ?? null;
}

async function komoot(q: string, city?: string): Promise<Located | null> {
  const center = city ? cityCenter(city) : null;
  const params = new URLSearchParams({ q, limit: "5", bbox: `${BAY_BOUNDS.west},${BAY_BOUNDS.south},${BAY_BOUNDS.east},${BAY_BOUNDS.north}` });
  if (center) {
    params.set("lat", String(center[0]));
    params.set("lon", String(center[1]));
  }
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const d = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string> }[] };
    for (const f of d.features) {
      const [lng, lat] = f.geometry.coordinates;
      if (!inBayArea(lat, lng)) continue;
      if (center && distanceKm(lat, lng, center[0], center[1]) > 25) continue;
      const p = f.properties;
      const label = [p.name, [p.housenumber, p.street].filter(Boolean).join(" "), p.city].filter(Boolean).join(", ");
      return { lat, lng, label: label || q, precision: p.housenumber ? "address" : p.osm_key === "highway" ? "street" : "place" };
    }
  } catch {
    /* fall through */
  }
  return null;
}

const cache = new Map<string, Located | null>();

export async function locate(parts: LocationParts): Promise<Located | null> {
  const key = JSON.stringify(parts);
  if (cache.has(key)) return cache.get(key)!;
  const result = await locateUncached(parts);
  cache.set(key, result);
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return result;
}

async function locateUncached(parts: LocationParts): Promise<Located | null> {
  const city = normalizeCity(parts.city);
  let street = parts.street?.trim();
  let cross = parts.crossStreet?.trim();
  const num = firstNumber(parts.houseNumber);
  // Free text that is really an intersection: "North Point & Webster".
  if (!street && parts.query) {
    const split = splitIntersection(parts.query.split(",")[0]);
    if (split) [street, cross] = split;
  }

  // 1. Street address.
  if (num && street) {
    const s = `${num} ${normalizeStreet(street)}`;
    const row = pick(await nominatim(city ? { street: s, city, state: "California", limit: "5" } : { q: s, limit: "5" }), city);
    if (row) return { lat: Number(row.lat), lng: Number(row.lon), label: short(row.display_name), precision: "address" };
    const k = await komoot(`${s}${city ? `, ${city}` : ""}`, city);
    if (k) return { ...k, precision: k.precision === "street" ? "street" : "address" };
  }

  // 2. Intersection.
  if (street && cross) {
    const hit = await intersection(street, cross, city);
    if (hit) return hit;
  }

  // 3. Named place or landmark.
  if (parts.place) {
    const q = `${parts.place}${city ? `, ${city}` : ""}`;
    const row = pick(await nominatim({ q, limit: "5" }), city);
    if (row) return { lat: Number(row.lat), lng: Number(row.lon), label: short(row.display_name), precision: "place" };
    const k = await komoot(q, city);
    if (k) return k;
  }

  // 4. Whatever the resident typed.
  if (parts.query) {
    const row = pick(await nominatim({ q: parts.query, limit: "5" }), city);
    if (row) return { lat: Number(row.lat), lng: Number(row.lon), label: short(row.display_name), precision: "place" };
    const k = await komoot(parts.query, city);
    if (k) return k;
  }

  // 5. The street alone: its stretch nearest the city center.
  if (street) {
    const lines = await streetLines(normalizeStreet(street), city);
    const center = city ? cityCenter(city) : null;
    const pts = lines.flat().filter(([lng, lat]) => inBayArea(lat, lng));
    if (pts.length) {
      pts.sort((p, q) => (center ? distanceKm(p[1], p[0], center[0], center[1]) - distanceKm(q[1], q[0], center[0], center[1]) : 0));
      const [lng, lat] = pts[Math.floor(center ? 0 : pts.length / 2)];
      return { lat, lng, label: `${normalizeStreet(street)}, ${city ?? nearestCity(lat, lng)}`, precision: "street" };
    }
  }

  // 6. The city itself, so a report is never lost; staff can refine the pin.
  if (city) {
    const c = cityCenter(city);
    if (c) return { lat: c[0], lng: c[1], label: city, precision: "city" };
    const row = pick(await nominatim({ city, state: "California", limit: "1" }));
    if (row) return { lat: Number(row.lat), lng: Number(row.lon), label: city, precision: "city" };
  }
  return null;
}

/** Search box on the web form: a few candidates for free text, intersections included. */
export async function searchText(q: string): Promise<Located[]> {
  const [head, ...rest] = q.split(",");
  const split = splitIntersection(head);
  const city = normalizeCity(rest.join(",").trim() || undefined);
  if (split) {
    const hit = await intersection(split[0], split[1], city);
    if (hit) return [hit];
  }
  const rows = (await nominatim({ q, limit: "5" })).filter((r) => inBayArea(Number(r.lat), Number(r.lon)));
  if (rows.length) return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: short(r.display_name), precision: "place" as const }));
  const one = await locate({ query: q, city });
  return one ? [one] : [];
}
