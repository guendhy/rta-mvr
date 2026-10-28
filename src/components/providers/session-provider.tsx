"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_EVENT } from "@/lib/mock-storage";
import { authService } from "@/services/auth.service";
import type { SessionInfo } from "@/services/interfaces";
import type { Permission, RoleKey } from "@/types";

interface SessionContextValue {
  session: SessionInfo | null;
  ready: boolean;
  can: (p: Permission) => boolean;
  canAny: (ps: Permission[]) => boolean;
  login: (email: string, password: string) => Promise<SessionInfo>;
  logout: () => Promise<void>;
  switchRole: (role: RoleKey) => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    setSession(await authService.getSession());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    // Permission edits and user changes made on other screens apply immediately.
    let t: ReturnType<typeof setTimeout> | undefined;
    const onChange = (e: Event) => {
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (key && !["permissions", "users", "session", "*"].includes(key)) return;
      clearTimeout(t);
      t = setTimeout(refresh, 50);
    };
    window.addEventListener(STORAGE_EVENT, onChange);
    return () => window.removeEventListener(STORAGE_EVENT, onChange);
  }, [refresh]);

  const value = useMemo<SessionContextValue>(() => {
    const perms = new Set(session?.permissions ?? []);
    return {
      session,
      ready,
      can: (p) => perms.has(p),
      canAny: (ps) => ps.some((p) => perms.has(p)),
      login: async (email, password) => {
        const s = await authService.login(email, password);
        setSession(s);
        return s;
      },
      logout: async () => {
        await authService.logout();
        setSession(null);
      },
      switchRole: async (role) => {
        setSession(await authService.switchRole(role));
      },
      refresh,
    };
  }, [session, ready, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
