import type { Fee } from "@/types";

const ts = "2025-01-01T00:00:00.000Z";
const id = (n: number) => `c2f4a6b8-0d1e-4f3a-8b5c-${String(n).padStart(12, "0")}`;

/** Fee schedule (PGK). Components read amounts from the fee service — never hard-code them. */
export const SEED_FEES: Fee[] = [
  { id: id(1), code: "REG_NO_SIDECAR", name: "Motorcycle Registration Without Sidecar", amount: 185, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: false, createdAt: ts, updatedAt: ts },
  { id: id(2), code: "REG_SIDECAR", name: "Motorcycle Registration With Sidecar", amount: 345, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: false, createdAt: ts, updatedAt: ts },
  { id: id(3), code: "NUMBER_PLATE", name: "Number Plate", amount: 120, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: false, createdAt: ts, updatedAt: ts },
  { id: id(4), code: "REPLACE_CERT_LABEL", name: "Replacement Certificate / Label", amount: 60, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: true, createdAt: ts, updatedAt: ts },
  { id: id(5), code: "REPLACE_PLATE", name: "Replacement Number Plate", amount: 120, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: true, createdAt: ts, updatedAt: ts },
  { id: id(6), code: "TRANSFER", name: "Transfer Registration", amount: 115, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: true, createdAt: ts, updatedAt: ts },
  { id: id(7), code: "UNREG_PERMIT", name: "Unregistered Vehicle Permit", amount: 115, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: true, createdAt: ts, updatedAt: ts },
  { id: id(8), code: "ADD_SIDECAR", name: "Add Sidecar", amount: 140, currency: "PGK", active: true, effectiveDate: "2025-01-01", optional: true, createdAt: ts, updatedAt: ts },
];
