"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserRound, Wrench } from "lucide-react";
import { api, useSession } from "@/components/session";
import { UniGovShell, useNext } from "@/components/unigov-shell";
import { Button, Field, inputCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const next = useNext();
  const { refresh } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("form");
    setError(null);
    try {
      const { user } = await api<{ user: { verified: boolean } }>("/api/auth/login", { email, password });
      await refresh();
      router.push(user.verified ? next : `/unigov/verify?next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  async function demo(role: "citizen" | "staff") {
    setBusy(role);
    await api("/api/auth/demo", { role });
    await refresh();
    router.push(role === "staff" ? "/admin" : next);
  }

  return (
    <UniGovShell>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to UniGov</h1>
      <p className="mt-1 text-sm text-muted">Continue to Polity.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label="Email">
          <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <Button variant="unigov" size="lg" className="w-full" loading={busy === "form"}>
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        New to UniGov?{" "}
        <Link href={`/unigov/register?next=${encodeURIComponent(next)}`} className="font-medium text-unigov">
          Create an account
        </Link>
      </p>
      <div className="mt-8 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Demo accounts</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => demo("citizen")} loading={busy === "citizen"}>
            <UserRound size={16} /> Maya Chen · resident
          </Button>
          <Button variant="secondary" onClick={() => demo("staff")} loading={busy === "staff"}>
            <Wrench size={16} /> Jordan Rivera · staff
          </Button>
        </div>
        <p className="mt-2 text-xs text-amber-800/80">Both use password demo1234 (maya@demo.unigov, jordan.rivera@demo.unigov).</p>
      </div>
    </UniGovShell>
  );
}
