import type { BaseRecord } from "./common";
import type { TransactionType } from "./registration";
import type { VehicleGroup, VehicleType, VehicleUsage } from "./vehicle";

/** Itemised buckets returned by the fee engine. */
export type FeeComponent = "registration" | "inspection" | "plate" | "transfer" | "penalty" | "service" | "other";

/** Specification value a banded rule reads. */
export type FeeMetric = "engineCapacityCc" | "grossVehicleMassKg" | "seatingCapacity" | "axleCount" | "monthsOverdue";

export interface FeeBand {
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound; omit for "and above". */
  max?: number;
  amount: number;
}

/**
 * One configurable charge. Rules are matched on transaction, vehicle type / group, use and
 * plate need; the most specific active rule per `code` wins. Stored as data so a Supabase
 * `fee_rules` table can replace the seed without code changes.
 */
export interface FeeRule extends BaseRecord {
  code: string;
  name: string;
  component: FeeComponent;
  transactionTypes: TransactionType[];
  vehicleTypes?: VehicleType[];
  vehicleGroups?: VehicleGroup[];
  usages?: VehicleUsage[];
  /** Only when the transaction issues a new plate. */
  requiresNewPlate?: boolean;
  /** Only when an inspection is required for this transaction. */
  requiresInspection?: boolean;
  /** Only when the registration is past expiry. */
  appliesWhenOverdue?: boolean;
  /** Only when every listed specification value matches, e.g. { sidecar: true }. */
  specEquals?: Record<string, string | number | boolean>;
  basis: "flat" | "banded" | "per_unit";
  amount: number;
  metric?: FeeMetric;
  bands?: FeeBand[];
  /** Added by the officer rather than automatically. */
  optional: boolean;
  active: boolean;
  effectiveDate: string;
  currency: "PGK";
  /**
   * true = illustrative amount pending the official PNG RTA fee schedule. The UI labels
   * these "Sample" everywhere they appear.
   */
  sample: boolean;
  notes?: string;
}

export interface AssessmentLine {
  feeCode: string;
  name: string;
  component: FeeComponent;
  amount: number;
  /** How the amount was derived, e.g. "GVM 2,910 kg · band 0–4,500". */
  basis?: string;
  sample?: boolean;
}

export interface FeeTotals {
  registrationFee: number;
  inspectionFee: number;
  plateFee: number;
  transferFee: number;
  penalty: number;
  serviceFee: number;
  otherFees: number;
  total: number;
}

export interface Assessment {
  lines: AssessmentLine[];
  totals: FeeTotals;
  total: number;
  currency: "PGK";
  generatedAt: string;
  generatedBy: string;
  /** Rule set identifier for audit, e.g. "SAMPLE-2026.1". */
  ruleSet: string;
  containsSampleAmounts: boolean;
}

/** @deprecated Phase 1 fee row — kept only to read legacy local data. */
export interface LegacyFee extends BaseRecord {
  code: string;
  name: string;
  amount: number;
  currency: "PGK";
  active: boolean;
  effectiveDate: string;
  optional: boolean;
}
