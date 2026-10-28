"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/constants";
import { homeRouteFor, canAccessRoute } from "@/lib/permissions";
import { userService } from "@/services/user.service";
import type { RoleKey } from "@/types";

/** QA-only: switch the active role without signing out. Navigation updates immediately. */
export function RoleSwitcher({ dark, compact }: { dark?: boolean; compact?: boolean }) {
  const id = useId();
  const router = useRouter();
  const { role, switchRole } = useDemoUser();
  const { data: matrix } = useServiceQuery(() => userService.getPermissions(), []);
  if (!role) return null;
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "min-w-[200px]"}`}>
      <label htmlFor={id} className={`text-[11.5px] font-semibold whitespace-nowrap ${dark ? "text-[#c4c7d0]" : "text-[#5a606c]"}`}>Demo Role</label>
      <select
        id={id}
        value={role}
        onChange={async (e) => {
          const next = e.target.value as RoleKey;
          await switchRole(next);
          toast.success(`Now acting as ${ROLE_LABELS[next]}`);
          if (matrix && !canAccessRoute(matrix, next, window.location.pathname)) router.push(homeRouteFor(matrix, next));
        }}
        className={`h-9 rounded-md px-2 text-[13px] font-semibold ${dark ? "border border-[#3a3d48] bg-[#1c1d24] text-white" : "inp !h-10"}`}
      >
        {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
    </div>
  );
}
