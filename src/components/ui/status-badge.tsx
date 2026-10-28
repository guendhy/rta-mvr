import {
  INSPECTION_STATUS,
  INSURANCE_STATUS,
  MOTORCYCLE_STATUS,
  PAYMENT_STATUS,
  PLATE_STATUS,
  REGISTRATION_STATUS,
  TERMINAL_ADMIN_STATUS,
  TERMINAL_STATUS,
  type BadgeTone,
} from "@/lib/constants";
import type {
  DocumentStatus,
  InspectionStatus,
  InsuranceStatus,
  MotorcycleRegistrationStatus,
  PaymentStatus,
  PlateStatus,
  RegistrationStatus,
  TerminalAdminStatus,
  TerminalStatus,
} from "@/types";

export function Badge({ tone, children, className = "" }: { tone: BadgeTone; children: React.ReactNode; className?: string }) {
  return <span className={`badge s-${tone} ${className}`}>{children}</span>;
}

const DOC_STATUS: Record<DocumentStatus, { label: string; tone: BadgeTone }> = {
  missing: { label: "Missing", tone: "draft" },
  uploaded: { label: "Uploaded", tone: "pend" },
  verified: { label: "Verified", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
};

type Props =
  | { kind: "registration"; status: RegistrationStatus }
  | { kind: "motorcycle"; status: MotorcycleRegistrationStatus }
  | { kind: "inspection"; status: InspectionStatus }
  | { kind: "insurance"; status: InsuranceStatus }
  | { kind: "payment"; status: PaymentStatus }
  | { kind: "plate"; status: PlateStatus }
  | { kind: "terminal"; status: TerminalStatus }
  | { kind: "terminal-admin"; status: TerminalAdminStatus }
  | { kind: "document"; status: DocumentStatus };

/** Consistent status badges — always colour + dot + text label. */
export function StatusBadge(props: Props & { className?: string }) {
  const map = {
    registration: REGISTRATION_STATUS,
    motorcycle: MOTORCYCLE_STATUS,
    inspection: INSPECTION_STATUS,
    insurance: INSURANCE_STATUS,
    payment: PAYMENT_STATUS,
    plate: PLATE_STATUS,
    terminal: TERMINAL_STATUS,
    "terminal-admin": TERMINAL_ADMIN_STATUS,
    document: DOC_STATUS,
  }[props.kind] as Record<string, { label: string; tone: BadgeTone }>;
  const s = map[props.status] ?? { label: String(props.status), tone: "draft" as BadgeTone };
  return <Badge tone={s.tone} className={props.className}>{s.label}</Badge>;
}
