import { connection } from "next/server";
import { json } from "@/lib/auth";
import { nearestCity, reverseGeocode } from "@/lib/geo";
import { searchText } from "@/lib/locate";

/** Proxy to OpenStreetMap Nominatim, bounded to the Bay Area. */
export async function GET(req: Request) {
  await connection();
  const p = new URL(req.url).searchParams;
  const q = p.get("q");
  if (q) return json({ results: await searchText(q) });
  const lat = Number(p.get("lat"));
  const lng = Number(p.get("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const hit = await reverseGeocode(lat, lng);
    return json({
      label: hit?.label ?? `${nearestCity(lat, lng)} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      city: hit?.city ?? nearestCity(lat, lng),
    });
  }
  return json({ results: [] });
}
