import type { BaseRecord, FileMeta, ISODate } from "./common";

export type InsuranceStatus = "pending" | "verified" | "expired" | "invalid" | "rejected";

export interface InsuranceRecord extends BaseRecord {
  applicationId: string;
  motorcycleId: string;
  provider: string;
  policyNumber: string;
  policyHolder: string;
  coverageStart: string;
  coverageExpiry: string;
  premium: number;
  vinOrChassis: string;
  certificate?: FileMeta;
  status: InsuranceStatus;
  verifiedBy?: string;
  verifiedAt?: ISODate;
  remarks?: string;
}
