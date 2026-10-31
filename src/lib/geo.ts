// Nine-county Bay Area bounding box (Santa Clara to Sonoma/Napa).
export const BAY_BOUNDS = { south: 36.89, north: 38.86, west: -123.6, east: -121.2 };
export const BAY_CENTER: [number, number] = [37.72, -122.25];

export function inBayArea(lat: number, lng: number): boolean {
  return lat >= BAY_BOUNDS.south && lat <= BAY_BOUNDS.north && lng >= BAY_BOUNDS.west && lng <= BAY_BOUNDS.east;
}

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

const CITIES: [string, number, number][] = [
  ["San Francisco", 37.7749, -122.4194],
  ["Oakland", 37.8044, -122.2712],
  ["Berkeley", 37.8715, -122.273],
  ["Emeryville", 37.8313, -122.2852],
  ["Alameda", 37.7652, -122.2416],
  ["San Leandro", 37.7249, -122.1561],
  ["Hayward", 37.6688, -122.0808],
  ["Fremont", 37.5485, -121.9886],
  ["Union City", 37.5934, -122.0438],
  ["Newark", 37.5297, -122.0402],
  ["Livermore", 37.6819, -121.768],
  ["Pleasanton", 37.6624, -121.8747],
  ["Dublin", 37.7022, -121.9358],
  ["San Jose", 37.3382, -121.8863],
  ["Santa Clara", 37.3541, -121.9552],
  ["Sunnyvale", 37.3688, -122.0363],
  ["Mountain View", 37.3861, -122.0839],
  ["Palo Alto", 37.4419, -122.143],
  ["Milpitas", 37.4323, -121.8996],
  ["Cupertino", 37.323, -122.0322],
  ["Campbell", 37.2872, -121.95],
  ["Los Gatos", 37.2358, -121.9624],
  ["Gilroy", 37.0058, -121.5683],
  ["Morgan Hill", 37.1305, -121.6544],
  ["Redwood City", 37.4852, -122.2364],
  ["Menlo Park", 37.453, -122.1817],
  ["East Palo Alto", 37.4688, -122.1411],
  ["San Mateo", 37.563, -122.3255],
  ["Burlingame", 37.5779, -122.348],
  ["South San Francisco", 37.6547, -122.4077],
  ["Daly City", 37.6879, -122.4702],
  ["Pacifica", 37.6138, -122.4869],
  ["Half Moon Bay", 37.4636, -122.4286],
  ["Richmond", 37.9358, -122.3477],
  ["El Cerrito", 37.9161, -122.3108],
  ["Concord", 37.978, -122.0311],
  ["Walnut Creek", 37.9101, -122.0652],
  ["Lafayette", 37.8858, -122.118],
  ["Antioch", 38.0049, -121.8058],
  ["Pittsburg", 38.028, -121.8847],
  ["San Ramon", 37.7799, -121.978],
  ["Martinez", 38.0194, -122.1341],
  ["Vallejo", 38.1041, -122.2566],
  ["Fairfield", 38.2494, -122.04],
  ["Benicia", 38.0494, -122.1586],
  ["Napa", 38.2975, -122.2869],
  ["Santa Rosa", 38.4404, -122.7141],
  ["Petaluma", 38.2324, -122.6367],
  ["Rohnert Park", 38.3396, -122.7011],
  ["San Rafael", 37.9735, -122.5311],
  ["Novato", 38.1074, -122.5697],
  ["Mill Valley", 37.906, -122.545],
  ["Sausalito", 37.8591, -122.4853],
];

/** [lat, lng] of a known Bay Area city center, case-insensitive. */
export function cityCenter(name: string): [number, number] | null {
  const c = CITIES.find((x) => x[0].toLowerCase() === name.trim().toLowerCase());
  return c ? [c[1], c[2]] : null;
}

export function nearestCity(lat: number, lng: number): string {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = distanceKm(lat, lng, c[1], c[2]);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best[0];
}

const UA = "Polity-Demo/0.1 (civic issue reporting prototype)";
const VIEWBOX = `${BAY_BOUNDS.west},${BAY_BOUNDS.north},${BAY_BOUNDS.east},${BAY_BOUNDS.south}`;

export interface GeoResult {
  lat: number;
  lng: number;
  label: string;
}

/** Forward geocode, bounded to the Bay Area. Returns null on failure. */
export async function geocode(q: string): Promise<GeoResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    if (!rows.length) return null;
    return { lat: Number(rows[0].lat), lng: Number(rows[0].lon), label: shortLabel(rows[0].display_name) };
  } catch {
    return null;
  }
}

export async function geocodeMany(q: string): Promise<GeoResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&bounded=1&viewbox=${VIEWBOX}&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    return rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: shortLabel(r.display_name) }));
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<{ label: string; city: string | null } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const row = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    if (!row.display_name) return null;
    const a = row.address ?? {};
    return { label: shortLabel(row.display_name), city: a.city ?? a.town ?? a.village ?? a.hamlet ?? null };
  } catch {
    return null;
  }
}

function shortLabel(display: string): string {
  return display
    .split(",")
    .map((s) => s.trim())
    .filter((s) => !/County|California|United States|^\d{5}$/.test(s))
    .slice(0, 3)
    .join(", ");
}
