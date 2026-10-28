"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoUser } from "@/hooks/use-demo-user";
import type { Permission } from "@/types";

const LOCATION_VIEWS: { href: string; label: string; permission: Permission }[] = [
  { href: "/administration/offices", label: "RTA Offices", permission: "offices.manage" },
  { href: "/administration/inspection-centers", label: "Inspection Centers", permission: "centers.manage" },
  { href: "/administration/offices/payment-locations", label: "Payment Locations", permission: "offices.manage" },
];

/** Sub-navigation between the three location views; hides views the role cannot open. */
export function LocationsNav() {
  const pathname = usePathname();
  const { can } = useDemoUser();
  const views = LOCATION_VIEWS.filter((v) => can(v.permission));
  if (views.length < 2) return null;
  return (
    <nav aria-label="Location types" className="tabs no-print">
      {views.map((v) => {
        const on = pathname === v.href;
        return (
          <Link key={v.href} href={v.href} className={`tab ${on ? "tab-on" : ""}`} aria-current={on ? "page" : undefined}>
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
