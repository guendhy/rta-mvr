"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { appConfig } from "@/lib/config";
import { registrationService } from "@/services/registration.service";
import { isActive, NAV, type NavGroup } from "./nav-config";

export function useNavGroups(): NavGroup[] {
  const { canAny } = useDemoUser();
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => canAny(i.anyOf)) })).filter((g) => g.items.length);
}

export function useStatusCounts() {
  const { data } = useServiceQuery(() => registrationService.list(), []);
  const counts = new Map<string, number>();
  for (const a of data ?? []) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  return counts;
}

export function NavList({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const groups = useNavGroups();
  const counts = useStatusCounts();

  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.label}>
          {!collapsed && <p className="eb mb-1.5 px-2.5 text-[10.5px]">{g.label}</p>}
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {g.items.map((item) => {
              const on = isActive(item.href, pathname, search);
              const count = item.countStatuses?.reduce((s, st) => s + (counts.get(st) ?? 0), 0) ?? 0;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex min-h-[40px] items-center gap-3 rounded-lg px-2.5 text-[13.5px] no-underline transition-colors ${on ? "bg-[#eeeefe] font-bold text-[#1515e8]" : "font-medium text-[#1f2229] hover:bg-[#f4f5f8] hover:text-[#0b0b0f]"} ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon size={18} strokeWidth={1.9} aria-hidden="true" className="flex-none" />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {!collapsed && count > 0 && (
                      <span className={`grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-[#1515e8] text-white" : "bg-[#edeff3] text-[#474d59]"}`}>{count}</span>
                    )}
                    {collapsed && <span className="sr">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { can } = useDemoUser();
  return (
    <aside
      className={`no-print sticky top-[68px] hidden h-[calc(100vh-68px)] flex-none flex-col border-r border-[#e1e4ea] bg-white transition-[width] md:flex ${collapsed ? "w-[72px]" : "w-[264px]"}`}
      aria-label="Main navigation"
    >
      <div className="flex-1 overflow-y-auto px-3 pt-4 pb-4">
        {can("registration.create") && (
          <Link href="/registrations/new" className={`btn btn-p mb-4 w-full no-underline ${collapsed ? "btn-icon" : ""}`} title="New Motorcycle Registration">
            <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
            {collapsed ? <span className="sr">New Motorcycle Registration</span> : "New Motorcycle Registration"}
          </Link>
        )}
        <NavList collapsed={collapsed} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-[#e1e4ea] px-3 py-2.5">
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <span className="text-[12px] font-semibold text-[#1f2229]">Authorized RTA Personnel Only</span>
            <span className="mono text-[11px] text-[#5a606c]">v{appConfig.version}</span>
          </div>
        )}
        <button type="button" className="btn btn-g btn-icon flex-none" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
    </aside>
  );
}
