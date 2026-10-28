import type { BaseRecord } from "./common";

export type FeeCode =
  | "REG_NO_SIDECAR"
  | "REG_SIDECAR"
  | "NUMBER_PLATE"
  | "REPLACE_CERT_LABEL"
  | "REPLACE_PLATE"
  | "TRANSFER"
  | "UNREG_PERMIT"
  | "ADD_SIDECAR";

export interface Fee extends BaseRecord {
  code: FeeCode;
  name: string;
  amount: number;
  currency: "PGK";
  active: boolean;
  effectiveDate: string;
  /** Optional fees can be added by the officer in demo mode. */
  optional: boolean;
}

export interface AssessmentLine {
  feeCode: FeeCode;
  name: string;
  amount: number;
}

export interface Assessment {
  lines: AssessmentLine[];
  total: number;
  currency: "PGK";
  generatedAt: string;
  generatedBy: string;
}
