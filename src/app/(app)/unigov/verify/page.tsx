"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CheckCircle2, CreditCard, ImageUp, ScanLine, ShieldCheck, XCircle } from "lucide-react";
import { api, useSession } from "@/components/session";
import { UniGovShell, useNext } from "@/components/unigov-shell";
import { Button, Spinner, cx } from "@/components/ui";

interface VerifyResult {
  ok: boolean;
  reasons: string[];
  extracted?: { type: string; name: string; expiry: string | null; issuer: string };
}

export default function VerifyPage() {
  const router = useRouter();
  const next = useNext("/report");
  const { user, loaded, refresh } = useSession();
  const [file, setFile] = useState<{ data: string; type: string; preview: string } | null>(null);
  const [busy, setBusy] = useState<"ai" | "sample" | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (!loaded) return <UniGovShell step={2}><Spinner label="Loading…" /></UniGovShell>;
  if (!user)
    return (
      <UniGovShell step={2}>
        <p className="text-sm">
          <Link href={`/unigov/login?next=${encodeURIComponent(`/unigov/verify?next=${next}`)}`} className="font-medium text-unigov">Sign in</Link> first.
        </p>
      </UniGovShell>
    );

  function pick(f: File | undefined) {
    if (!f) return;
    setResult(null);
    setError(null);
    if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) return setError("Use a JPG, PNG or WEBP photo.");
    if (f.size > 5_000_000) return setError("Photo must be under 5 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setFile({ data: url.split(",")[1], type: f.type, preview: url });
    };
    reader.readAsDataURL(f);
  }

  async function verify(sample: boolean) {
    setBusy(sample ? "sample" : "ai");
    setError(null);
    try {
      const r = await api<{ result: VerifyResult }>("/api/auth/verify", sample ? { sample: true } : { image: file!.data, mediaType: file!.type });
      setResult(r.result);
      await refresh();
      if (r.result.ok) setTimeout(() => router.push(next), 1600);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (user.verified && !result)
    return (
      <UniGovShell step={3}>
        <Verified name={user.name} doc={user.idDoc?.type} next={next} />
      </UniGovShell>
    );

  return (
    <UniGovShell step={result?.ok ? 3 : 2}>
      <h1 className="text-2xl font-semibold tracking-tight">Verify your identity</h1>
      <p className="mt-1 text-sm text-muted">
        Upload a clear photo of the front of your driver&apos;s license, state ID or passport. We check that it&apos;s a valid, unexpired document in the name <span className="font-medium text-ink">{user.name}</span>.
      </p>

      <div
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
        className={cx("mt-6 grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors", file ? "border-unigov/40 bg-unigov-soft/40" : "border-line hover:bg-slate-50")}
      >
        {file ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.preview} alt="ID preview" className="max-h-52 rounded-lg shadow" />
        ) : (
          <div className="py-6">
            <ImageUp size={30} className="mx-auto text-unigov" />
            <div className="mt-2 font-medium">Drop a photo of your ID or click to upload</div>
            <div className="text-xs text-muted">JPG, PNG or WEBP, up to 5 MB</div>
          </div>
        )}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {busy === "ai" && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-unigov-soft p-3 text-sm text-unigov">
          <ScanLine size={16} className="animate-pulse" /> Reading the document with Claude…
        </div>
      )}

      {result && (
        <div className={cx("mt-4 rounded-xl border p-4", result.ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50")}>
          <div className={cx("flex items-center gap-2 font-semibold", result.ok ? "text-green-800" : "text-red-800")}>
            {result.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {result.ok ? "Identity verified" : "We couldn't verify this document"}
          </div>
          {result.extracted && (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Document</dt>
              <dd>{result.extracted.type || "—"}</dd>
              <dt className="text-muted">Name</dt>
              <dd>{result.extracted.name || "—"}</dd>
              <dt className="text-muted">Expires</dt>
              <dd>{result.extracted.expiry ?? "—"}</dd>
              <dt className="text-muted">Issuer</dt>
              <dd>{result.extracted.issuer || "—"}</dd>
            </dl>
          )}
          {result.reasons.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-red-800">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {result.ok && <div className="mt-2 text-sm text-green-800">Taking you to Polity…</div>}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button variant="unigov" size="lg" className="flex-1" disabled={!file || !!busy} loading={busy === "ai"} onClick={() => verify(false)}>
          <ShieldCheck size={18} /> Verify document
        </Button>
        <Button variant="secondary" size="lg" loading={busy === "sample"} disabled={!!busy} onClick={() => verify(true)} title="Skip the upload in demos">
          <CreditCard size={18} /> Use sample ID (demo)
        </Button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Your photo is sent once to our verification model to read the name, document type and expiry date. Only those fields are stored; the image is discarded immediately.
      </p>
    </UniGovShell>
  );
}

function Verified({ name, doc, next }: { name: string; doc?: string; next: string }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-700">
        <CheckCircle2 size={30} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">You&apos;re verified, {name.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted">{doc ? `Verified with your ${doc}.` : "Your identity is verified."}</p>
      <Link href={next} className="mx-auto mt-6 flex h-11 w-60 items-center justify-center rounded-xl bg-brand font-medium text-white">
        Continue to Polity
      </Link>
    </div>
  );
}
