import type {
  DocumentStatus,
  InspectionStatus,
  InsuranceStatus,
  PaymentStatus,
  PlateStatus,
  RegistrationStatus,
  TerminalAdminStatus,
  TerminalStatus,
  Vehicle,
  VehicleStatus,
} from "@/types";

/**
 * Single source of truth for status labels and badge colours. Components call
 * `getStatusLabel` / `getStatusVariant` (or `<StatusBadge>`) — never their own maps.
 */
export type BadgeTone = "draft" | "pend" | "insp" | "assess" | "payq" | "ok" | "bad" | "susp" | "soon" | "can" | "appr";

export interface StatusDef {
  label: string;
  tone: BadgeTone;
}

/** Application workflow statuses, labelled with the lifecycle names RTA staff use. */
export const REGISTRATION_STATUS: Record<RegistrationStatus, StatusDef> = {
  draft: { label: "Draft", tone: "draft" },
  pending: { label: "Pending Verification", tone: "pend" },
  for_inspection: { label: "Pending Inspection", tone: "insp" },
  inspection_failed: { label: "Requires Reinspection", tone: "bad" },
  for_insurance_verification: { label: "Pending Insurance", tone: "insp" },
  for_assessment: { label: "Pending Assessment", tone: "assess" },
  payment_required: { label: "Pending Payment", tone: "payq" },
  paid: { label: "Paid", tone: "ok" },
  for_approval: { label: "Pending Approval", tone: "appr" },
  approved: { label: "Approved · Awaiting Plate", tone: "ok" },
  registered: { label: "Completed", tone: "ok" },
  returned: { label: "Returned for Correction", tone: "payq" },
  rejected: { label: "Rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "can" },
};

/** Registry statuses, including the derived "expiring_soon". */
export type VehicleRegistrationState = VehicleStatus | "expiring_soon";

export const VEHICLE_STATUS: Record<VehicleRegistrationState, StatusDef> = {
  unregistered: { label: "Pending", tone: "draft" },
  active: { label: "Active", tone: "ok" },
  expiring_soon: { label: "Expiring Soon", tone: "soon" },
  expired: { label: "Expired", tone: "bad" },
  suspended: { label: "Suspended", tone: "susp" },
  cancelled: { label: "Cancelled", tone: "can" },
  deregistered: { label: "Deregistered", tone: "can" },
};

export const VEHICLE_STATE_OPTIONS = (Object.keys(VEHICLE_STATUS) as VehicleRegistrationState[]).map((k) => ({ value: k, label: VEHICLE_STATUS[k].label }));

export const DEFAULT_EXPIRING_SOON_DAYS = 30;

/** Registry state of a vehicle right now — "active" becomes "expiring_soon" inside the window. */
export function vehicleRegistrationState(v: Pick<Vehicle, "registrationStatus" | "registrationExpiry">, now = Date.now(), soonDays = DEFAULT_EXPIRING_SOON_DAYS): VehicleRegistrationState {
  if (v.registrationStatus === "active" && v.registrationExpiry) {
    const ms = new Date(v.registrationExpiry).getTime() - now;
    if (ms < 0) return "expired";
    if (ms <= soonDays * 86_400_000) return "expiring_soon";
  }
  return v.registrationStatus;
}

export const INSPECTION_STATUS: Record<InspectionStatus, StatusDef> = {
  not_inspected: { label: "Not Inspected", tone: "draft" },
  scheduled: { label: "Scheduled", tone: "pend" },
  in_progress: { label: "In Progress", tone: "insp" },
  passed: { label: "Passed", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  conditional: { label: "Conditional Approval", tone: "soon" },
  reinspection_required: { label: "Requires Reinspection", tone: "payq" },
};

export const INSURANCE_STATUS: Record<InsuranceStatus, StatusDef> = {
  pending: { label: "Pending", tone: "pend" },
  verified: { label: "Verified", tone: "ok" },
  expired: { label: "Expired", tone: "bad" },
  invalid: { label: "Invalid", tone: "bad" },
  rejected: { label: "Rejected", tone: "bad" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusDef> = {
  processing: { label: "Processing", tone: "insp" },
  successful: { label: "Successful", tone: "ok" },
  declined: { label: "Declined", tone: "bad" },
  timeout: { label: "Timeout", tone: "payq" },
  unknown: { label: "Status Unknown", tone: "payq" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "can" },
};

/** Summary payment state of an application (for tables). */
export type ApplicationPaymentState = "not_due" | "unpaid" | "paid" | "failed";
export const APPLICATION_PAYMENT_STATUS: Record<ApplicationPaymentState, StatusDef> = {
  not_due: { label: "Not Due", tone: "draft" },
  unpaid: { label: "Unpaid", tone: "payq" },
  paid: { label: "Paid", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
};

export const PLATE_STATUS: Record<PlateStatus, StatusDef> = {
  available: { label: "Available", tone: "ok" },
  reserved: { label: "Reserved", tone: "pend" },
  assigned: { label: "Assigned", tone: "insp" },
  released: { label: "Released", tone: "draft" },
  damaged: { label: "Damaged", tone: "payq" },
  lost: { label: "Lost", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "can" },
};

export const TERMINAL_STATUS: Record<TerminalStatus, StatusDef> = {
  connected: { label: "Connected", tone: "ok" },
  connecting: { label: "Detecting", tone: "insp" },
  disconnected: { label: "Disconnected", tone: "draft" },
  offline: { label: "Not Detected", tone: "bad" },
  error: { label: "Device Error", tone: "bad" },
  unsupported: { label: "Unsupported", tone: "draft" },
  printer_error: { label: "Printer Error", tone: "payq" },
};

export const TERMINAL_ADMIN_STATUS: Record<TerminalAdminStatus, StatusDef> = {
  online: { label: "Online", tone: "ok" },
  idle: { label: "Idle", tone: "pend" },
  offline: { label: "Offline", tone: "bad" },
  maintenance: { label: "Maintenance", tone: "payq" },
  disabled: { label: "Disabled", tone: "draft" },
};

export const DOCUMENT_STATUS: Record<DocumentStatus | "required" | "optional", StatusDef> = {
  required: { label: "Required", tone: "pend" },
  optional: { label: "Optional", tone: "draft" },
  missing: { label: "Missing", tone: "draft" },
  uploaded: { label: "Uploaded", tone: "insp" },
  verified: { label: "Verified", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
};

export const STATUS_MAPS = {
  registration: REGISTRATION_STATUS,
  vehicle: VEHICLE_STATUS,
  inspection: INSPECTION_STATUS,
  insurance: INSURANCE_STATUS,
  payment: PAYMENT_STATUS,
  "application-payment": APPLICATION_PAYMENT_STATUS,
  plate: PLATE_STATUS,
  terminal: TERMINAL_STATUS,
  "terminal-admin": TERMINAL_ADMIN_STATUS,
  document: DOCUMENT_STATUS,
} as const;

export type StatusKind = keyof typeof STATUS_MAPS;

function lookup(kind: StatusKind, status: string): StatusDef {
  return (STATUS_MAPS[kind] as Record<string, StatusDef>)[status] ?? { label: status.replace(/_/g, " "), tone: "draft" };
}

export function getStatusLabel(kind: StatusKind, status: string): string {
  return lookup(kind, status).label;
}

export function getStatusVariant(kind: StatusKind, status: string): BadgeTone {
  return lookup(kind, status).tone;
}
