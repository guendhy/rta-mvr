import { checklistKeysFor, inspectionChecklistFor } from "@/config/inspection-checklists";
import type { ChecklistValue, Inspection, InspectionDefect, VehicleType } from "@/types";

/** Items marked failed in the seeded failed inspection (first matching keys are used). */
const FAILED_CANDIDATES = ["brakes", "tires", "motorcycle_tires", "indicators", "emergency_exit", "trailer_brakes"];

export function passedChecklist(type: VehicleType): Record<string, ChecklistValue> {
  return Object.fromEntries(checklistKeysFor(type).map((k) => [k, "pass" as ChecklistValue]));
}

export function failedChecklist(type: VehicleType): { checklist: Record<string, ChecklistValue>; defects: InspectionDefect[] } {
  const keys = checklistKeysFor(type);
  const failed = FAILED_CANDIDATES.filter((k) => keys.includes(k)).slice(0, 3);
  const labels = Object.fromEntries(inspectionChecklistFor(type).flatMap((c) => c.items.map((i) => [i.key, i.label])));
  return {
    checklist: Object.fromEntries(keys.map((k) => [k, failed.includes(k) ? "fail" : "pass"] as [string, ChecklistValue])),
    defects: failed.map((k, i) => ({ itemKey: k, label: labels[k] ?? k, severity: i === 0 ? "major" : "minor", note: i === 0 ? "Below minimum standard" : "Repair required" })),
  };
}

export function buildInspection(input: {
  id: string;
  applicationId: string;
  vehicleId: string;
  vehicleType: VehicleType;
  attempt: number;
  centerId: string;
  location?: string;
  inspectorId?: string;
  at: string;
  outcome: "pass" | "fail" | "scheduled";
  reference?: string;
  certificateNumber?: string;
  odometerKm?: number;
}): Inspection {
  const date = input.at.slice(0, 10);
  const base: Inspection = {
    id: input.id,
    reference: input.reference,
    applicationId: input.applicationId,
    vehicleId: input.vehicleId,
    attempt: input.attempt,
    status: "scheduled",
    centerId: input.centerId,
    location: input.location,
    inspectorId: input.inspectorId,
    inspectionDate: date,
    checklist: {},
    createdAt: input.at,
    updatedAt: input.at,
  };
  if (input.outcome === "scheduled") return base;
  if (input.outcome === "fail") {
    const { checklist, defects } = failedChecklist(input.vehicleType);
    return {
      ...base,
      status: "failed",
      checklist,
      defects,
      odometerKm: input.odometerKm,
      result: "fail",
      failureReason: "Brakes not effective",
      notes: `${defects.map((d) => d.label).join("; ")} — reinspection required after repairs.`,
      submittedAt: input.at,
    };
  }
  const expiry = new Date(input.at);
  expiry.setMonth(expiry.getMonth() + 3);
  return {
    ...base,
    status: "passed",
    checklist: passedChecklist(input.vehicleType),
    defects: [],
    odometerKm: input.odometerKm,
    result: "pass",
    certificateNumber: input.certificateNumber,
    certificateDate: date,
    certificateExpiry: expiry.toISOString().slice(0, 10),
    notes: "Vehicle roadworthy. All checklist items passed.",
    submittedAt: input.at,
  };
}
