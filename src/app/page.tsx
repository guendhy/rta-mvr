"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/session-provider";
import { DEFAULT_PERMISSIONS, homeRouteFor } from "@/lib/permissions";

export default function Home() {
  const router = useRouter();
  const { session, ready } = useSession();
  useEffect(() => {
    if (!ready) return;
    router.replace(session ? homeRouteFor(DEFAULT_PERMISSIONS, session.activeRole) : "/login");
  }, [ready, session, router]);
  return <div className="min-h-screen bg-[#0b0b0f]" aria-busy="true" />;
}
