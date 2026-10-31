"use client";

import {
  Accessibility,
  Bike,
  CircleHelp,
  Construction,
  Droplets,
  House,
  Leaf,
  Lightbulb,
  Loader2,
  Siren,
  TramFront,
  Trash2,
  Trees,
  TriangleAlert,
  Waves,
  Phone,
  MessageCircle,
  Mic,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_META, STATUS_META, TYPE_META, priorityLevel } from "@/lib/meta";
import type { Category, Channel, ReportType, Status } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  Construction,
  TriangleAlert,
  TramFront,
  Lightbulb,
  Droplets,
  Waves,
  Trash2,
  Trees,
  Accessibility,
  Bike,
  Siren,
  House,
  Leaf,
  CircleHelp,
};

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

export function CategoryIcon({ category, size = 16 }: { category: Category; size?: number }) {
  const Icon = ICONS[CATEGORY_META[category].icon] ?? CircleHelp;
  return <Icon size={size} color={CATEGORY_META[category].color} strokeWidth={2.2} />;
}

export function CategoryChip({ category }: { category: Category }) {
  const color = CATEGORY_META[category].color;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: `${color}40`, color, background: `${color}0d` }}>
      <CategoryIcon category={category} size={13} />
      {category}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: m.color, background: m.bg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

export function PriorityPill({ priority, showScore = true }: { priority: number; showScore?: boolean }) {
  const p = priorityLevel(priority);
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums" style={{ color: p.color, background: p.bg }}>
      {p.label}
      {showScore && <span className="opacity-70">{priority}</span>}
    </span>
  );
}

export function TypeTag({ type }: { type: ReportType }) {
  const styles: Record<ReportType, string> = {
    complaint: "bg-slate-100 text-slate-700",
    recommendation: "bg-sky-50 text-sky-700",
    idea: "bg-violet-50 text-violet-700",
  };
  return <span className={cx("rounded-md px-1.5 py-0.5 text-xs font-medium", styles[type])}>{TYPE_META[type].label}</span>;
}

export function ChannelIcon({ channel, size = 13 }: { channel: Channel; size?: number }) {
  const map: Record<Channel, [LucideIcon, string]> = {
    web: [Globe, "Web"],
    voice: [Mic, "Voice"],
    chat: [MessageCircle, "Chat"],
    whatsapp: [MessageCircle, "WhatsApp"],
    phone: [Phone, "Phone call"],
    imessage: [MessageCircle, "iMessage"],
  };
  const [Icon, label] = map[channel];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted" title={`Filed via ${label}`}>
      <Icon size={size} />
      {label}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "unigov";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: "bg-brand text-white hover:bg-brand-hover shadow-sm",
    secondary: "bg-white text-ink border border-line hover:bg-slate-50 shadow-sm",
    ghost: "text-ink hover:bg-slate-100",
    danger: "bg-red-600 text-white hover:bg-red-700",
    unigov: "bg-unigov text-white hover:bg-unigov-dark shadow-sm",
  }[variant];
  const s = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" }[size];
  return (
    <button
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed", v, s, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(10_10_15/0.04)]", className)}>{children}</div>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
