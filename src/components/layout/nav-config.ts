import {
  ArrowLeftRight,
  BadgeCheck,
  BarChart3,
  Building2,
  ClipboardCheck,
  Coins,
  CreditCard,
  Database,
  FilePlus2,
  FileSearch,
  Files,
  FileText,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MonitorSmartphone,
  RectangleHorizontal,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Car,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Permission, RegistrationStatus } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  anyOf: Permission[];
  /** Statuses counted for the badge. */
  countStatuses?: RegistrationStatus[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Primary navigation (matches the Claude Design sidebar). Items are filtered by role permissions. */
export const NAV: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, anyOf: ["dashboard.view"] },
      { label: "Applications", href: "/registrations", icon: Files, anyOf: ["registration.view"], countStatuses: ["draft", "pending", "for_inspection", "inspection_failed", "for_insurance_verification", "for_assessment", "payment_required", "for_approval", "returned"] },
    ],
  },
  {
    label: "Vehicle Transactions",
    items: [
      { label: "New Registration", href: "/registrations/new", icon: FilePlus2, anyOf: ["registration.create"] },
      { label: "Renewals", href: "/renewals", icon: RefreshCw, anyOf: ["renewal.view"] },
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight, anyOf: ["transfer.view"] },
      { label: "Other Transactions", href: "/registrations/new?start=existing", icon: Wrench, anyOf: ["registration.create"] },
    ],
  },
  {
    label: "Motor Vehicle Registry",
    items: [
      { label: "All Vehicles", href: "/registry", icon: Database, anyOf: ["registry.view"] },
      { label: "Expiring Soon", href: "/registry?status=expiring_soon", icon: Car, anyOf: ["registry.view"] },
      { label: "Expired", href: "/registry?status=expired", icon: Car, anyOf: ["registry.view"] },
    ],
  },
  {
    label: "Verification & Inspection",
    items: [
      { label: "Verification Queue", href: "/documents", icon: FileSearch, anyOf: ["documents.view"], countStatuses: ["pending"] },
      { label: "Inspection Queue", href: "/inspections", icon: ClipboardCheck, anyOf: ["inspection.view"], countStatuses: ["for_inspection", "inspection_failed"] },
      { label: "Inspection History", href: "/inspections?tab=history", icon: ScrollText, anyOf: ["inspection.view"] },
      { label: "Insurance", href: "/insurance", icon: ShieldCheck, anyOf: ["insurance.view"], countStatuses: ["for_insurance_verification"] },
    ],
  },
  {
    label: "Payments",
    items: [
      { label: "Payment Processing", href: "/payments", icon: CreditCard, anyOf: ["payment.view"], countStatuses: ["payment_required"] },
      { label: "POS Terminal", href: "/payments/pos", icon: Smartphone, anyOf: ["payment.process"] },
      { label: "Payment History", href: "/payments?tab=history", icon: Coins, anyOf: ["payment.view"] },
    ],
  },
  {
    label: "Approvals & Issuance",
    items: [
      { label: "Approvals", href: "/registrations/approval", icon: BadgeCheck, anyOf: ["approval.view"], countStatuses: ["for_approval"] },
      { label: "Plate Inventory", href: "/plates", icon: RectangleHorizontal, anyOf: ["plates.view"] },
      { label: "Plate Assignment", href: "/plates?tab=assign", icon: BadgeCheck, anyOf: ["plates.assign"], countStatuses: ["approved"] },
      { label: "Documents", href: "/documents?tab=certificates", icon: FileText, anyOf: ["documents.view"] },
    ],
  },
  { label: "Reports", items: [{ label: "Reports", href: "/reports", icon: BarChart3, anyOf: ["reports.view"] }] },
  {
    label: "Administration",
    items: [
      { label: "Administration Home", href: "/administration", icon: SlidersHorizontal, anyOf: ["users.manage", "roles.manage", "offices.manage", "terminals.manage", "fees.manage", "vehicle_config.manage", "requirements.manage", "centers.manage", "settings.manage"] },
      { label: "Vehicle Configuration", href: "/administration/vehicle-config", icon: Car, anyOf: ["vehicle_config.manage"] },
      { label: "Fees & Penalties", href: "/administration/fees", icon: Coins, anyOf: ["fees.manage"] },
      { label: "Requirements", href: "/administration/requirements", icon: ListChecks, anyOf: ["requirements.manage"] },
      { label: "Registration Configuration", href: "/administration/registration-config", icon: SlidersHorizontal, anyOf: ["settings.manage"] },
      { label: "Users", href: "/administration/users", icon: Users, anyOf: ["users.manage"] },
      { label: "Roles & Permissions", href: "/administration/roles", icon: KeyRound, anyOf: ["roles.manage"] },
      { label: "RTA Offices", href: "/administration/offices", icon: Building2, anyOf: ["offices.manage"] },
      { label: "Inspection Centers", href: "/administration/inspection-centers", icon: Warehouse, anyOf: ["centers.manage"] },
      { label: "Payment Locations", href: "/administration/offices/payment-locations", icon: CreditCard, anyOf: ["offices.manage"] },
      { label: "POS Terminals", href: "/administration/terminals", icon: MonitorSmartphone, anyOf: ["terminals.manage"] },
      { label: "Audit Logs", href: "/administration/audit-logs", icon: ScrollText, anyOf: ["audit.view"] },
    ],
  },
  { label: "Settings", items: [{ label: "System Settings", href: "/administration/settings", icon: Settings, anyOf: ["settings.manage"] }] },
];

/** Active when the path matches and (for query links) the query matches too. */
export function isActive(href: string, pathname: string, search: URLSearchParams): boolean {
  const [path, query] = href.split("?");
  if (query) {
    const q = new URLSearchParams(query);
    return pathname === path && [...q.entries()].every(([k, v]) => search.get(k) === v);
  }
  if (path === "/registrations") return pathname === "/registrations" && !search.get("status");
  if (path === "/registrations/new") return pathname === path && search.get("start") !== "existing";
  if (path === "/registry") return (pathname === path && !search.get("status")) || pathname.startsWith("/registry/");
  if (path === "/documents") return pathname === path && !search.get("tab");
  if (path === "/inspections" || path === "/payments" || path === "/plates") return pathname === path && !search.get("tab");
  if (path === "/administration" || path === "/administration/offices") return pathname === path;
  return pathname === path || (pathname.startsWith(path + "/") && !["/registrations", "/payments"].includes(path));
}
