"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { IdDocument, Notification } from "@/lib/types";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  city: string;
  role: "citizen" | "staff";
  verified: boolean;
  idDoc: IdDocument | null;
}

interface SessionState {
  loaded: boolean;
  user: SessionUser | null;
  demoMode: boolean;
  simulation: boolean;
  unread: number;
  aiConfigured: boolean;
  /** Bumps whenever server data may have changed; pages refetch on it. */
  tick: number;
  refresh: () => Promise<void>;
  toast: (t: Omit<Toast, "id">) => void;
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export interface Toast {
  id: number;
  title: string;
  body?: string;
  href?: string;
  tone?: "info" | "success" | "warn";
}

const Ctx = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState({ loaded: false, user: null as SessionUser | null, demoMode: true, simulation: false, unread: 0, aiConfigured: true });
  const [tick, setTick] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastNotif = useRef<string | null | undefined>(undefined);
  const nextId = useRef(1);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 7000);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/session", { cache: "no-store" });
      const d = (await r.json()) as typeof s & { latestNotification: Notification | null };
      setS({ loaded: true, user: d.user, demoMode: d.demoMode, simulation: d.simulation, unread: d.unread, aiConfigured: d.aiConfigured });
      const latest = d.latestNotification;
      // Toast a status-change notification the moment it lands.
      if (lastNotif.current !== undefined && latest && latest.id !== lastNotif.current && !latest.read) {
        toast({ title: "Update on an issue you reported", body: latest.message, href: `/issue/${latest.clusterId}`, tone: "success" });
      }
      lastNotif.current = latest?.id ?? null;
      setTick((t) => t + 1);
    } catch {
      /* offline: keep last state */
    }
  }, [toast]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  return <Ctx.Provider value={{ ...s, tick, refresh, toast, toasts, dismiss }}>{children}</Ctx.Provider>;
}

/** Fetch JSON and refetch whenever the session ticks (every ~4s) or deps change. */
export function useLive<T>(url: string | null, deps: unknown[] = []): { data: T | null; reload: () => void } {
  const { tick } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => alive && setData(d as T))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, n, ...deps]);
  return { data, reload: () => setN((x) => x + 1) };
}

export async function api<T = unknown>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error ?? `Request failed (${r.status})`);
  return d as T;
}

const noop = () => () => {};

/** False on the server and during hydration, true afterwards. Gates session-dependent UI in late-hydrating trees. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
