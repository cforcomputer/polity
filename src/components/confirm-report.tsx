"use client";

import { useState } from "react";
import { Building2, GitMerge, MapPin, Sparkles, SplitSquareHorizontal, TriangleAlert } from "lucide-react";
import { Button, CategoryIcon, PriorityPill, StatusPill, TypeTag, cx } from "./ui";
import { CATEGORIES, type Analysis, type Category, type Status } from "@/lib/types";

export interface AnalyzeResponse {
  analysis: Analysis;
  city: string;
  match: { id: string; title: string; status: Status; count: number; distanceKm: number; category: string } | null;
  warning?: string;
}

/**
 * The confirmation step: the resident checks Claude's category and decides
 * whether to join a similar nearby issue.
 */
export function ConfirmReport({
  result,
  text,
  address,
  onBack,
  onConfirm,
  filing,
  compact,
}: {
  result: AnalyzeResponse;
  text: string;
  address: string;
  onBack?: () => void;
  onConfirm: (category: Category, joinClusterId: string | null) => void;
  filing: boolean;
  compact?: boolean;
}) {
  const a = result.analysis;
  const [category, setCategory] = useState<Category>(a.category);
  const [join, setJoin] = useState<boolean>(!!result.match);
  const m = result.match;

  return (
    <div className={cx("space-y-4", compact && "text-sm")}>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
          <Sparkles size={13} /> {a.aiMode === "claude" ? "Analyzed by Claude Sonnet" : "Offline analysis"}
        </span>
        <TypeTag type={a.type} />
      </div>
      {result.warning && (
        <div className="flex gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {result.warning}
        </div>
      )}

      <div>
        <div className={cx("font-semibold leading-snug", compact ? "text-base" : "text-lg")}>{a.title}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{a.summary}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-muted">
          <MapPin size={12} /> {address || "Pinned location"}, {result.city}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-3">
          <div className="text-xs font-medium text-muted">Priority</div>
          <div className="mt-1 flex items-center gap-2">
            <PriorityPill priority={a.priority} />
            <span className="text-xs text-muted">severity {a.severity}/5</span>
          </div>
          <p className="mt-1.5 text-xs leading-snug text-muted">{a.priorityReason}</p>
        </div>
        <div className="rounded-xl border border-line p-3">
          <div className="text-xs font-medium text-muted">Routed to</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <Building2 size={14} className="text-brand" /> {a.department}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line p-3">
        <label className="text-xs font-medium text-muted" htmlFor="cat">
          Is this the right category?
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <CategoryIcon category={category} size={18} />
          <select id="cat" value={category} onChange={(e) => setCategory(e.target.value as Category)} className="h-9 flex-1 rounded-lg border border-line bg-white px-2 text-sm focus:border-brand focus:outline-none">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
                {c === a.category ? " (suggested)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {m ? (
        <div className="rounded-xl border-2 border-brand/30 bg-brand-soft/40 p-3.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <GitMerge size={16} /> A similar issue was already reported nearby
          </div>
          <div className="mt-2 rounded-lg bg-white p-3">
            <div className="font-medium leading-snug">{m.title}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <StatusPill status={m.status} />
              <span>
                {m.count} {m.count === 1 ? "resident" : "residents"} · {m.distanceKm < 1 ? `${Math.round(m.distanceKm * 1000)} m` : `${m.distanceKm.toFixed(1)} km`} away
              </span>
            </div>
            {a.matchReason && <p className="mt-2 text-xs italic leading-snug text-muted">“{a.matchReason}”</p>}
          </div>
          <div className="mt-3 text-sm font-medium">Add your report to this issue?</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Choice active={join} onClick={() => setJoin(true)} icon={<GitMerge size={15} />} title="Yes, same problem" body={`Become report #${m.count + 1} and raise its priority`} />
            <Choice active={!join} onClick={() => setJoin(false)} icon={<SplitSquareHorizontal size={15} />} title="No, it's different" body="File it as a new, separate issue" />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-canvas p-3 text-sm text-muted">No similar open issue within 1.5 km, so this will start a new issue.</div>
      )}

      <div className="flex gap-2 pt-1">
        {onBack && (
          <Button variant="secondary" onClick={onBack} disabled={filing}>
            Edit report
          </Button>
        )}
        <Button className="flex-1" onClick={() => onConfirm(category, m && join ? m.id : null)} loading={filing}>
          {m && join ? "Confirm and join issue" : "Confirm and file report"}
        </Button>
      </div>
      {!compact && <p className="text-xs text-muted">Your report text: “{text}”</p>}
    </div>
  );
}

function Choice({ active, onClick, icon, title, body }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; body: string }) {
  return (
    <button onClick={onClick} className={cx("rounded-lg border-2 p-2.5 text-left transition-colors", active ? "border-brand bg-white" : "border-transparent bg-white/60 hover:bg-white")}>
      <div className={cx("flex items-center gap-1.5 text-sm font-semibold", active ? "text-brand" : "text-ink")}>
        {icon} {title}
      </div>
      <div className="mt-0.5 text-xs text-muted">{body}</div>
    </button>
  );
}
