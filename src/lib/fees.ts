import { FEE_RULE_SET_ID, REGISTRATION_PERIODS, SEED_FEE_RULES } from "@/config/fee-rules";
import { getVehicleType } from "@/config/vehicle-types";
import { formatSpecValue } from "@/config/vehicle-fields";
import type {
  Assessment,
  AssessmentLine,
  FeeBand,
  FeeComponent,
  FeeRule,
  FeeTotals,
  TransactionType,
  VehicleSpecifications,
  VehicleType,
  VehicleUsage,
} from "@/types";

/**
 * Fee assessment engine. Pure and synchronous: the same inputs always produce the same
 * itemised result, so it runs in the browser (preview), in mock services and — in Phase 2 —
 * in a Supabase Edge Function fed from the `fee_rules` table.
 */
export interface FeeInput {
  transactionType: TransactionType;
  vehicleType: VehicleType;
  vehicleClass?: string;
  vehicleUsage: VehicleUsage;
  specifications?: VehicleSpecifications;
  /** Registration period in months (12 by default). */
  registrationPeriodMonths?: number;
  inspectionRequired?: boolean;
  /** A new plate is issued by this transaction. */
  newPlate?: boolean;
  /** Whole months the registration is past expiry (0 when current). */
  monthsOverdue?: number;
  outstandingBalance?: number;
  /** Optional rule codes the officer added. */
  optionalCodes?: string[];
  rules?: FeeRule[];
}

export interface FeeResult extends FeeTotals {
  lines: AssessmentLine[];
  containsSampleAmounts: boolean;
  ruleSet: string;
}

const SINGLE_LINE: FeeComponent[] = ["registration", "inspection", "plate", "transfer", "penalty", "service"];

function specNumber(specs: VehicleSpecifications | undefined, key: string): number {
  const v = Number(specs?.[key]);
  return Number.isFinite(v) ? v : 0;
}

function pickBand(bands: FeeBand[], value: number): FeeBand | undefined {
  return bands.find((b) => value >= b.min && (b.max === undefined || value <= b.max));
}

function ruleMatches(rule: FeeRule, input: FeeInput): boolean {
  if (!rule.active) return false;
  if (!rule.transactionTypes.includes(input.transactionType)) return false;
  if (rule.vehicleTypes?.length && !rule.vehicleTypes.includes(input.vehicleType)) return false;
  if (rule.vehicleGroups?.length && !rule.vehicleGroups.includes(getVehicleType(input.vehicleType).group)) return false;
  if (rule.usages?.length && !rule.usages.includes(input.vehicleUsage)) return false;
  if (rule.requiresNewPlate && !input.newPlate) return false;
  if (rule.requiresInspection && !input.inspectionRequired) return false;
  if (rule.appliesWhenOverdue && !(input.monthsOverdue && input.monthsOverdue > 0)) return false;
  if (rule.specEquals) {
    for (const [k, v] of Object.entries(rule.specEquals)) {
      const actual = input.specifications?.[k];
      if (typeof v === "boolean" ? Boolean(actual) !== v : actual !== v) return false;
    }
  }
  return true;
}

/** Higher = more specific. Explicit vehicle types beat usages beat groups. */
function specificity(rule: FeeRule): number {
  return (rule.vehicleTypes?.length ? 8 : 0) + (rule.usages?.length ? 4 : 0) + (rule.vehicleGroups?.length ? 2 : 0) + (rule.specEquals ? 1 : 0);
}

function amountFor(rule: FeeRule, input: FeeInput): { amount: number; basis: string } {
  if (rule.basis === "banded" && rule.metric && rule.bands?.length) {
    const value = rule.metric === "monthsOverdue" ? input.monthsOverdue ?? 0 : specNumber(input.specifications, rule.metric);
    const band = pickBand(rule.bands, value);
    const range = band ? `${band.min.toLocaleString("en-US")}${band.max !== undefined ? `–${band.max.toLocaleString("en-US")}` : "+"}` : "no band";
    const shown = rule.metric === "monthsOverdue" ? `${value} month(s) overdue` : formatSpecValue(rule.metric, value);
    return { amount: band?.amount ?? 0, basis: `${shown} · band ${range}` };
  }
  if (rule.basis === "per_unit" && rule.metric) {
    const units = rule.metric === "monthsOverdue" ? input.monthsOverdue ?? 0 : specNumber(input.specifications, rule.metric);
    return { amount: rule.amount * units, basis: `${units} × K${rule.amount}` };
  }
  return { amount: rule.amount, basis: "Flat rate" };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateVehicleFees(input: FeeInput): FeeResult {
  const rules = (input.rules ?? SEED_FEE_RULES).filter((r) => ruleMatches(r, input));
  const lines: AssessmentLine[] = [];

  for (const component of SINGLE_LINE) {
    const best = rules
      .filter((r) => r.component === component && !r.optional)
      .sort((a, b) => specificity(b) - specificity(a))[0];
    if (!best) continue;
    let { amount, basis } = amountFor(best, input);
    if (component === "registration") {
      const months = input.registrationPeriodMonths ?? 12;
      const period = REGISTRATION_PERIODS.find((p) => p.months === months) ?? REGISTRATION_PERIODS[0];
      if (period.factor !== 1) {
        amount = round2(amount * period.factor);
        basis = `${basis} · ${period.label}`;
      } else basis = `${basis} · ${period.label}`;
    }
    lines.push({ feeCode: best.code, name: best.name, component, amount, basis, sample: best.sample });
  }

  for (const r of rules.filter((r) => r.component === "other" && (!r.optional || input.optionalCodes?.includes(r.code)))) {
    const { amount, basis } = amountFor(r, input);
    lines.push({ feeCode: r.code, name: r.name, component: "other", amount, basis, sample: r.sample });
  }

  if (input.outstandingBalance && input.outstandingBalance > 0) {
    lines.push({ feeCode: "OUTSTANDING", name: "Outstanding Balance", component: "other", amount: round2(input.outstandingBalance), basis: "Carried from previous transactions" });
  }

  const sum = (c: FeeComponent) => round2(lines.filter((l) => l.component === c).reduce((s, l) => s + l.amount, 0));
  const totals: FeeTotals = {
    registrationFee: sum("registration"),
    inspectionFee: sum("inspection"),
    plateFee: sum("plate"),
    transferFee: sum("transfer"),
    penalty: sum("penalty"),
    serviceFee: sum("service"),
    otherFees: sum("other"),
    total: round2(lines.reduce((s, l) => s + l.amount, 0)),
  };
  return { ...totals, lines, containsSampleAmounts: lines.some((l) => l.sample), ruleSet: FEE_RULE_SET_ID };
}

/** Wraps an engine result as a persisted assessment. */
export function toAssessment(result: FeeResult, by: string, at: string): Assessment {
  const { lines, containsSampleAmounts, ruleSet, ...totals } = result;
  return { lines, totals, total: totals.total, currency: "PGK", generatedAt: at, generatedBy: by, ruleSet, containsSampleAmounts };
}

/** Whole months past expiry (0 when not expired). */
export function monthsOverdue(expiry: string | undefined, now = new Date()): number {
  if (!expiry) return 0;
  const ms = now.getTime() - new Date(expiry).getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / (30 * 86_400_000)));
}

/** Optional rules that can be added for this transaction / vehicle. */
export function optionalFeeRules(input: Omit<FeeInput, "optionalCodes">): FeeRule[] {
  return (input.rules ?? SEED_FEE_RULES).filter((r) => r.optional && ruleMatches({ ...r, optional: false }, input));
}
