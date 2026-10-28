"use client";

import Link from "next/link";
import { Building2, Car, ClipboardList, Coins, CreditCard, FileCog, ScrollText, Settings, ShieldCheck, Users, Wallet, Wrench, type LucideIcon } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import type { Permission } from "@/types";
import { PageHeader } from "@/components/ui/layout-bits";
import { EmptyState } from "@/components/ui/feedback";

interface AdminLink {
  href: string;
  label: string;
  description: string;
  permission: Permission;
  icon: LucideIcon;
}

const SECTIONS: { title: string; links: AdminLink[] }[] = [
  {
    title: "Configuration",
    links: [
      { href: "/administration/vehicle-config", label: "Vehicle Configuration", description: "Vehicle types, classes, body types, uses, fuel and technical fields.", permission: "vehicle_config.manage", icon: Car },
      { href: "/administration/fees", label: "Fees & Penalties", description: "Fee rules by transaction, vehicle and use. Sample amounts are labelled.", permission: "fees.manage", icon: Coins },
      { href: "/administration/requirements", label: "Requirements", description: "Document, inspection and field requirements, with a rule tester.", permission: "requirements.manage", icon: ClipboardList },
      { href: "/administration/registration-config", label: "Registration Configuration", description: "Transaction types, validity, statuses and plate categories.", permission: "settings.manage", icon: FileCog },
    ],
  },
  {
    title: "Locations & payments",
    links: [
      { href: "/administration/offices", label: "RTA Offices", description: "Registration offices that users, plates and terminals belong to.", permission: "offices.manage", icon: Building2 },
      { href: "/administration/inspection-centers", label: "Inspection Centers", description: "Roadworthiness inspection sites.", permission: "centers.manage", icon: Wrench },
      { href: "/administration/offices/payment-locations", label: "Payment Locations", description: "Offices with POS terminals and the channels available.", permission: "offices.manage", icon: Wallet },
      { href: "/administration/terminals", label: "POS Terminals", description: "Card terminal fleet, assignments and connection tests.", permission: "terminals.manage", icon: CreditCard },
    ],
  },
  {
    title: "Access & audit",
    links: [
      { href: "/administration/users", label: "Users", description: "Staff accounts, roles and office assignments.", permission: "users.manage", icon: Users },
      { href: "/administration/roles", label: "Roles & Permissions", description: "What each role can see and do.", permission: "roles.manage", icon: ShieldCheck },
      { href: "/administration/audit-logs", label: "Audit Logs", description: "Read-only record of significant actions.", permission: "audit.view", icon: ScrollText },
      { href: "/administration/settings", label: "Settings", description: "System name, payment channels, registration and demo settings.", permission: "settings.manage", icon: Settings },
    ],
  },
];

export default function AdministrationPage() {
  const { can, ready } = useDemoUser();
  const visible = SECTIONS.map((s) => ({ ...s, links: s.links.filter((l) => can(l.permission)) })).filter((s) => s.links.length);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration" title="Administration" description="Configuration, locations, access control and audit for the PNG RTA Motor Vehicle Registration & Payment System." />
      {ready && !visible.length ? (
        <EmptyState title="No administration access" message="Your role does not include any administration permissions. Ask an RTA administrator if you need access." />
      ) : (
        visible.map((s) => (
          <section key={s.title} aria-labelledby={`admin-${s.title}`} className="flex flex-col gap-3">
            <h2 id={`admin-${s.title}`} className="eb">{s.title}</h2>
            <ul className="g3 m-0 list-none p-0">
              {s.links.map((l) => {
                const Icon = l.icon;
                return (
                  <li key={l.href}>
                    <Link href={l.href} className="card flex h-full items-start gap-3 p-4 no-underline transition-shadow hover:shadow-md" style={{ color: "inherit" }}>
                      <span className="ic bg-[#eeeefe] text-[#1515e8]" aria-hidden="true"><Icon size={20} /></span>
                      <span className="min-w-0">
                        <span className="block text-[15px] font-bold">{l.label}</span>
                        <span className="mut mt-0.5 block text-[13px]">{l.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
