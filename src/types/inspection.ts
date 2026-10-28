import type { BaseRecord, ISODate } from "./common";

export type InspectionStatus = "not_inspected" | "scheduled" | "in_progress" | "passed" | "failed" | "reinspection_required";
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

export interface Inspection extends BaseRecord {
  applicationId: string;
  motorcycleId: string;
  attempt: number;
  status: InspectionStatus;
  centerId?: string;
  inspectorId?: string;
  inspectionDate?: string;
  certificateNumber?: string;
  certificateDate?: string;
  certificateExpiry?: string;
  checklist: Record<string, ChecklistValue | undefined>;
  result?: "pass" | "fail";
  failureReason?: string;
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
