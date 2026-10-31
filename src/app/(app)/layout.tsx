import { Suspense } from "react";
import { SessionProvider } from "@/components/session";
import { Header } from "@/components/header";
import { DemoDock } from "@/components/demo-dock";
import { Toasts } from "@/components/toasts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Suspense fallback={<div className="h-16 border-b border-line bg-white" />}>
        <Header />
      </Suspense>
      <main className="flex-1 flex flex-col">{children}</main>
      <Suspense>
        <DemoDock />
      </Suspense>
      <Toasts />
    </SessionProvider>
  );
}
