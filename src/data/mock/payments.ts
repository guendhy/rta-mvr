import { DECLINE_REASONS } from "@/lib/constants";
import { generators, token } from "@/lib/generators";
import type { Counters, Payment, PaymentMethod, PaymentStatus } from "@/types";

const BANKS = ["BSP", "Kina Bank", "Westpac PNG", "ANZ PNG"];

export function buildPayment(input: {
  id: string;
  applicationId: string;
  method: PaymentMethod;
  amount: number;
  status: Extract<PaymentStatus, "successful" | "declined" | "failed">;
  attempt: number;
  at: Date;
  officeId: string;
  cashierId: string;
  cashierName: string;
  terminalId?: string;
  counters: Counters;
  index: number;
}): Payment {
  const iso = input.at.toISOString();
  const ok = input.status === "successful";
  const payment: Payment = {
    id: input.id,
    reference: generators.paymentReference(input.at, input.counters),
    applicationId: input.applicationId,
    method: input.method,
    amount: input.amount,
    currency: "PGK",
    status: input.status,
    idempotencyKey: `${input.applicationId}:${input.amount.toFixed(2)}`,
    attempt: input.attempt,
    officeId: input.officeId,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    verificationToken: token(),
    createdAt: iso,
    updatedAt: iso,
  };
  if (input.method === "pos") {
    payment.terminalId = input.terminalId;
    payment.cardMasked = `•••• ${String(4100 + input.index * 37).slice(-4)}`;
    if (ok) payment.approvalCode = String(704219 + input.index * 113).slice(-6);
  }
  if (input.method === "cash" && ok) {
    const tendered = Math.ceil(input.amount / 50) * 50 + (input.index % 2 ? 50 : 0);
    payment.amountTendered = tendered;
    payment.change = tendered - input.amount;
  }
  if (input.method === "bank_transfer" || input.method === "online") {
    payment.bankName = BANKS[input.index % BANKS.length];
    payment.bankReference = `${input.method === "online" ? "WEB" : "TRF"}${String(880000 + input.index * 71)}`;
  }
  if (ok) {
    payment.receiptNumber = generators.receiptNumber(input.at, input.counters);
    payment.completedAt = iso;
  } else {
    payment.failureReason = input.status === "declined" ? DECLINE_REASONS[input.index % DECLINE_REASONS.length] : "Terminal timeout — status check confirmed card was not charged";
  }
  return payment;
}
