import type { BaseRecord, ISODate } from "./common";

export type PaymentMethod = "pos" | "cash" | "online" | "bank_transfer";
export type PaymentStatus = "processing" | "successful" | "declined" | "timeout" | "unknown" | "failed" | "cancelled";

export interface Payment extends BaseRecord {
  reference: string;
  receiptNumber?: string;
  applicationId: string;
  method: PaymentMethod;
  amount: number;
  currency: "PGK";
  status: PaymentStatus;
  /** One key per application assessment — blocks duplicate charges across retries. */
  idempotencyKey: string;
  attempt: number;
  officeId: string;
  cashierId: string;
  cashierName: string;
  terminalId?: string;
  approvalCode?: string;
  cardMasked?: string;
  amountTendered?: number;
  change?: number;
  bankName?: string;
  bankReference?: string;
  failureReason?: string;
  completedAt?: ISODate;
  verificationToken: string;
}

export interface ReceiptData {
  receiptNumber: string;
  transactionNumber: string;
  registrationNumber?: string;
  owner: string;
  motorcycle: string;
  vinOrChassis: string;
  engineNumber: string;
  paymentMethod: string;
  amount: number;
  lines: { name: string; amount: number }[];
  paymentReference: string;
  terminalId?: string;
  approvalCode?: string;
  cardMasked?: string;
  amountTendered?: number;
  change?: number;
  cashier: string;
  office: string;
  paidAt: ISODate;
  verifyPath: string;
}
