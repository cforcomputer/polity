import type { Category, ReportType, Status } from "./types";

export const CATEGORY_META: Record<Category, { color: string; department: string; icon: string }> = {
  "Roads & Potholes": { color: "#d97706", department: "Public Works – Streets", icon: "Construction" },
  "Traffic Safety": { color: "#dc2626", department: "Transportation – Traffic Engineering", icon: "TriangleAlert" },
  "Public Transit": { color: "#7c3aed", department: "Transit Agency", icon: "TramFront" },
  "Streetlights & Signals": { color: "#ca8a04", department: "Transportation – Signals & Lighting", icon: "Lightbulb" },
  "Water & Sewer": { color: "#0284c7", department: "Water Utility", icon: "Droplets" },
  "Flooding & Drainage": { color: "#0891b2", department: "Public Works – Stormwater", icon: "Waves" },
  "Sanitation & Dumping": { color: "#65a30d", department: "Sanitation Services", icon: "Trash2" },
  "Parks & Trees": { color: "#16a34a", department: "Parks & Recreation", icon: "Trees" },
  "Sidewalks & Accessibility": { color: "#9333ea", department: "Public Works – Sidewalks & ADA", icon: "Accessibility" },
  "Bike & Pedestrian": { color: "#059669", department: "Transportation – Active Mobility", icon: "Bike" },
  "Public Safety": { color: "#b91c1c", department: "Fire & Emergency Services", icon: "Siren" },
  "Housing & Homelessness": { color: "#db2777", department: "Housing & Human Services", icon: "House" },
  "Environment & Noise": { color: "#4d7c0f", department: "Environmental Services", icon: "Leaf" },
  Other: { color: "#64748b", department: "311 General Services", icon: "CircleHelp" },
};

export const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  new: { label: "New", color: "#475569", bg: "#f1f5f9" },
  acknowledged: { label: "Acknowledged", color: "#1d4ed8", bg: "#dbeafe" },
  in_progress: { label: "In progress", color: "#b45309", bg: "#fef3c7" },
  resolved: { label: "Resolved", color: "#15803d", bg: "#dcfce7" },
};

export const TYPE_META: Record<ReportType, { label: string }> = {
  complaint: { label: "Problem" },
  recommendation: { label: "Recommendation" },
  idea: { label: "Idea" },
};

export function priorityLevel(p: number): { label: string; color: string; bg: string } {
  if (p >= 80) return { label: "Critical", color: "#b91c1c", bg: "#fee2e2" };
  if (p >= 60) return { label: "High", color: "#c2410c", bg: "#ffedd5" };
  if (p >= 35) return { label: "Medium", color: "#a16207", bg: "#fef9c3" };
  return { label: "Low", color: "#475569", bg: "#f1f5f9" };
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
