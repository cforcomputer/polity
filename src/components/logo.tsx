/** Original Polity mark: a white pin on a navy tile. */
export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""}`}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-dark text-white shadow-sm">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 1 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.6" />
        </svg>
      </span>
      <span className={`text-[17px] font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>Polity</span>
    </span>
  );
}
