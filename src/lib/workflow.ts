import { LAST_CAPTURE_STEP } from "./constants";
import type {
  AppSettings,
  Inspection,
  InsuranceRecord,
  Payment,
  RegistrationApplication,
  RegistrationStatus,
} from "@/types";

/**
 * Centralised registration state machine. Every status change in the mock backend goes
 * through `assertTransition`, so pages cannot push an application into an invalid state.
 */
export const TRANSITIONS: Record<RegistrationStatus, RegistrationStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["for_inspection", "for_insurance_verification", "for_assessment", "for_approval", "cancelled"],
  for_inspection: ["inspection_failed", "for_insurance_verification", "for_assessment", "cancelled"],
  inspection_failed: ["for_inspection", "cancelled"],
  for_insurance_verification: ["for_assessment", "cancelled"],
  for_assessment: ["payment_required", "cancelled"],
  payment_required: ["paid", "for_assessment", "cancelled"],
  paid: ["for_approval"],
  for_approval: ["approved", "registered", "returned", "rejected"],
  approved: ["registered"],
  registered: [],
  returned: ["pending", "cancelled"],
  rejected: [],
  cancelled: [],
};

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowError";
  }
}

export function canTransition(from: RegistrationStatus, to: RegistrationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: RegistrationStatus, to: RegistrationStatus) {
  if (!canTransition(from, to)) {
    throw new WorkflowError(`An application cannot move from "${from.replace(/_/g, " ")}" to "${to.replace(/_/g, " ")}".`);
  }
}

/** Ordered pipeline used for progress display and step unlocking. */
const STAGE_ORDER: RegistrationStatus[] = [
  "draft",
  "pending",
  "for_inspection",
  "for_insurance_verification",
  "for_assessment",
  "payment_required",
  "paid",
  "for_approval",
  "approved",
  "registered",
];

export function stageIndex(status: RegistrationStatus): number {
  if (status === "inspection_failed") return STAGE_ORDER.indexOf("for_inspection");
  if (status === "returned") return STAGE_ORDER.indexOf("pending");
  const i = STAGE_ORDER.indexOf(status);
  return i === -1 ? 0 : i;
}

export function isEditable(app: RegistrationApplication): boolean {
  return ["draft", "pending", "returned"].includes(app.status);
}

export function isClosed(status: RegistrationStatus): boolean {
  return ["registered", "rejected", "cancelled"].includes(status);
}

/** Wizard step (1–10) that matches where the application currently sits. */
export function stepForStatus(app: RegistrationApplication): number {
  switch (app.status) {
    case "draft":
    case "pending":
    case "returned":
      return Math.min(Math.max(app.currentStep || 2, 2), LAST_CAPTURE_STEP);
    case "for_inspection":
    case "inspection_failed":
    case "for_insurance_verification":
      return 6;
    case "for_assessment":
      return 7;
    case "payment_required":
      return 8;
    default:
      return 10;
  }
}

/** Highest wizard step the officer may open for this application. */
export function maxReachableStep(app: RegistrationApplication): number {
  if (isEditable(app)) return LAST_CAPTURE_STEP;
  if (app.status === "payment_required") return 9;
  return Math.max(stepForStatus(app), LAST_CAPTURE_STEP);
}

/** Inspection passed (a conditional approval also allows registration). */
export function inspectionSatisfied(app: Pick<RegistrationApplication, "inspectionRequired">, inspection: Inspection | null | undefined, settings: AppSettings): boolean {
  if (!settings.registration.requireInspection || !app.inspectionRequired) return true;
  return inspection?.result === "pass" || inspection?.result === "conditional";
}

export function insuranceSatisfied(app: Pick<RegistrationApplication, "insuranceRequired">, insurance: InsuranceRecord | null | undefined, settings: AppSettings): boolean {
  if (!settings.registration.requireInsuranceVerification || !app.insuranceRequired) return true;
  return insurance?.status === "verified";
}

/** Where an application goes after it is (re)submitted from pending. */
export function nextAfterSubmission(
  app: RegistrationApplication,
  ctx: { inspection?: Inspection | null; insurance?: InsuranceRecord | null; payment?: Payment | null; settings: AppSettings },
): RegistrationStatus {
  const inspectionOk = inspectionSatisfied(app, ctx.inspection, ctx.settings);
  const insuranceOk = insuranceSatisfied(app, ctx.insurance, ctx.settings);
  if (inspectionOk && insuranceOk && ctx.payment?.status === "successful" && ctx.payment.applicationId === app.id) return "for_approval";
  if (inspectionOk && insuranceOk) return "for_assessment";
  if (inspectionOk) return "for_insurance_verification";
  return "for_inspection";
}

export interface ChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export function documentsChecklist(app: Pick<RegistrationApplication, "documents">) {
  const required = app.documents.filter((d) => d.required).map((d) => d.type);
  const docs = app.documents.filter((d) => d.required);
  const present = required.every((t) => docs.some((d) => d.type === t && (d.status === "uploaded" || d.status === "verified")));
  const verified = required.every((t) => docs.some((d) => d.type === t && d.status === "verified"));
  const missing = required.filter((t) => !docs.some((d) => d.type === t && (d.status === "uploaded" || d.status === "verified")));
  return { required, present, verified, missing };
}

/** Pre-payment checklist (spec §25). */
export function assessmentChecklist(
  app: RegistrationApplication,
  ctx: { ownerComplete: boolean; vehicleComplete: boolean; inspection?: Inspection | null; insurance?: InsuranceRecord | null; settings: AppSettings },
): ChecklistItem[] {
  const docs = documentsChecklist(app);
  const inspOk = inspectionSatisfied(app, ctx.inspection, ctx.settings);
  const insOk = insuranceSatisfied(app, ctx.insurance, ctx.settings);
  const inspNotNeeded = !ctx.settings.registration.requireInspection || !app.inspectionRequired;
  const insNotNeeded = !ctx.settings.registration.requireInsuranceVerification || !app.insuranceRequired;
  return [
    { key: "owner", label: "Registered owner complete", ok: ctx.ownerComplete, detail: ctx.ownerComplete ? "Owner record linked" : "Owner details incomplete" },
    { key: "vehicle", label: "Vehicle details complete", ok: ctx.vehicleComplete, detail: ctx.vehicleComplete ? "Vehicle record linked" : "Vehicle details incomplete" },
    { key: "documents", label: "Required documents present", ok: docs.present, detail: docs.present ? "All required documents uploaded" : `${docs.missing.length} required document(s) missing` },
    {
      key: "inspection",
      label: "Inspection passed",
      ok: inspOk,
      detail: inspNotNeeded ? "Not required for this transaction" : inspOk ? `Certificate ${ctx.inspection?.certificateNumber ?? ctx.inspection?.reference ?? ""}` : "Vehicle inspection not passed",
    },
    {
      key: "insurance",
      label: "Insurance verified",
      ok: insOk,
      detail: insNotNeeded ? "Not required for this transaction" : insOk ? `Policy ${ctx.insurance?.policyNumber}` : `Insurance ${ctx.insurance?.status ?? "not captured"}`,
    },
    { key: "assessment", label: "Assessment generated", ok: !!app.assessment, detail: app.assessment ? `Total K ${app.assessment.total.toFixed(2)}` : "Generate the fee assessment" },
  ];
}

/** Supervisor approval rules (spec §36). */
export function approvalChecklist(
  app: RegistrationApplication,
  ctx: { inspection?: Inspection | null; insurance?: InsuranceRecord | null; payment?: Payment | null; settings: AppSettings },
): ChecklistItem[] {
  const docs = documentsChecklist(app);
  const nothingDue = !!app.assessment && app.assessment.total === 0;
  const paidOk = ctx.payment?.status === "successful" || nothingDue;
  const assessmentOk = !!app.assessment && (nothingDue || ctx.payment?.status !== "successful" || Math.abs((ctx.payment?.amount ?? 0) - app.assessment.total) < 0.005);
  const inspOk = inspectionSatisfied(app, ctx.inspection, ctx.settings);
  const insOk = insuranceSatisfied(app, ctx.insurance, ctx.settings);
  return [
    {
      key: "inspection",
      label: "Inspection = Passed",
      ok: inspOk,
      detail: !ctx.settings.registration.requireInspection || !app.inspectionRequired ? "Not required for this transaction" : inspOk ? `${ctx.inspection?.result === "conditional" ? "Conditional approval" : "Passed"} · ${ctx.inspection?.certificateNumber ?? ctx.inspection?.reference ?? ""}` : "Inspection has not passed",
    },
    {
      key: "insurance",
      label: "Insurance = Verified",
      ok: insOk,
      detail: !ctx.settings.registration.requireInsuranceVerification || !app.insuranceRequired ? "Not required for this transaction" : insOk ? `Verified · ${ctx.insurance?.policyNumber}` : `Insurance is ${ctx.insurance?.status ?? "missing"}`,
    },
    { key: "payment", label: "Payment = Successful", ok: paidOk, detail: nothingDue ? "No amount due" : paidOk ? `${ctx.payment?.receiptNumber}` : "No successful payment recorded" },
    {
      key: "documents",
      label: "Required Documents = Verified",
      ok: docs.verified,
      detail: docs.required.length === 0 ? "No documents required" : docs.verified ? "All required documents verified" : "Verify every required document",
    },
    { key: "assessment", label: "Assessment = Valid", ok: assessmentOk, detail: assessmentOk ? `K ${app.assessment?.total.toFixed(2)}` : app.assessment ? "Paid amount does not match the assessment" : "Assessment missing" },
  ];
}

/** Summary payment state of an application for tables (see APPLICATION_PAYMENT_STATUS). */
export function paymentStateOf(app: Pick<RegistrationApplication, "id" | "status" | "assessment" | "paymentId">, payments: Pick<Payment, "applicationId" | "status" | "createdAt">[]): "not_due" | "unpaid" | "paid" | "failed" {
  const mine = payments.filter((p) => p.applicationId === app.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (mine.some((p) => p.status === "successful")) return "paid";
  if (!app.assessment || app.assessment.total === 0) return "not_due";
  if (["paid", "for_approval", "approved", "registered"].includes(app.status)) return "paid";
  if (mine[0] && ["declined", "failed", "timeout", "unknown", "cancelled"].includes(mine[0].status)) return "failed";
  return "unpaid";
}
