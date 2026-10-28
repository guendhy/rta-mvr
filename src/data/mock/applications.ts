import type { InsuranceStatus, PaymentMethod } from "@/types";

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
  /** Index into SEED_MOTORCYCLES. */
  moto: number;
  type: "new" | "renewal";
  target: TargetStage;
  /** Age of the application; fractional days are hours. */
  daysAgo: number;
  scenario?: string;
  /** Transaction index (1-based) of the registration being renewed. */
  renews?: number;
  method?: PaymentMethod;
  failedAttempts?: ("declined" | "timeout")[];
  insuranceStatus?: InsuranceStatus;
  docsUnverified?: boolean;
  scheduledInspection?: boolean;
  reason?: string;
}

/**
 * The 30 seeded applications, in transaction-number order. Records 21–30 are the
 * UAT scenarios A–J (see README "Test scenarios").
 */
export const APPLICATION_SPECS: ApplicationSpec[] = [
  /* 01 */ { moto: 0, type: "new", target: "registered", daysAgo: 400, method: "pos" },
  /* 02 */ { moto: 1, type: "new", target: "registered", daysAgo: 380, method: "cash" },
  /* 03 */ { moto: 2, type: "new", target: "registered", daysAgo: 200, method: "pos" },
  /* 04 */ { moto: 3, type: "new", target: "registered", daysAgo: 150, method: "bank_transfer" },
  /* 05 */ { moto: 4, type: "new", target: "registered", daysAgo: 390, method: "pos", scenario: "Scenario H — Expired registration ready for renewal" },
  /* 06 */ { moto: 5, type: "new", target: "registered", daysAgo: 120, method: "cash" },
  /* 07 */ { moto: 6, type: "new", target: "registered", daysAgo: 90, method: "online" },
  /* 08 */ { moto: 7, type: "new", target: "registered", daysAgo: 340, method: "pos" },
  /* 09 */ { moto: 8, type: "new", target: "registered", daysAgo: 350, method: "cash" },
  /* 10 */ { moto: 9, type: "new", target: "registered", daysAgo: 355, method: "pos" },
  /* 11 */ { moto: 0, type: "renewal", target: "registered", daysAgo: 35, renews: 1, method: "pos" },
  /* 12 */ { moto: 10, type: "new", target: "registered", daysAgo: 20, method: "pos", failedAttempts: ["declined"] },
  /* 13 */ { moto: 11, type: "new", target: "registered", daysAgo: 7, method: "cash" },
  /* 14 */ { moto: 12, type: "new", target: "registered", daysAgo: 2, method: "cash", failedAttempts: ["declined"] },
  /* 15 */ { moto: 13, type: "new", target: "registered", daysAgo: 0.25, method: "pos", failedAttempts: ["timeout"] },
  /* 16 */ { moto: 1, type: "renewal", target: "payment_required", daysAgo: 1, renews: 2 },
  /* 17 */ { moto: 14, type: "new", target: "for_approval", daysAgo: 1, method: "pos", failedAttempts: ["declined"], docsUnverified: true },
  /* 18 */ { moto: 15, type: "new", target: "for_assessment", daysAgo: 1 },
  /* 19 */ { moto: 16, type: "new", target: "for_insurance_verification", daysAgo: 2, insuranceStatus: "pending" },
  /* 20 */ { moto: 17, type: "new", target: "draft", daysAgo: 0.4 },
  /* 21 */ { moto: 18, type: "new", target: "for_inspection", daysAgo: 0.3, scenario: "Scenario A — New registration ready for inspection" },
  /* 22 */ { moto: 19, type: "new", target: "inspection_failed", daysAgo: 1, scenario: "Scenario B — Failed inspection requiring reinspection" },
  /* 23 */ { moto: 20, type: "new", target: "for_insurance_verification", daysAgo: 1, insuranceStatus: "expired", scenario: "Scenario C — Expired insurance" },
  /* 24 */ { moto: 21, type: "new", target: "payment_required", daysAgo: 0.2, scenario: "Scenario D — All requirements complete, ready for payment" },
  /* 25 */ { moto: 22, type: "new", target: "for_approval", daysAgo: 0.15, method: "pos", scenario: "Scenario F — Paid, awaiting supervisor approval" },
  /* 26 */ { moto: 23, type: "new", target: "payment_required", daysAgo: 0.1, failedAttempts: ["declined"], scenario: "Scenario E — POS payment declined" },
  /* 27 */ { moto: 24, type: "new", target: "approved", daysAgo: 0.12, method: "cash", scenario: "Scenario G — Approved, waiting for plate assignment" },
  /* 28 */ { moto: 7, type: "renewal", target: "for_inspection", daysAgo: 0.5, renews: 8, scheduledInspection: true },
  /* 29 */ { moto: 8, type: "renewal", target: "returned", daysAgo: 2, renews: 9, method: "pos", scenario: "Scenario I — Returned for correction", reason: "Insurance policy holder name does not match the registered owner. Provide a corrected third-party certificate." },
  /* 30 */ { moto: 9, type: "renewal", target: "rejected", daysAgo: 3, renews: 10, method: "cash", scenario: "Scenario J — Rejected application", reason: "Engine number on the motorcycle does not match the registry record. Referred to RTA Compliance for investigation." },
];
