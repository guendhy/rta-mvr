import type { BaseRecord, FileMeta, ISODate } from "./common";

export type InspectionStatus = "not_inspected" | "scheduled" | "in_progress" | "passed" | "failed" | "conditional" | "reinspection_required";
export type InspectionResult = "pass" | "fail" | "conditional";
export type ChecklistValue = "pass" | "fail" | "na";

export interface ChecklistItemDef {
  key: string;
  label: string;
}
export interface ChecklistCategoryDef {
  key: string;
  label: string;
  items: ChecklistItemDef[];
}

export interface InspectionDefect {
  itemKey: string;
  label: string;
  severity: "minor" | "major" | "dangerous";
  note?: string;
}

export interface Inspection extends BaseRecord {
  /** INS-NCD-2026-000001 */
  reference?: string;
  applicationId: string;
  vehicleId: string;
  attempt: number;
  status: InspectionStatus;
  centerId?: string;
  inspectorId?: string;
  inspectionDate?: string;
  location?: string;
  odometerKm?: number;
  certificateNumber?: string;
  certificateDate?: string;
  certificateExpiry?: string;
  /** Keys come from the vehicle-aware checklist (`inspectionChecklistFor`). */
  checklist: Record<string, ChecklistValue | undefined>;
  defects?: InspectionDefect[];
  attachments?: FileMeta[];
  result?: InspectionResult;
  failureReason?: string;
  /** Conditions the owner must meet under a conditional approval. */
  conditions?: string;
  notes?: string;
  submittedAt?: ISODate;
}

export interface InspectionCenter extends BaseRecord {
  name: string;
  code: string;
  province: string;
  district: string;
  address: string;
  status: "active" | "inactive";
}
