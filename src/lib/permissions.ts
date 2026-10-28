import type { Permission, RoleKey, RolePermissionMatrix } from "@/types";

export const ALL_PERMISSIONS: { key: Permission; label: string; group: string }[] = [
  { key: "dashboard.view", label: "View Dashboard", group: "General" },
  { key: "registration.view", label: "View Registrations", group: "Registration" },
  { key: "registration.create", label: "Create Registration", group: "Registration" },
  { key: "registration.edit", label: "Edit Registration", group: "Registration" },
  { key: "documents.view", label: "View Documents", group: "Registration" },
  { key: "documents.verify", label: "Verify Documents", group: "Registration" },
  { key: "registry.view", label: "View Motorcycle Registry", group: "Registry" },
  { key: "renewal.view", label: "View Renewals", group: "Registry" },
  { key: "renewal.create", label: "Process Renewal", group: "Registry" },
  { key: "inspection.view", label: "View Inspections", group: "Operations" },
  { key: "inspection.submit", label: "Submit Inspection", group: "Operations" },
  { key: "insurance.view", label: "View Insurance", group: "Operations" },
  { key: "insurance.verify", label: "Verify Insurance", group: "Operations" },
  { key: "assessment.generate", label: "Generate Assessment", group: "Operations" },
  { key: "payment.view", label: "View Payments", group: "Payments" },
  { key: "payment.process", label: "Process Payment", group: "Payments" },
  { key: "approval.view", label: "View Approval Queue", group: "Approval" },
  { key: "approval.decide", label: "Approve Registration", group: "Approval" },
  { key: "plates.view", label: "View Plate Inventory", group: "Plates" },
  { key: "plates.assign", label: "Assign Plate", group: "Plates" },
  { key: "plates.manage", label: "Manage Plate Inventory", group: "Plates" },
  { key: "reports.view", label: "View Reports", group: "Reports" },
  { key: "users.manage", label: "Manage Users", group: "Administration" },
  { key: "roles.manage", label: "Manage Roles & Permissions", group: "Administration" },
  { key: "offices.manage", label: "Manage Offices", group: "Administration" },
  { key: "terminals.manage", label: "Manage POS Terminals", group: "Administration" },
  { key: "fees.manage", label: "Manage Fees", group: "Administration" },
  { key: "centers.manage", label: "Manage Inspection Centers", group: "Administration" },
  { key: "settings.manage", label: "Manage Settings", group: "Administration" },
  { key: "audit.view", label: "View Audit Logs", group: "Administration" },
];

const every = ALL_PERMISSIONS.map((p) => p.key);

export const DEFAULT_PERMISSIONS: RolePermissionMatrix = {
  super_admin: every,
  rta_admin: every.filter((p) => p !== "roles.manage"),
  registration_officer: [
    "dashboard.view", "registration.view", "registration.create", "registration.edit",
    "documents.view", "documents.verify", "registry.view", "renewal.view", "renewal.create", "assessment.generate",
  ],
  inspection_officer: ["dashboard.view", "inspection.view", "inspection.submit"],
  cashier: ["dashboard.view", "payment.view", "payment.process"],
  supervisor: ["dashboard.view", "approval.view", "approval.decide", "registration.view", "registry.view", "documents.verify", "reports.view"],
  plate_officer: ["dashboard.view", "plates.view", "plates.assign", "plates.manage"],
  auditor: ["registration.view", "registry.view", "payment.view", "reports.view", "audit.view"],
};

export function hasPermission(matrix: RolePermissionMatrix, role: RoleKey, permission: Permission): boolean {
  if (role === "super_admin") return true;
  return (matrix[role] ?? []).includes(permission);
}

/** Route prefix → any-of permissions. Longest prefix wins. Checked by the dashboard layout. */
const ROUTE_RULES: { prefix: string; anyOf: Permission[] }[] = [
  { prefix: "/dashboard", anyOf: ["dashboard.view"] },
  { prefix: "/registrations/new", anyOf: ["registration.create", "registration.edit", "inspection.submit", "insurance.verify", "payment.process", "approval.decide"] },
  { prefix: "/registrations/approval", anyOf: ["approval.view"] },
  { prefix: "/registrations", anyOf: ["registration.view", "approval.view"] },
  { prefix: "/renewals", anyOf: ["renewal.view"] },
  { prefix: "/registry", anyOf: ["registry.view"] },
  { prefix: "/inspections", anyOf: ["inspection.view"] },
  { prefix: "/insurance", anyOf: ["insurance.view"] },
  { prefix: "/payments", anyOf: ["payment.view"] },
  { prefix: "/plates", anyOf: ["plates.view"] },
  { prefix: "/documents", anyOf: ["documents.view"] },
  { prefix: "/reports", anyOf: ["reports.view"] },
  { prefix: "/administration/users", anyOf: ["users.manage"] },
  { prefix: "/administration/roles", anyOf: ["roles.manage"] },
  { prefix: "/administration/offices", anyOf: ["offices.manage"] },
  { prefix: "/administration/terminals", anyOf: ["terminals.manage"] },
  { prefix: "/administration/fees", anyOf: ["fees.manage"] },
  { prefix: "/administration/inspection-centers", anyOf: ["centers.manage"] },
  { prefix: "/administration/audit-logs", anyOf: ["audit.view"] },
  { prefix: "/administration/settings", anyOf: ["settings.manage"] },
];

export function canAccessRoute(matrix: RolePermissionMatrix, role: RoleKey, pathname: string): boolean {
  if (pathname.startsWith("/dev")) return true;
  const rule = ROUTE_RULES.filter((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!rule) return true;
  return rule.anyOf.some((p) => hasPermission(matrix, role, p));
}

/** Where a role lands after sign-in or when it hits a page it cannot open. */
export function homeRouteFor(matrix: RolePermissionMatrix, role: RoleKey): string {
  const candidates: [Permission, string][] = [
    ["dashboard.view", "/dashboard"],
    ["reports.view", "/reports"],
    ["registration.view", "/registrations"],
    ["payment.view", "/payments"],
    ["audit.view", "/administration/audit-logs"],
  ];
  return candidates.find(([p]) => hasPermission(matrix, role, p))?.[1] ?? "/dashboard";
}
