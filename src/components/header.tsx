"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, ShieldCheck, ShieldAlert, Menu, X } from "lucide-react";
import { api, useHydrated, useSession } from "./session";
import { cx } from "./ui";
import { Logo } from "./logo";
import { timeAgo } from "@/lib/meta";
import type { Notification } from "@/lib/types";

const NAV = [
  { href: "/map", label: "Heatmap" },
  { href: "/feed", label: "Feed" },
  { href: "/report", label: "Report" },
  { href: "/chat", label: "Chat & call" },
  { href: "/admin", label: "Staff dashboard" },
];

export function Header() {
  const session = useSession();
  const hydrated = useHydrated();
  const { demoMode, unread, refresh } = session;
  const user = hydrated ? session.user : null;
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [bell, setBell] = useState(false);

  async function toggleDemo() {
    await api("/api/demo", { action: demoMode ? "demo-off" : "demo-on" });
    await refresh();
  }

  async function logout() {
    await api("/api/auth/logout");
    setMenu(false);
    await refresh();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-[1100] border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="Polity home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cx(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                path.startsWith(n.href) ? "bg-brand-soft text-brand" : "text-muted hover:bg-slate-100 hover:text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleDemo}
            className="hidden items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-slate-50 sm:flex"
            title="Show seeded Bay Area data and demo controls"
          >
            <span className={cx("relative h-4 w-7 rounded-full transition-colors", demoMode ? "bg-amber-500" : "bg-slate-300")}>
              <span className={cx("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all", demoMode ? "left-3.5" : "left-0.5")} />
            </span>
            Demo mode
          </button>
          {user && (
            <div className="relative">
              <button onClick={() => setBell((b) => !b)} className="relative grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-slate-100" aria-label="Notifications">
                <Bell size={18} />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span>
                )}
              </button>
              {bell && <Notifications onClose={() => setBell(false)} />}
            </div>
          )}
          {user ? (
            <div className="relative">
              <button onClick={() => setMenu((m) => !m)} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100">
                <span className={cx("grid h-8 w-8 place-items-center rounded-full text-sm font-semibold text-white", user.role === "staff" ? "bg-brand-dark" : "bg-unigov")}>
                  {user.name[0]}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-medium leading-tight">{user.name}</span>
                  <span className="flex items-center gap-1 text-[11px] leading-tight text-muted">
                    {user.verified ? <ShieldCheck size={11} className="text-unigov" /> : <ShieldAlert size={11} className="text-amber-600" />}
                    {user.role === "staff" ? "Staff · UniGov" : user.verified ? "UniGov verified" : "Not verified"}
                  </span>
                </span>
                <ChevronDown size={14} className="text-muted" />
              </button>
              {menu && (
                <div className="animate-pop-in absolute right-0 top-12 w-60 rounded-xl border border-line bg-white p-1.5 shadow-xl" onMouseLeave={() => setMenu(false)}>
                  <div className="px-3 py-2 text-xs text-muted">{user.email}</div>
                  {!user.verified && (
                    <Link href="/unigov/verify" onClick={() => setMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-amber-700 hover:bg-amber-50">
                      <ShieldAlert size={15} /> Verify your identity
                    </Link>
                  )}
                  <Link href="/feed?mine=1" onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                    My reports
                  </Link>
                  <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link href={`/unigov/login?next=${encodeURIComponent(path)}`} className="flex h-9 items-center gap-2 rounded-lg bg-unigov px-3 text-sm font-medium text-white hover:bg-unigov-dark">
              <ShieldCheck size={16} /> Sign in with UniGov
            </Link>
          )}
          <button className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 lg:hidden" onClick={() => setMobile((m) => !m)} aria-label="Menu">
            {mobile ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav className="border-t border-line bg-white px-4 py-2 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMobile(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-slate-50">
              {n.label}
            </Link>
          ))}
          <button onClick={toggleDemo} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-slate-50">
            Demo mode: {demoMode ? "on" : "off"}
          </button>
        </nav>
      )}
    </header>
  );
}

function Notifications({ onClose }: { onClose: () => void }) {
  const { refresh } = useSession();
  const [items, setItems] = useState<Notification[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications);
        api("/api/notifications").then(refresh);
      });
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    setTimeout(() => document.addEventListener("click", onDoc), 0);
    return () => document.removeEventListener("click", onDoc);
  }, [onClose, refresh]);

  return (
    <div ref={ref} className="animate-pop-in absolute right-0 top-12 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-white shadow-xl">
      <div className="border-b border-line px-4 py-3 text-sm font-semibold">Updates on your reports</div>
      <div className="max-h-96 overflow-y-auto">
        {!items && <div className="p-4 text-sm text-muted">Loading…</div>}
        {items?.length === 0 && <div className="p-4 text-sm text-muted">No updates yet. You&apos;ll hear here when staff act on an issue you reported.</div>}
        {items?.map((n) => (
          <Link key={n.id} href={`/issue/${n.clusterId}`} onClick={onClose} className={cx("block border-b border-line px-4 py-3 text-sm last:border-0 hover:bg-slate-50", !n.read && "bg-brand-soft/50")}>
            <div className="leading-snug">{n.message}</div>
            <div className="mt-1 text-xs text-muted">{timeAgo(n.createdAt)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
