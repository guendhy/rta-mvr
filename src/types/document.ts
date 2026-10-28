import type { FileMeta, ISODate } from "./common";

export type DocumentType =
  | "proof_of_identity"
  | "proof_of_ownership"
  | "purchase_receipt"
  | "import_documentation"
  | "customs_clearance"
  | "previous_registration"
  | "inspection_certificate"
  | "insurance_certificate"
  | "transfer_documents"
  | "company_registration"
  | "government_authorization"
  | "operating_permit"
  | "diplomatic_clearance"
  | "police_report"
  | "other_supporting";

/** "missing" renders as Required or Optional depending on `required`. */
export type DocumentStatus = "missing" | "uploaded" | "verified" | "rejected";

export interface ApplicationDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  /** Resolved from the requirement rules for this transaction, vehicle, use and owner. */
  required: boolean;
  /** Why the rule applies, e.g. "PMV use". */
  reason?: string;
  file?: FileMeta;
  verifiedBy?: string;
  verifiedAt?: ISODate;
  rejectionReason?: string;
  note?: string;
}
