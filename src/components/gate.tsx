"use client";

import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useSession } from "./session";
import { Card, Spinner } from "./ui";

/** Renders children only for a signed-in, verified UniGov resident. */
export function VerifiedGate({ next, children }: { next: string; children: React.ReactNode }) {
  const { loaded, user } = useSession();
  if (!loaded) return <div className="p-10"><Spinner label="Loading…" /></div>;
  if (!user)
    return (
      <GateCard
        icon={<ShieldCheck size={22} />}
        title="Sign in with UniGov to file a report"
        body="Polity accepts reports from verified Bay Area residents only. That keeps the data trustworthy for the people who act on it."
        href={`/unigov/login?next=${encodeURIComponent(next)}`}
        cta="Sign in with UniGov"
        secondary={{ href: `/unigov/register?next=${encodeURIComponent(next)}`, label: "Create a UniGov account" }}
      />
    );
  if (!user.verified)
    return (
      <GateCard
        icon={<ShieldAlert size={22} />}
        title="Verify your identity to continue"
        body="Upload a photo of your driver's license, state ID or passport. It takes under a minute."
        href={`/unigov/verify?next=${encodeURIComponent(next)}`}
        cta="Verify my identity"
      />
    );
  return <>{children}</>;
}

function GateCard({ icon, title, body, href, cta, secondary }: { icon: React.ReactNode; title: string; body: string; href: string; cta: string; secondary?: { href: string; label: string } }) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <Card className="p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-unigov-soft text-unigov">{icon}</div>
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <Link href={href} className="mt-6 flex h-11 items-center justify-center rounded-xl bg-unigov font-medium text-white hover:bg-unigov-dark">
          {cta}
        </Link>
        {secondary && (
          <Link href={secondary.href} className="mt-3 block text-sm font-medium text-unigov">
            {secondary.label}
          </Link>
        )}
      </Card>
    </div>
  );
}
