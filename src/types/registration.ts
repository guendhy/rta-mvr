import type { BaseRecord, ISODate } from "./common";
import type { ApplicationDocument } from "./document";
import type { Assessment } from "./fee";
import type { OwnerInput } from "./owner";
import type { VehicleClassification, VehicleInput } from "./vehicle";

/** Application workflow status (see `src/lib/workflow.ts` for the transition map). */
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

/** Every RTA motor vehicle transaction. Labels and step plans live in `src/config/transaction-types.ts`. */
export type TransactionType =
  | "new"
  | "renewal"
  | "transfer"
  | "change_vehicle"
  | "change_owner"
  | "replacement_certificate"
  | "replacement_plate"
  | "duplicate_certificate"
  | "reclassification"
  | "deregistration"
  | "reinstatement"
  | "registration_transfer"
  | "other";

/** @deprecated use TransactionType */
export type ApplicationType = TransactionType;

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
  classification?: Partial<VehicleClassification>;
  vehicle?: Partial<VehicleInput>;
  ownerMode?: "search" | "existing" | "new";
}

export interface ApprovalDecision {
  decision: "approved" | "returned" | "rejected";
  by: string;
  byName: string;
  at: ISODate;
  reason?: string;
}

/** Transfer of ownership — the former owner is kept, never overwritten. */
export interface TransferDetails {
  previousOwnerId: string;
  newOwnerId?: string;
  saleDate?: string;
  salePrice?: number;
  reason: "sale" | "gift" | "inheritance" | "court_order" | "company_restructure" | "other";
  sellerConsent: boolean;
}

/** Requested changes for change-of-details, reclassification and registration transfers. */
export interface ChangeRequest {
  summary: string;
  changes: { field: string; label: string; from?: string; to: string }[];
}

export interface RegistrationApplication extends BaseRecord {
  transactionNumber: string;
  type: TransactionType;
  status: RegistrationStatus;
  currentStep: number;
  officeId: string;
  createdBy: string;
  createdByName: string;
  assignedOfficerId?: string;
  assignedOfficerName?: string;
  ownerId?: string;
  vehicleId?: string;
  previousApplicationId?: string;
  draft: WizardDraft;
  documents: ApplicationDocument[];
  /** Resolved from the transaction / classification rules when the vehicle is known. */
  inspectionRequired: boolean;
  insuranceRequired: boolean;
  /** A new plate is issued on completion. */
  plateRequired: boolean;
  inspectionId?: string;
  insuranceId?: string;
  assessment?: Assessment;
  paymentId?: string;
  approval?: ApprovalDecision;
  transfer?: TransferDetails;
  changeRequest?: ChangeRequest;
  /** Deregistration / cancellation reason. */
  closureReason?: string;
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
  type: TransactionType;
  officeId: string;
  ownerId?: string;
  vehicleId?: string;
  previousApplicationId?: string;
}

export type UpdateRegistrationInput = Partial<
  Omit<RegistrationApplication, "id" | "createdAt" | "transactionNumber" | "history" | "status">
>;
