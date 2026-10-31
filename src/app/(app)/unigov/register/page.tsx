"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useSession } from "@/components/session";
import { UniGovShell, useNext } from "@/components/unigov-shell";
import { Button, Field, inputCls } from "@/components/ui";

const CITIES = [
  "Alameda", "Antioch", "Berkeley", "Concord", "Daly City", "Dublin", "East Palo Alto", "Fairfield", "Fremont", "Hayward", "Livermore",
  "Mill Valley", "Milpitas", "Mountain View", "Napa", "Novato", "Oakland", "Palo Alto", "Petaluma", "Pleasanton", "Redwood City",
  "Richmond", "San Francisco", "San Jose", "San Leandro", "San Mateo", "San Rafael", "Santa Clara", "Santa Rosa", "South San Francisco",
  "Sunnyvale", "Vallejo", "Walnut Creek", "Other Bay Area city",
];

export default function RegisterPage() {
  const router = useRouter();
  const next = useNext("/report");
  const { refresh } = useSession();
  const [f, setF] = useState({ name: "", email: "", password: "", dob: "", city: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/register", f);
      await refresh();
      router.push(`/unigov/verify?next=${encodeURIComponent(next)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <UniGovShell step={1}>
      <h1 className="text-2xl font-semibold tracking-tight">Create your UniGov account</h1>
      <p className="mt-1 text-sm text-muted">Use your legal name exactly as it appears on your ID.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full legal name">
            <input className={inputCls} value={f.name} onChange={set("name")} autoComplete="name" placeholder="e.g. Maria Elena Garcia" required />
          </Field>
        </div>
        <Field label="Email">
          <input className={inputCls} type="email" value={f.email} onChange={set("email")} autoComplete="email" required />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input className={inputCls} type="password" value={f.password} onChange={set("password")} autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Date of birth">
          <input className={inputCls} type="date" value={f.dob} onChange={set("dob")} required />
        </Field>
        <Field label="City of residence">
          <select className={inputCls} value={f.city} onChange={set("city")} required>
            <option value="">Choose…</option>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</div>}
        <div className="sm:col-span-2">
          <Button variant="unigov" size="lg" className="w-full" loading={busy}>
            Continue to identity verification
          </Button>
          <p className="mt-3 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link href={`/unigov/login?next=${encodeURIComponent(next)}`} className="font-medium text-unigov">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </UniGovShell>
  );
}
