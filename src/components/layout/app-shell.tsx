"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, WifiOff } from "lucide-react";
import { useSession } from "@/components/providers/session-provider";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useNetworkSimulation } from "@/hooks/use-network-simulation";
import { usePosEnvironment } from "@/hooks/use-pos-environment";
import { useServiceQuery } from "@/hooks/use-service";
import { canAccessRoute, homeRouteFor } from "@/lib/permissions";
import { userService } from "@/services/user.service";
import { DemoTools } from "./demo-tools";
import { Header } from "./header";
import { MobileDrawer, MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0b0b0f]" aria-busy="true">
      <div className="flex flex-col items-center gap-4 text-white">
        <Image src="/brand/rta-logo.png" alt="Road Traffic Authority" width={88} height={88} priority />
        <span className="spin" style={{ width: 24, height: 24, color: "#ffd21a" }} aria-hidden="true" />
        <span className="text-[13px] text-[#c4c7d0]">Loading RTA system…</span>
      </div>
    </div>
  );
}

function AccessDenied({ home }: { home: string }) {
  return (
    <div className="card mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 p-8 text-center">
      <ShieldAlert size={40} className="text-[#a3111a]" aria-hidden="true" />
      <h1 className="h2">Access restricted</h1>
      <p className="mut m-0 text-[14px]">Your current role does not have permission to open this page. The attempt has been blocked.</p>
      <Link href={home} className="btn btn-p mt-2">Go to my home page</Link>
    </div>
  );
}

function OfflineBanner() {
  const { network } = useNetworkSimulation();
  if (network === "online") return null;
  return (
    <div role="status" className={`no-print flex items-center gap-2 px-4 py-2 text-[13px] font-semibold ${network === "offline" ? "bg-[#fdecec] text-[#7a0c13]" : "bg-[#fff8d6] text-[#4d3900]"}`}>
      <WifiOff size={16} aria-hidden="true" />
      {network === "offline" ? "Offline — drafts save locally. Payments require an active connection." : "Weak connection — responses are slower. Drafts are saved locally."}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, ready } = useSession();
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false);
  const [drawer, setDrawer] = useState(false);
  const env = usePosEnvironment();
  const { data: matrix } = useServiceQuery(() => userService.getPermissions(), [session?.activeRole]);

  useEffect(() => {
    if (ready && !session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, session, router, pathname]);

  if (!ready || !session) return <Splash />;

  const allowed = matrix ? canAccessRoute(matrix, session.activeRole, pathname) : true;
  const home = matrix ? homeRouteFor(matrix, session.activeRole) : "/dashboard";

  return (
    <div className={`flex min-h-screen flex-col bg-[#f4f5f8] ${env.isPosDevice ? "pos-mode" : ""}`}>
      <a href="#main" className="sr focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-white focus:p-2">Skip to content</a>
      <Header onMenu={() => setDrawer(true)} posMode={env.isPosDevice} />
      <OfflineBanner />
      <div className="flex flex-1 items-stretch">
        <Suspense fallback={null}>
          {!env.isPosDevice && <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />}
        </Suspense>
        <main id="main" className="main">
          {allowed ? children : <AccessDenied home={home} />}
        </main>
      </div>
      <Suspense fallback={null}>
        <MobileNav onMore={() => setDrawer(true)} force={env.isPosDevice} />
        <MobileDrawer open={drawer} onClose={() => setDrawer(false)} />
      </Suspense>
      <DemoTools />
    </div>
  );
}
