"use client";

import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { BAY_BOUNDS, BAY_CENTER } from "@/lib/geo";
import { CATEGORY_META, STATUS_META, priorityLevel } from "@/lib/meta";
import type { PublicCluster } from "@/lib/types";

type L = typeof Leaflet;

let leafletPromise: Promise<L> | null = null;

/** Leaflet touches `window`, so load it (and the heat plugin, which needs a global L) on the client only. */
function loadLeaflet(): Promise<L> {
  leafletPromise ??= (async () => {
    const mod = await import("leaflet");
    const L = (mod.default ?? mod) as L;
    (window as unknown as { L: L }).L = L;
    await import("leaflet.heat");
    return L;
  })();
  return leafletPromise;
}

// Keyless basemaps: a light gray canvas plus its label layer.
const TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

function baseMap(L: L, el: HTMLElement, opts: { zoom?: number; center?: [number, number]; scrollWheelZoom?: boolean; onSized?: () => void } = {}) {
  const map = L.map(el, {
    center: opts.center ?? BAY_CENTER,
    zoom: opts.zoom ?? 9,
    minZoom: 8,
    maxBounds: L.latLngBounds([BAY_BOUNDS.south - 0.4, BAY_BOUNDS.west - 0.5], [BAY_BOUNDS.north + 0.4, BAY_BOUNDS.east + 0.5]),
    zoomControl: true,
    scrollWheelZoom: opts.scrollWheelZoom ?? true,
    attributionControl: true,
  });
  L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 16 }).addTo(map);
  L.tileLayer(LABELS, { maxZoom: 16, pane: "shadowPane" }).addTo(map);
  // Containers often get their final size after mount (flex layouts); keep Leaflet in sync.
  const created = Date.now();
  const ro = new ResizeObserver(() => {
    map.invalidateSize();
    // Layouts settle after mount; until then, re-apply the intended view on every resize.
    if (Date.now() - created < 4000 && el.clientHeight > 0 && el.clientWidth > 0) {
      map.setView(opts.center ?? BAY_CENTER, opts.zoom ?? 9, { animate: false });
      opts.onSized?.();
    }
  });
  ro.observe(el);
  map.on("unload", () => ro.disconnect());
  return map;
}

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);
}

function bubbleColor(c: PublicCluster): string {
  return c.status === "resolved" ? STATUS_META.resolved.color : priorityLevel(c.priority).color;
}

export function popupHtml(c: PublicCluster): string {
  const s = STATUS_META[c.status];
  const p = priorityLevel(c.priority);
  return `<div style="min-width:220px;max-width:260px">
    <div style="font-size:11px;font-weight:600;color:${CATEGORY_META[c.category].color};text-transform:uppercase;letter-spacing:.03em">${esc(c.category)}</div>
    <div style="font-weight:600;font-size:14px;line-height:1.3;margin:2px 0 6px;color:#0a0a0f">${esc(c.title)}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
      <span style="font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px;color:${s.color};background:${s.bg}">${s.label}</span>
      <span style="font-size:11px;font-weight:600;padding:1px 6px;border-radius:6px;color:${p.color};background:${p.bg}">${p.label} ${c.priority}</span>
      <span style="font-size:11px;color:#63636e">${c.count} report${c.count === 1 ? "" : "s"} · ${esc(c.city)}</span>
    </div>
    <a href="/issue/${c.id}" style="font-size:13px;font-weight:600;color:#1d4ed8;text-decoration:none">View issue →</a>
  </div>`;
}

export interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

/** Public heatmap + cluster bubbles. */
export function IssueMap({
  clusters,
  heat,
  showHeat = true,
  showBubbles = true,
  selectedId,
  onSelect,
  className,
  zoom,
  center,
  scrollWheelZoom,
  highlightMine = true,
  fitToData = false,
}: {
  clusters: PublicCluster[];
  heat: HeatPoint[];
  showHeat?: boolean;
  showBubbles?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  zoom?: number;
  center?: [number, number];
  scrollWheelZoom?: boolean;
  highlightMine?: boolean;
  /** Frame the view around the clusters once they first arrive. */
  fitToData?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const state = useRef<{ L: L; map: Leaflet.Map; heat?: Leaflet.Layer; bubbles?: Leaflet.LayerGroup; markers: Map<string, Leaflet.CircleMarker>; fitted?: Leaflet.LatLngBounds } | null>(null);
  const drawRef = useRef(() => {});
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    let disposed = false;
    loadLeaflet().then((L) => {
      if (disposed || !el.current || state.current) return;
      const map = baseMap(L, el.current, {
        zoom,
        center,
        scrollWheelZoom,
        onSized: () => {
          const b = state.current?.fitted;
          if (b) map.fitBounds(b, { padding: [40, 40], animate: false });
        },
      });
      state.current = { L, map, markers: new Map() };
      // Data may have arrived while Leaflet loaded; draw with the latest props, not this effect's.
      drawRef.current();
    });
    return () => {
      disposed = true;
      state.current?.map.remove();
      state.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const st = state.current;
    if (!st) return;
    const { L, map } = st;
    if (st.heat) map.removeLayer(st.heat);
    if (st.bubbles) map.removeLayer(st.bubbles);
    st.markers.clear();
    if (fitToData && !st.fitted && clusters.length > 1) {
      st.fitted = L.latLngBounds(clusters.map((c) => [c.lat, c.lng] as [number, number]));
      map.fitBounds(st.fitted, { padding: [40, 40], animate: false });
    }
    if (showHeat && heat.length) {
      st.heat = L.heatLayer(
        heat.map((h) => [h.lat, h.lng, h.weight] as [number, number, number]),
        { radius: 28, blur: 22, maxZoom: 14, minOpacity: 0.35, max: 1, gradient: { 0.2: "#3b82f6", 0.45: "#22c55e", 0.65: "#facc15", 0.82: "#f97316", 1: "#dc2626" } },
      ).addTo(map);
    }
    if (showBubbles) {
      const group = L.layerGroup();
      for (const c of clusters) {
        const color = bubbleColor(c);
        const m = L.circleMarker([c.lat, c.lng], {
          radius: 6 + Math.sqrt(c.count) * 3,
          color: highlightMine && c.mine ? "#0f766e" : "#ffffff",
          weight: highlightMine && c.mine ? 3 : 1.5,
          fillColor: color,
          fillOpacity: showHeat ? 0.55 : 0.8,
        });
        m.bindPopup(popupHtml(c), { closeButton: false });
        m.bindTooltip(`${c.title} · ${c.count}`, { direction: "top", offset: [0, -6] });
        m.on("click", () => onSelectRef.current?.(c.id));
        m.addTo(group);
        st.markers.set(c.id, m);
      }
      group.addTo(map);
      st.bubbles = group;
    }
  }

  // Redraw on every data/props change; layers are cheap at this size.
  useEffect(() => {
    drawRef.current = draw;
    draw();
  });

  useEffect(() => {
    const st = state.current;
    if (!st || !selectedId) return;
    const c = clusters.find((x) => x.id === selectedId);
    if (!c) return;
    st.map.flyTo([c.lat, c.lng], Math.max(st.map.getZoom(), 14), { duration: 0.8 });
    setTimeout(() => st.markers.get(selectedId)?.openPopup(), 850);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return <div ref={el} className={className} />;
}

/** Location picker: click or drag the pin. Nearby existing issues shown as faint dots. */
export function LocationPicker({
  value,
  onChange,
  nearby,
  className,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
  nearby: PublicCluster[];
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const state = useRef<{ L: L; map: Leaflet.Map; pin?: Leaflet.Marker; dots?: Leaflet.LayerGroup } | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let disposed = false;
    loadLeaflet().then((L) => {
      if (disposed || !el.current || state.current) return;
      const map = baseMap(L, el.current, { zoom: 10 });
      map.on("click", (e: Leaflet.LeafletMouseEvent) => onChangeRef.current(e.latlng.lat, e.latlng.lng));
      state.current = { L, map };
      sync();
    });
    return () => {
      disposed = true;
      state.current?.map.remove();
      state.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastValue = useRef<string>("");
  function sync() {
    const st = state.current;
    if (!st) return;
    const { L, map } = st;
    if (st.dots) map.removeLayer(st.dots);
    st.dots = L.layerGroup(
      nearby.map((c) =>
        L.circleMarker([c.lat, c.lng], { radius: 5, color: "#fff", weight: 1, fillColor: bubbleColor(c), fillOpacity: 0.7 }).bindTooltip(`${c.title} (${c.count})`),
      ),
    ).addTo(map);
    if (value) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="transform:translate(-50%,-100%)"><svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43s15-14.2 15-26A15 15 0 0 0 2 17c0 11.8 15 26 15 26z" fill="#1d4ed8" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="17" r="5.5" fill="#fff"/></svg></div>`,
        iconSize: [0, 0],
      });
      if (!st.pin) {
        st.pin = L.marker([value.lat, value.lng], { draggable: true, icon }).addTo(map);
        st.pin.on("dragend", () => {
          const p = st.pin!.getLatLng();
          onChangeRef.current(p.lat, p.lng);
        });
      } else st.pin.setLatLng([value.lat, value.lng]);
      const key = `${value.lat.toFixed(5)},${value.lng.toFixed(5)}`;
      if (key !== lastValue.current) {
        lastValue.current = key;
        if (!map.getBounds().pad(-0.15).contains([value.lat, value.lng]) || map.getZoom() < 13) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
      }
    }
  }

  useEffect(sync);

  return <div ref={el} className={className} />;
}
