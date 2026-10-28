import type { Role } from "@/types";

export const SEED_ROLES: Role[] = [
  { key: "super_admin", name: "Super Admin", description: "Full access to every module, configuration and demo tool." },
  { key: "rta_admin", name: "RTA Admin", description: "Runs operations and administration for RTA offices." },
  { key: "registration_officer", name: "Registration Officer", description: "Captures owners, motorcycles and documents; processes renewals." },
  { key: "inspection_officer", name: "Inspection Officer", description: "Performs roadworthiness inspections and records results." },
  { key: "cashier", name: "Cashier", description: "Collects registration payments by POS, cash, online or bank transfer." },
  { key: "supervisor", name: "Supervisor", description: "Approves, returns or rejects registrations and reviews reports." },
  { key: "plate_officer", name: "Plate Officer", description: "Manages number plate inventory and assigns plates." },
  { key: "auditor", name: "Auditor", description: "Read-only access to records, payments, reports and audit logs.", readOnly: true },
];
