"use client";

import { useSession } from "@/components/providers/session-provider";
import { ROLE_LABELS } from "@/lib/constants";

/** Current demo user, active QA role and permission helpers. */
export function useDemoUser() {
  const { session, can, canAny, switchRole, logout, ready } = useSession();
  return {
    ready,
    user: session?.user ?? null,
    office: session?.office ?? null,
    role: session?.activeRole ?? null,
    roleLabel: session ? ROLE_LABELS[session.activeRole] : "",
    isRoleOverridden: !!session && session.activeRole !== session.user.role,
    can,
    canAny,
    switchRole,
    logout,
  };
}
