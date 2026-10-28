import { CHECKLIST_KEYS } from "@/lib/constants";
import type { ChecklistValue, Inspection } from "@/types";

export const FAILED_ITEMS = ["front_brake", "rear_tire", "left_indicator"];

export function passedChecklist(): Record<string, ChecklistValue> {
  return Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, "pass" as ChecklistValue]));
}

export function failedChecklist(): Record<string, ChecklistValue> {
  return Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, FAILED_ITEMS.includes(k) ? "fail" : "pass"] as [string, ChecklistValue]));
}

export function buildInspection(input: {
  id: string;
  applicationId: string;
  motorcycleId: string;
  attempt: number;
  centerId: string;
  inspectorId?: string;
  at: string;
  outcome: "pass" | "fail" | "scheduled";
  certificateNumber?: string;
}): Inspection {
  const date = input.at.slice(0, 10);
  const base: Inspection = {
    id: input.id,
    applicationId: input.applicationId,
    motorcycleId: input.motorcycleId,
    attempt: input.attempt,
    status: "scheduled",
    centerId: input.centerId,
    inspectorId: input.inspectorId,
    inspectionDate: date,
    checklist: {},
    createdAt: input.at,
    updatedAt: input.at,
  };
  if (input.outcome === "scheduled") return base;
  if (input.outcome === "fail") {
    return {
      ...base,
      status: "failed",
      checklist: failedChecklist(),
      result: "fail",
      failureReason: "Brakes not effective",
      notes: "Front brake pads worn below limit; rear tyre tread 0.8 mm; left indicator inoperative. Reinspection required after repairs.",
      submittedAt: input.at,
    };
  }
  const expiry = new Date(input.at);
  expiry.setMonth(expiry.getMonth() + 3);
  return {
    ...base,
    status: "passed",
    checklist: passedChecklist(),
    result: "pass",
    certificateNumber: input.certificateNumber,
    certificateDate: date,
    certificateExpiry: expiry.toISOString().slice(0, 10),
    notes: "Motorcycle roadworthy. All checklist items passed.",
    submittedAt: input.at,
  };
}
