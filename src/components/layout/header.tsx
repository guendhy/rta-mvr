"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { LogOut, Menu, Search, UserRound } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useNetworkSimulation } from "@/hooks/use-network-simulation";
import { useServiceQuery } from "@/hooks/use-service";
import { initials } from "@/lib/formatting";
import { ROLE_LABELS } from "@/lib/constants";
import { settingsService } from "@/services/settings.service";
import { Flag } from "@/components/ui/layout-bits";
import { Modal } from "@/components/ui/modal";
import { GlobalSearch } from "./global-search";
import { NotificationsMenu } from "./notifications-menu";
import { RoleSwitcher } from "./role-switcher";

export function ConnectivityBadge() {
  const { network } = useNetworkSimulation();
  const map = {
    online: { label: "Online", bg: "#12331f", fg: "#8be0aa", dot: "#1fa84f" },
    weak: { label: "Weak", bg: "#3a2f05", fg: "#ffe27a", dot: "#ffd21a" },
    offline: { label: "Offline", bg: "#3d0d10", fg: "#ffadb1", dot: "#ed1c24" },
  }[network];
  return (
    <span role="status" aria-label={`Connection: ${map.label}`} className="inline-flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-full px-2 sm:px-2.5 text-[12px] font-semibold whitespace-nowrap" style={{ background: map.bg, color: map.fg }}>
      <span className={`h-[7px] w-[7px] rounded-full ${network !== "online" ? "pulse" : ""}`} style={{ background: map.dot }} aria-hidden="true" />
      <span className="hidden sm:inline">{map.label}</span>
    </span>
  );
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return <span className="mono text-[11.5px] text-[#c4c7d0]">{now ? format(now, "EEE d MMM yyyy · HH:mm") : " "}</span>;
}

function UserMenu() {
  const router = useRouter();
  const { user, role, logout } = useDemoUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  if (!user || !role) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-1.5 text-left text-white hover:bg-[#1c1d24]">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#ffd21a] text-[13px] font-extrabold text-[#0b0b0f]" aria-hidden="true">{initials(user)}</span>
        <span className="hidden flex-col xl:flex">
          <span className="text-[13px] font-semibold">{user.firstName} {user.lastName}</span>
          <span className="text-[11.5px] text-[#c4c7d0]">{ROLE_LABELS[role]}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute top-12 right-0 z-[60] w-64 overflow-hidden rounded-xl border border-[#e1e4ea] bg-white text-[#0b0b0f] shadow-2xl">
          <div className="border-b border-[#e1e4ea] px-4 py-3">
            <p className="m-0 text-[14px] font-semibold">{user.firstName} {user.lastName}</p>
            <p className="mut m-0 text-[12.5px]">{user.email}</p>
            <p className="mono mut m-0 mt-1 text-[12px]">{user.employeeNumber} · {ROLE_LABELS[role]}</p>
          </div>
          <div className="p-1.5">
            <Link role="menuitem" href="/dev/demo" onClick={() => setOpen(false)} className="flex min-h-[40px] items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-[#0b0b0f] no-underline hover:bg-[#f4f5f8]"><UserRound size={16} aria-hidden="true" />Session & demo data</Link>
            <button
              role="menuitem"
              type="button"
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13.5px] text-[#a3111a] hover:bg-[#fdecec]"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut size={16} aria-hidden="true" />Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ onMenu, posMode }: { onMenu: () => void; posMode?: boolean }) {
  const { office } = useDemoUser();
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const [searchOpen, setSearchOpen] = useState(false);
  const demo = settings?.demo.enableDemoTools ?? true;

  return (
    <header className="no-print sticky top-0 z-40 bg-[#0b0b0f] text-white">
      <div className="flex min-h-[64px] items-center gap-3 px-3 py-2 sm:px-5 lg:gap-5">
        <button type="button" className={`grid h-11 w-11 flex-none place-items-center rounded-lg hover:bg-[#1c1d24] ${posMode ? "" : "md:hidden"}`} onClick={onMenu} aria-label="Open menu">
          <Menu size={22} aria-hidden="true" />
        </button>
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3 text-white no-underline hover:text-white md:flex-none">
          <Image src="/brand/rta-logo.png" alt="RTA logo" width={42} height={42} priority className="h-9 w-9 sm:h-[42px] sm:w-[42px]" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[12px] font-extrabold tracking-[.08em] sm:text-[13px]"><span className="sm:hidden">RTA</span><span className="hidden sm:inline">ROAD TRAFFIC AUTHORITY</span></span>
            <span className="hidden truncate text-[11.5px] font-medium text-[#c4c7d0] xl:block">Road Traffic Authority — Papua New Guinea · Motor Vehicle Registration &amp; Payment System</span>
            <span className="hidden truncate text-[11px] text-[#c4c7d0] min-[400px]:block xl:hidden">{posMode ? "POS Mode" : "Motor Vehicle Registration"}</span>
          </span>
        </Link>
        {demo && <span className="hidden flex-none rounded-md border border-[#ffd21a] px-2 py-1 text-[10.5px] font-extrabold tracking-[.12em] text-[#ffd21a] sm:inline">DEMO MODE</span>}
        <div className="hidden max-w-[460px] min-w-[140px] flex-1 md:block md:basis-0">
          <GlobalSearch />
        </div>
        <div className="ml-auto flex flex-none items-center gap-1.5 sm:gap-3">
          <div className="hidden flex-col text-right 2xl:flex">
            <span className="text-[12.5px] font-semibold">{office?.name ?? "RTA"}</span>
            <Clock />
          </div>
          {demo && <div className="hidden xl:block"><RoleSwitcher dark compact /></div>}
          <ConnectivityBadge />
          <button type="button" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-[#1c1d24] md:hidden" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Search size={20} aria-hidden="true" />
          </button>
          <NotificationsMenu />
          <UserMenu />
        </div>
      </div>
      <Flag height={4} />
      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Search">
        <div className="min-h-[50vh]">
          <GlobalSearch dark={false} autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      </Modal>
    </header>
  );
}
