import type { InsuranceStatus, PaymentMethod, TransactionType, VehicleType, VehicleUsage } from "@/types";

export type TargetStage =
  | "draft"
  | "pending"
  | "for_inspection"
  | "inspection_failed"
  | "for_insurance_verification"
  | "for_assessment"
  | "payment_required"
  | "for_approval"
  | "approved"
  | "registered"
  | "returned"
  | "rejected";

export interface ApplicationSpec {
  /** Index into SEED_VEHICLES. */
  vehicle: number;
  type: TransactionType;
  target: TargetStage;
  /** Age of the application; fractional days are hours. */
  daysAgo: number;
  scenario?: string;
  /** Transaction index (1-based) of the registration being renewed / changed. */
  renews?: number;
  method?: PaymentMethod;
  failedAttempts?: ("declined" | "timeout")[];
  insuranceStatus?: InsuranceStatus;
  docsUnverified?: boolean;
  scheduledInspection?: boolean;
  reason?: string;
  /** Transfer: index into SEED_OWNERS of the buyer. */
  newOwner?: number;
  /** Reclassification target. */
  reclassifyTo?: { vehicleUsage: VehicleUsage; vehicleType?: VehicleType; bodyType?: string };
  closureReason?: string;
}

/**
 * Seeded transactions in transaction-number order — a mixed fleet so search, filters,
 * statuses, renewals, transfers, inspections and payments all have data. Records marked
 * "Scenario" are the UAT scenarios listed in the README.
 */
export const APPLICATION_SPECS: ApplicationSpec[] = [
  /* 01 */ { vehicle: 0, type: "new", target: "registered", daysAgo: 395, method: "pos" },
  /* 02 */ { vehicle: 1, type: "new", target: "registered", daysAgo: 300, method: "cash" },
  /* 03 */ { vehicle: 2, type: "new", target: "registered", daysAgo: 200, method: "pos" },
  /* 04 */ { vehicle: 3, type: "new", target: "registered", daysAgo: 150, method: "bank_transfer" },
  /* 05 */ { vehicle: 4, type: "new", target: "registered", daysAgo: 400, method: "pos", scenario: "Scenario H — Expired registration ready for renewal" },
  /* 06 */ { vehicle: 5, type: "new", target: "registered", daysAgo: 120, method: "cash" },
  /* 07 */ { vehicle: 6, type: "new", target: "registered", daysAgo: 90, method: "online" },
  /* 08 */ { vehicle: 7, type: "new", target: "registered", daysAgo: 340, method: "pos" },
  /* 09 */ { vehicle: 8, type: "new", target: "registered", daysAgo: 352, method: "cash" },
  /* 10 */ { vehicle: 9, type: "new", target: "registered", daysAgo: 356, method: "pos" },
  /* 11 */ { vehicle: 10, type: "new", target: "registered", daysAgo: 372, method: "bank_transfer" },
  /* 12 */ { vehicle: 11, type: "new", target: "registered", daysAgo: 210, method: "pos" },
  /* 13 */ { vehicle: 12, type: "new", target: "registered", daysAgo: 160, method: "bank_transfer" },
  /* 14 */ { vehicle: 13, type: "new", target: "registered", daysAgo: 160, method: "bank_transfer" },
  /* 15 */ { vehicle: 14, type: "new", target: "registered", daysAgo: 100, method: "pos", failedAttempts: ["declined"] },
  /* 16 */ { vehicle: 15, type: "new", target: "registered", daysAgo: 60, method: "cash" },
  /* 17 */ { vehicle: 16, type: "new", target: "registered", daysAgo: 45, method: "bank_transfer" },
  /* 18 */ { vehicle: 17, type: "new", target: "registered", daysAgo: 30, method: "bank_transfer" },
  /* 19 */ { vehicle: 18, type: "new", target: "registered", daysAgo: 345, method: "online" },
  /* 20 */ { vehicle: 19, type: "new", target: "registered", daysAgo: 25, method: "cash" },
  /* 21 */ { vehicle: 20, type: "new", target: "registered", daysAgo: 20, method: "bank_transfer" },
  /* 22 */ { vehicle: 21, type: "new", target: "registered", daysAgo: 7, method: "qr" },
  /* 23 */ { vehicle: 22, type: "new", target: "registered", daysAgo: 0.35, method: "pos", failedAttempts: ["timeout"] },
  /* 24 */ { vehicle: 26, type: "new", target: "registered", daysAgo: 330, method: "pos" },
  /* 25 */ { vehicle: 34, type: "new", target: "registered", daysAgo: 2, method: "cash" },
  /* 26 */ { vehicle: 0, type: "renewal", target: "registered", daysAgo: 28, renews: 1, method: "pos" },
  /* 27 */ { vehicle: 32, type: "new", target: "for_inspection", daysAgo: 0.3, scenario: "Scenario A — New registration ready for inspection" },
  /* 28 */ { vehicle: 29, type: "new", target: "inspection_failed", daysAgo: 1, scenario: "Scenario B — Failed inspection requiring reinspection" },
  /* 29 */ { vehicle: 31, type: "new", target: "for_insurance_verification", daysAgo: 1, insuranceStatus: "expired", scenario: "Scenario C — Expired insurance" },
  /* 30 */ { vehicle: 28, type: "new", target: "payment_required", daysAgo: 0.2, scenario: "Scenario D — All requirements complete, ready for payment" },
  /* 31 */ { vehicle: 33, type: "new", target: "payment_required", daysAgo: 0.1, failedAttempts: ["declined"], scenario: "Scenario E — POS payment declined" },
  /* 32 */ { vehicle: 30, type: "new", target: "for_approval", daysAgo: 0.15, method: "pos", scenario: "Scenario F — Paid, awaiting supervisor approval (electric vehicle)" },
  /* 33 */ { vehicle: 23, type: "new", target: "approved", daysAgo: 0.12, method: "cash", scenario: "Scenario G — Approved, waiting for plate assignment" },
  /* 34 */ { vehicle: 8, type: "renewal", target: "returned", daysAgo: 2, renews: 9, method: "pos", scenario: "Scenario I — Returned for correction", reason: "Insurance policy holder name does not match the registered owner. Provide a corrected third-party certificate." },
  /* 35 */ { vehicle: 9, type: "renewal", target: "rejected", daysAgo: 3, renews: 10, method: "cash", scenario: "Scenario J — Rejected application", reason: "Engine number on the vehicle does not match the registry record. Referred to RTA Compliance for investigation." },
  /* 36 */ { vehicle: 14, type: "transfer", target: "for_approval", daysAgo: 0.4, renews: 15, newOwner: 15, method: "bank_transfer", scenario: "Scenario K — Transfer of ownership awaiting approval" },
  /* 37 */ { vehicle: 10, type: "renewal", target: "for_inspection", daysAgo: 0.5, renews: 11, scheduledInspection: true, scenario: "Scenario L — PMV renewal requiring inspection" },
  /* 38 */ { vehicle: 16, type: "replacement_plate", target: "payment_required", daysAgo: 0.25, renews: 17, scenario: "Scenario M — Replacement plate awaiting payment" },
  /* 39 */ { vehicle: 26, type: "deregistration", target: "for_approval", daysAgo: 1, renews: 24, closureReason: "Vehicle written off after accident — insurer total loss.", method: "cash", scenario: "Scenario N — Deregistration awaiting approval" },
  /* 40 */ { vehicle: 18, type: "renewal", target: "for_approval", daysAgo: 0.6, renews: 19, scenario: "Scenario O — Diplomatic renewal, no amount due" },
  /* 41 */ { vehicle: 5, type: "reclassification", target: "for_inspection", daysAgo: 0.45, renews: 6, reclassifyTo: { vehicleUsage: "taxi", vehicleType: "taxi", bodyType: "Wagon (Taxi)" }, scenario: "Scenario P — Reclassification Private → Taxi" },
  /* 42 */ { vehicle: 7, type: "transfer", target: "registered", daysAgo: 0.2, renews: 8, newOwner: 18, method: "pos" },
  /* 43 */ { vehicle: 24, type: "new", target: "draft", daysAgo: 0.4 },
  /* 44 */ { vehicle: 27, type: "new", target: "pending", daysAgo: 0.3, docsUnverified: true },
  /* 45 */ { vehicle: 12, type: "renewal", target: "registered", daysAgo: 0.15, renews: 13, method: "bank_transfer" },
  /* 46 */ { vehicle: 25, type: "new", target: "for_assessment", daysAgo: 0.6 },
  /* 47 */ { vehicle: 19, type: "replacement_certificate", target: "registered", daysAgo: 0.1, renews: 20, method: "cash" },
];
