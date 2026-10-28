import type { FeeComponent, FeeRule, TransactionType } from "@/types";

/**
 * Seed fee rules (PGK).
 *
 * IMPORTANT — the official PNG RTA fee schedule is not connected yet. Rules marked
 * `sample: true` carry ILLUSTRATIVE amounts so the fee engine, receipts and reports can be
 * exercised end to end; the UI labels them "Sample". Rules with `sample: false` keep the
 * amounts that were already configured in the Phase 1 motorcycle prototype. Replace the
 * whole list from the `fee_rules` table (Administration → Fees & Penalties) in Phase 2.
 */
export const FEE_RULE_SET_ID = "SAMPLE-2026.1";

export const FEE_COMPONENTS: { key: FeeComponent; label: string }[] = [
  { key: "registration", label: "Registration Fee" },
  { key: "inspection", label: "Inspection Fee" },
  { key: "plate", label: "Plate Fee" },
  { key: "transfer", label: "Transfer Fee" },
  { key: "penalty", label: "Penalty" },
  { key: "service", label: "Processing / Service Fee" },
  { key: "other", label: "Other RTA Charges" },
];

export function feeComponentLabel(key: FeeComponent): string {
  return FEE_COMPONENTS.find((c) => c.key === key)?.label ?? key;
}

/** Registration periods offered at assessment. Factor applies to the registration fee (sample). */
export const REGISTRATION_PERIODS: { months: number; label: string; factor: number }[] = [
  { months: 12, label: "12 months", factor: 1 },
  { months: 6, label: "6 months", factor: 0.55 },
];

const REG_TXN: TransactionType[] = ["new", "renewal", "reinstatement"];
const ALL_TXN: TransactionType[] = ["new", "renewal", "transfer", "change_vehicle", "change_owner", "replacement_certificate", "replacement_plate", "duplicate_certificate", "reclassification", "deregistration", "reinstatement", "registration_transfer", "other"];
const CERT_UPDATE_TXN: TransactionType[] = ["transfer", "change_vehicle", "change_owner", "reclassification", "registration_transfer"];

const ts = "2025-01-01T00:00:00.000Z";
let n = 0;
type RuleSeed = Omit<FeeRule, "id" | "createdAt" | "updatedAt" | "currency" | "active" | "effectiveDate" | "optional" | "sample"> & Partial<Pick<FeeRule, "optional" | "sample" | "effectiveDate">>;
const rule = (r: RuleSeed): FeeRule => ({
  id: `c2f4a6b8-0d1e-4f3a-8b5c-${String(++n).padStart(12, "0")}`,
  currency: "PGK",
  active: true,
  effectiveDate: "2026-01-01",
  optional: false,
  sample: true,
  createdAt: ts,
  updatedAt: ts,
  ...r,
});

export const SEED_FEE_RULES: FeeRule[] = [
  // ── Registration (one line; the most specific matching rule wins) ──
  rule({ code: "REG_NO_SIDECAR", name: "Motorcycle Registration Without Sidecar", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["two_wheeler"], specEquals: { sidecar: false }, basis: "flat", amount: 185, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),
  rule({ code: "REG_SIDECAR", name: "Motorcycle Registration With Sidecar", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["two_wheeler"], specEquals: { sidecar: true }, basis: "flat", amount: 345, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),
  rule({ code: "REG-LV", name: "Light Vehicle Registration", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["passenger"], basis: "banded", metric: "grossVehicleMassKg", amount: 0, bands: [{ min: 0, max: 2500, amount: 300 }, { min: 2501, max: 4500, amount: 420 }, { min: 4501, amount: 520 }] }),
  rule({ code: "REG-LV-COM", name: "Light Vehicle Registration — Commercial Use", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["passenger"], usages: ["commercial", "rental", "corporate"], basis: "banded", metric: "grossVehicleMassKg", amount: 0, bands: [{ min: 0, max: 2500, amount: 380 }, { min: 2501, max: 4500, amount: 520 }, { min: 4501, amount: 640 }] }),
  rule({ code: "REG-PT", name: "Public Passenger Vehicle Registration", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["passenger_transport"], basis: "banded", metric: "seatingCapacity", amount: 0, bands: [{ min: 1, max: 15, amount: 640 }, { min: 16, max: 30, amount: 960 }, { min: 31, amount: 1280 }] }),
  rule({ code: "REG-PT-PMV", name: "PMV Registration (any type used as PMV)", component: "registration", transactionTypes: REG_TXN, usages: ["pmv", "public_transport"], basis: "banded", metric: "seatingCapacity", amount: 0, bands: [{ min: 1, max: 15, amount: 640 }, { min: 16, max: 30, amount: 960 }, { min: 31, amount: 1280 }] }),
  rule({ code: "REG-HV", name: "Commercial / Heavy Vehicle Registration", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["commercial"], basis: "banded", metric: "grossVehicleMassKg", amount: 0, bands: [{ min: 0, max: 4500, amount: 520 }, { min: 4501, max: 12000, amount: 1100 }, { min: 12001, amount: 2400 }] }),
  rule({ code: "REG-TR", name: "Trailer Registration", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["towed"], basis: "banded", metric: "grossVehicleMassKg", amount: 0, bands: [{ min: 0, max: 3500, amount: 150 }, { min: 3501, amount: 600 }] }),
  rule({ code: "REG-SP", name: "Special Purpose / Plant Registration", component: "registration", transactionTypes: REG_TXN, vehicleGroups: ["special"], basis: "flat", amount: 450 }),
  rule({ code: "REG-DIP", name: "Diplomatic Registration", component: "registration", transactionTypes: REG_TXN, usages: ["diplomatic"], basis: "flat", amount: 0, notes: "Design reference shows K0.00 — confirm with RTA policy" }),

  // ── Inspection ──
  rule({ code: "INS-MC", name: "Motorcycle Inspection", component: "inspection", transactionTypes: ALL_TXN, vehicleGroups: ["two_wheeler"], requiresInspection: true, basis: "flat", amount: 30 }),
  rule({ code: "INS-LV", name: "Light Vehicle Inspection", component: "inspection", transactionTypes: ALL_TXN, vehicleGroups: ["passenger"], requiresInspection: true, basis: "flat", amount: 50 }),
  rule({ code: "INS-PT", name: "Public Passenger Vehicle Inspection", component: "inspection", transactionTypes: ALL_TXN, vehicleGroups: ["passenger_transport"], requiresInspection: true, basis: "flat", amount: 80 }),
  rule({ code: "INS-HV", name: "Heavy Vehicle / Trailer Inspection", component: "inspection", transactionTypes: ALL_TXN, vehicleGroups: ["commercial", "towed"], requiresInspection: true, basis: "flat", amount: 120 }),
  rule({ code: "INS-SP", name: "Special Vehicle Inspection", component: "inspection", transactionTypes: ALL_TXN, vehicleGroups: ["special"], requiresInspection: true, basis: "flat", amount: 80 }),

  // ── Plates ──
  rule({ code: "NUMBER_PLATE", name: "Number Plate (Motorcycle)", component: "plate", transactionTypes: ["new", "reclassification"], vehicleGroups: ["two_wheeler"], requiresNewPlate: true, basis: "flat", amount: 120, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),
  rule({ code: "PLT-STD", name: "Number Plate Pair", component: "plate", transactionTypes: ["new", "reclassification"], requiresNewPlate: true, basis: "flat", amount: 95 }),
  rule({ code: "REPLACE_PLATE", name: "Replacement Number Plate", component: "plate", transactionTypes: ["replacement_plate"], basis: "flat", amount: 120, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),

  // ── Transfer ──
  rule({ code: "TRANSFER", name: "Transfer of Ownership", component: "transfer", transactionTypes: ["transfer"], basis: "flat", amount: 115, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),
  rule({ code: "XFR-HV", name: "Transfer of Ownership — Heavy Vehicle", component: "transfer", transactionTypes: ["transfer"], vehicleGroups: ["commercial", "towed"], basis: "flat", amount: 180 }),

  // ── Penalties ──
  rule({ code: "PEN-LATE", name: "Late Renewal Penalty", component: "penalty", transactionTypes: ["renewal", "reinstatement"], appliesWhenOverdue: true, basis: "banded", metric: "monthsOverdue", amount: 0, bands: [{ min: 1, max: 1, amount: 40 }, { min: 2, max: 2, amount: 85 }, { min: 3, amount: 150 }] }),

  // ── Processing / service ──
  rule({ code: "SVC-01", name: "Processing / Service Fee", component: "service", transactionTypes: ALL_TXN, basis: "flat", amount: 15 }),
  rule({ code: "SVC-DIP", name: "Processing / Service Fee — Diplomatic", component: "service", transactionTypes: ALL_TXN, usages: ["diplomatic"], basis: "flat", amount: 0, notes: "Design reference shows K0.00 — confirm with RTA policy" }),

  // ── Other charges ──
  rule({ code: "REPLACE_CERT_LABEL", name: "Replacement Certificate / Label", component: "other", transactionTypes: ["replacement_certificate", "duplicate_certificate"], basis: "flat", amount: 60, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),
  rule({ code: "CERT-UPD", name: "Updated Certificate Issue", component: "other", transactionTypes: CERT_UPDATE_TXN, basis: "flat", amount: 25 }),
  rule({ code: "RECLASS", name: "Reclassification Administration", component: "other", transactionTypes: ["reclassification"], basis: "flat", amount: 120 }),
  rule({ code: "DEREG", name: "Deregistration Administration", component: "other", transactionTypes: ["deregistration"], basis: "flat", amount: 25 }),
  rule({ code: "UNREG_PERMIT", name: "Unregistered Vehicle Permit", component: "other", transactionTypes: ALL_TXN, basis: "flat", amount: 115, optional: true, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),
  rule({ code: "ADD_SIDECAR", name: "Add Sidecar", component: "other", transactionTypes: ["change_vehicle", "new", "renewal"], vehicleGroups: ["two_wheeler"], basis: "flat", amount: 140, optional: true, sample: false, effectiveDate: "2025-01-01", notes: "Phase 1 configured amount" }),
];
