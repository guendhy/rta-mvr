"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Files, House, Menu, Plus } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { RoleSwitcher } from "./role-switcher";
import { NavList } from "./sidebar";
import { Drawer } from "@/components/ui/modal";

/** Bottom navigation for phones: Home · Applications · Register · Payments · More. */
export function MobileNav({ onMore, force }: { onMore: () => void; force?: boolean }) {
  const pathname = usePathname();
  const { can, canAny } = useDemoUser();
  const item = (href: string, label: string, Icon: typeof House, on: boolean) => (
    <Link href={href} aria-current={on ? "page" : undefined} className={`flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-[11px] no-underline ${on ? "font-bold text-[#1515e8]" : "font-semibold text-[#5a606c]"}`}>
      <Icon size={22} aria-hidden="true" />{label}
    </Link>
  );
  return (
    <nav aria-label="Primary" className={`no-print fixed right-0 bottom-0 left-0 z-40 grid h-[76px] grid-cols-5 items-center border-t border-[#e1e4ea] bg-white pb-2 ${force ? "" : "md:hidden"}`}>
      {item(can("dashboard.view") ? "/dashboard" : "/reports", "Home", House, pathname === "/dashboard")}
      {canAny(["registration.view", "approval.view"]) ? item("/registrations", "Applications", Files, pathname.startsWith("/registrations") && pathname !== "/registrations/new") : canAny(["inspection.view"]) ? item("/inspections", "Inspections", Files, pathname.startsWith("/inspections")) : item("/registry", "Registry", Files, pathname.startsWith("/registry"))}
      {can("registration.create") ? (
        <Link href="/registrations/new" className="-mt-[26px] flex flex-col items-center gap-[3px] text-[11px] font-bold text-[#0b0b0f] no-underline">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#1515e8] text-white shadow-[0_6px_16px_rgba(21,21,232,.35)]"><Plus size={26} strokeWidth={2.6} aria-hidden="true" /></span>
          Register
        </Link>
      ) : <span aria-hidden="true" />}
      {can("payment.view") ? item("/payments", "Payments", CreditCard, pathname.startsWith("/payments")) : can("plates.view") ? item("/plates", "Plates", CreditCard, pathname.startsWith("/plates")) : <span aria-hidden="true" />}
      <button type="button" onClick={onMore} className="flex min-h-[52px] flex-col items-center justify-center gap-[3px] text-[11px] font-semibold text-[#5a606c]">
        <Menu size={22} aria-hidden="true" />More
      </button>
    </nav>
  );
}

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Menu">
      <div className="flex flex-col gap-4 p-3">
        <div className="flex flex-col gap-2.5 rounded-lg bg-[#f4f5f8] p-3">
          <RoleSwitcher />
          <button type="button" className="btn btn-sm w-full !bg-[#ffd21a] !text-[#0b0b0f]" onClick={() => { onClose(); window.dispatchEvent(new Event("rta:open-demo-tools")); }}>Open Demo Tools</button>
        </div>
        <NavList onNavigate={onClose} />
      </div>
    </Drawer>
  );
}
