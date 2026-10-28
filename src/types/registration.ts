import type { BaseRecord, ISODate } from "./common";
import type { ApplicationDocument } from "./document";
import type { Assessment } from "./fee";
import type { OwnerInput } from "./owner";
import type { MotorcycleInput } from "./motorcycle";

export type RegistrationStatus =
  | "draft"
  | "pending"
  | "for_inspection"
  | "inspection_failed"
  | "for_insurance_verification"
  | "for_assessment"
  | "payment_required"
  | "paid"
  | "for_approval"
  | "approved"
  | "registered"
  | "returned"
  | "rejected"
  | "cancelled";

export type ApplicationType = "new" | "renewal";

export interface StatusHistoryEntry {
  from: RegistrationStatus | null;
  to: RegistrationStatus;
  at: ISODate;
  by: string;
  byName: string;
  note?: string;
}

export interface WizardDraft {
  owner?: Partial<OwnerInput>;
  motorcycle?: Partial<MotorcycleInput>;
  ownerMode?: "search" | "existing" | "new";
}

export interface ApprovalDecision {
  decision: "approved" | "returned" | "rejected";
  by: string;
  byName: string;
  at: ISODate;
  reason?: string;
}

export interface RegistrationApplication extends BaseRecord {
  transactionNumber: string;
  type: ApplicationType;
  status: RegistrationStatus;
  currentStep: number;
  officeId: string;
  createdBy: string;
  createdByName: string;
  ownerId?: string;
  motorcycleId?: string;
  previousApplicationId?: string;
  draft: WizardDraft;
  documents: ApplicationDocument[];
  inspectionId?: string;
  insuranceId?: string;
  assessment?: Assessment;
  paymentId?: string;
  approval?: ApprovalDecision;
  registrationNumber?: string;
  certificateNumber?: string;
  labelNumber?: string;
  plateNumber?: string;
  registrationDate?: ISODate;
  expiryDate?: ISODate;
  submittedAt?: ISODate;
  completedAt?: ISODate;
  returnReason?: string;
  rejectReason?: string;
  verificationToken: string;
  history: StatusHistoryEntry[];
  /** Seeded UAT scenario label, e.g. "Scenario A — Ready for inspection". */
  scenario?: string;
}

export interface CreateRegistrationInput {
  type: "new" | "renewal";
  officeId: string;
  ownerId?: string;
  motorcycleId?: string;
  previousApplicationId?: string;
}

export type UpdateRegistrationInput = Partial<
  Omit<RegistrationApplication, "id" | "createdAt" | "transactionNumber" | "history" | "status">
>;
