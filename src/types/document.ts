import type { FileMeta, ISODate } from "./common";

export type DocumentType =
  | "owner_identification"
  | "proof_of_ownership"
  | "import_purchase"
  | "roadworthiness_certificate"
  | "insurance_certificate"
  | "other_supporting";

export type DocumentStatus = "missing" | "uploaded" | "verified" | "rejected";

export interface ApplicationDocument {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  file?: FileMeta;
  verifiedBy?: string;
  verifiedAt?: ISODate;
  rejectionReason?: string;
  note?: string;
}
