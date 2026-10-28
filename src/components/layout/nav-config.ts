import {
  BadgeCheck,
  BarChart3,
  Bike,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  CreditCard,
  Database,
  FilePlus2,
  Files,
  FileText,
  KeyRound,
  LayoutDashboard,
  MonitorSmartphone,
  RectangleHorizontal,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldCheck,
  Smartphone,
  Undo2,
  Users,
  Warehouse,
  XCircle,
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

export const NAV: NavGroup[] = [
  { label: "Main", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, anyOf: ["dashboard.view"] }] },
  {
    label: "Registration",
    items: [
      { label: "New Registration", href: "/registrations/new", icon: FilePlus2, anyOf: ["registration.create"] },
      { label: "All Applications", href: "/registrations", icon: Files, anyOf: ["registration.view"] },
      { label: "Pending", href: "/registrations?status=pending", icon: Clock, anyOf: ["registration.view"], countStatuses: ["pending", "draft"] },
      { label: "For Inspection", href: "/registrations?status=for_inspection", icon: ClipboardCheck, anyOf: ["registration.view"], countStatuses: ["for_inspection", "inspection_failed"] },
      { label: "For Payment", href: "/registrations?status=payment_required", icon: CreditCard, anyOf: ["registration.view"], countStatuses: ["payment_required"] },
      { label: "For Approval", href: "/registrations/approval", icon: BadgeCheck, anyOf: ["approval.view"], countStatuses: ["for_approval"] },
      { label: "Completed", href: "/registrations?status=registered", icon: CheckCircle2, anyOf: ["registration.view"] },
      { label: "Returned", href: "/registrations?status=returned", icon: Undo2, anyOf: ["registration.view"], countStatuses: ["returned"] },
      { label: "Rejected", href: "/registrations?status=rejected", icon: XCircle, anyOf: ["registration.view"] },
    ],
  },
  {
    label: "Registry",
    items: [
      { label: "Motorcycle Registry", href: "/registry", icon: Database, anyOf: ["registry.view"] },
      { label: "Renewals", href: "/renewals", icon: RefreshCw, anyOf: ["renewal.view"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Inspection Queue", href: "/inspections", icon: ClipboardCheck, anyOf: ["inspection.view"], countStatuses: ["for_inspection"] },
      { label: "Inspection History", href: "/inspections?tab=history", icon: ScrollText, anyOf: ["inspection.view"] },
      { label: "Insurance", href: "/insurance", icon: ShieldCheck, anyOf: ["insurance.view"], countStatuses: ["for_insurance_verification"] },
      { label: "Payment Queue", href: "/payments", icon: CreditCard, anyOf: ["payment.view"], countStatuses: ["payment_required"] },
      { label: "POS Terminal", href: "/payments/pos", icon: Smartphone, anyOf: ["payment.process"] },
      { label: "Payment History", href: "/payments?tab=history", icon: Coins, anyOf: ["payment.view"] },
      { label: "Plate Inventory", href: "/plates", icon: RectangleHorizontal, anyOf: ["plates.view"] },
      { label: "Plate Assignment", href: "/plates?tab=assign", icon: BadgeCheck, anyOf: ["plates.assign"], countStatuses: ["approved"] },
      { label: "Documents", href: "/documents", icon: FileText, anyOf: ["documents.view"] },
    ],
  },
  { label: "Reports", items: [{ label: "Reports", href: "/reports", icon: BarChart3, anyOf: ["reports.view"] }] },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/administration/users", icon: Users, anyOf: ["users.manage"] },
      { label: "Roles", href: "/administration/roles", icon: KeyRound, anyOf: ["roles.manage"] },
      { label: "Offices", href: "/administration/offices", icon: Building2, anyOf: ["offices.manage"] },
      { label: "POS Terminals", href: "/administration/terminals", icon: MonitorSmartphone, anyOf: ["terminals.manage"] },
      { label: "Fees", href: "/administration/fees", icon: Coins, anyOf: ["fees.manage"] },
      { label: "Inspection Centers", href: "/administration/inspection-centers", icon: Warehouse, anyOf: ["centers.manage"] },
      { label: "Audit Logs", href: "/administration/audit-logs", icon: ScrollText, anyOf: ["audit.view"] },
      { label: "Settings", href: "/administration/settings", icon: Settings, anyOf: ["settings.manage"] },
    ],
  },
];

export const MOTO_ICON = Bike;

/** Active when the path matches and (for query links) the query matches too. */
export function isActive(href: string, pathname: string, search: URLSearchParams): boolean {
  const [path, query] = href.split("?");
  if (query) {
    const q = new URLSearchParams(query);
    return pathname === path && [...q.entries()].every(([k, v]) => search.get(k) === v);
  }
  if (path === "/registrations") return pathname === "/registrations" && !search.get("status");
  if (path === "/inspections" || path === "/payments" || path === "/plates") return pathname === path && !search.get("tab");
  return pathname === path || (pathname.startsWith(path + "/") && !["/registrations", "/payments"].includes(path));
}
