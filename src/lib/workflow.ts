import { REQUIRED_DOCUMENTS } from "./constants";
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

/** Wizard step (1–8) that matches where the application currently sits. */
export function stepForStatus(app: RegistrationApplication): number {
  switch (app.status) {
    case "draft":
    case "pending":
    case "returned":
      return Math.min(Math.max(app.currentStep || 1, 1), 3);
    case "for_inspection":
    case "inspection_failed":
      return 4;
    case "for_insurance_verification":
      return 5;
    case "for_assessment":
      return 6;
    case "payment_required":
      return 7;
    default:
      return 8;
  }
}

/** Highest wizard step the officer may open for this application. */
export function maxReachableStep(app: RegistrationApplication): number {
  if (isEditable(app)) return Math.max(3, Math.min(app.currentStep || 1, 3));
  return Math.max(stepForStatus(app), 3);
}

/** Where an application goes after it is (re)submitted from pending. */
export function nextAfterSubmission(
  app: RegistrationApplication,
  ctx: { inspection?: Inspection | null; insurance?: InsuranceRecord | null; payment?: Payment | null; settings: AppSettings },
): RegistrationStatus {
  const inspectionOk = !ctx.settings.registration.requireInspection || ctx.inspection?.result === "pass";
  const insuranceOk = !ctx.settings.registration.requireInsuranceVerification || ctx.insurance?.status === "verified";
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

export function documentsChecklist(app: RegistrationApplication) {
  const required = app.type === "new" ? REQUIRED_DOCUMENTS : [];
  const docs = app.documents.filter((d) => required.includes(d.type));
  const present = required.every((t) => docs.some((d) => d.type === t && (d.status === "uploaded" || d.status === "verified")));
  const verified = required.every((t) => docs.some((d) => d.type === t && d.status === "verified"));
  const missing = required.filter((t) => !docs.some((d) => d.type === t && (d.status === "uploaded" || d.status === "verified")));
  return { required, present, verified, missing };
}

/** Pre-payment checklist (spec §25). */
export function assessmentChecklist(
  app: RegistrationApplication,
  ctx: { ownerComplete: boolean; motorcycleComplete: boolean; inspection?: Inspection | null; insurance?: InsuranceRecord | null; settings: AppSettings },
): ChecklistItem[] {
  const docs = documentsChecklist(app);
  return [
    { key: "owner", label: "Owner complete", ok: ctx.ownerComplete, detail: ctx.ownerComplete ? "Owner record linked" : "Owner details incomplete" },
    { key: "motorcycle", label: "Motorcycle complete", ok: ctx.motorcycleComplete, detail: ctx.motorcycleComplete ? "Motorcycle record linked" : "Motorcycle details incomplete" },
    { key: "documents", label: "Required documents present", ok: docs.present, detail: docs.present ? "All required documents uploaded" : `${docs.missing.length} required document(s) missing` },
    {
      key: "inspection",
      label: "Inspection passed",
      ok: !ctx.settings.registration.requireInspection || ctx.inspection?.result === "pass",
      detail: !ctx.settings.registration.requireInspection ? "Not required by settings" : ctx.inspection?.result === "pass" ? `Certificate ${ctx.inspection.certificateNumber}` : "Roadworthiness inspection not passed",
    },
    {
      key: "insurance",
      label: "Insurance verified",
      ok: !ctx.settings.registration.requireInsuranceVerification || ctx.insurance?.status === "verified",
      detail: !ctx.settings.registration.requireInsuranceVerification ? "Not required by settings" : ctx.insurance?.status === "verified" ? `Policy ${ctx.insurance.policyNumber}` : `Insurance ${ctx.insurance?.status ?? "not captured"}`,
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
  const paidOk = ctx.payment?.status === "successful";
  const assessmentOk = !!app.assessment && (!paidOk || Math.abs((ctx.payment?.amount ?? 0) - app.assessment.total) < 0.005);
  return [
    {
      key: "inspection",
      label: "Inspection = Passed",
      ok: !ctx.settings.registration.requireInspection || ctx.inspection?.result === "pass",
      detail: ctx.inspection?.result === "pass" ? `Passed · ${ctx.inspection.certificateNumber}` : !ctx.settings.registration.requireInspection ? "Not required by settings" : "Inspection has not passed",
    },
    {
      key: "insurance",
      label: "Insurance = Verified",
      ok: !ctx.settings.registration.requireInsuranceVerification || ctx.insurance?.status === "verified",
      detail: ctx.insurance?.status === "verified" ? `Verified · ${ctx.insurance.policyNumber}` : !ctx.settings.registration.requireInsuranceVerification ? "Not required by settings" : `Insurance is ${ctx.insurance?.status ?? "missing"}`,
    },
    { key: "payment", label: "Payment = Successful", ok: paidOk, detail: paidOk ? `${ctx.payment?.receiptNumber}` : "No successful payment recorded" },
    {
      key: "documents",
      label: "Required Documents = Verified",
      ok: docs.verified,
      detail: app.type === "renewal" ? "Not required for renewal" : docs.verified ? "All required documents verified" : "Verify every required document",
    },
    { key: "assessment", label: "Assessment = Valid", ok: assessmentOk, detail: assessmentOk ? `K ${app.assessment?.total.toFixed(2)}` : app.assessment ? "Paid amount does not match the assessment" : "Assessment missing" },
  ];
}
