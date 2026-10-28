import type { Role } from "@/types";

export const SEED_ROLES: Role[] = [
  { key: "super_admin", name: "Super Administrator", description: "Full access to every module, configuration and demo tool." },
  { key: "rta_admin", name: "RTA Administrator", description: "Runs operations and administration, including vehicle, fee and requirement configuration." },
  { key: "registration_officer", name: "Registration Officer", description: "Creates and updates motor vehicle applications, renewals and transfers." },
  { key: "verification_officer", name: "Verification Officer", description: "Verifies supporting documents, identity and insurance." },
  { key: "inspection_officer", name: "Vehicle Inspector", description: "Performs vehicle inspections and records results, defects and conditions." },
  { key: "cashier", name: "Cashier / Payment Officer", description: "Processes payments by POS terminal, card, QR, cash or electronic payment." },
  { key: "supervisor", name: "Supervisor / Approver", description: "Approves, returns or rejects transactions and reviews reports." },
  { key: "plate_officer", name: "Plate Officer", description: "Manages plate inventory by series and assigns plates." },
  { key: "auditor", name: "Reporting / Audit User", description: "Read-only access to records, payments, reports and audit logs.", readOnly: true },
];
