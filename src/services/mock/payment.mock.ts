import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { ServiceError } from "@/lib/errors";
import { fullName, vehicleLabel } from "@/lib/formatting";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { generators, token, uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import type { PaymentListFilter, PaymentQueueItem, PaymentService } from "../interfaces";
import type { Payment, PaymentMethod, PosPaymentResult, ReceiptData } from "@/types";
import { actor, actorName, audit, findById, getPosState, mustFind, notify, nowIso, read, requireOnline, requirePermission, simulateNetwork, upsert } from "./core";
import { MockPosTerminalAdapter } from "./pos.mock";
import { loadApp, saveApp, transition } from "./registration.mock";

const pos = new MockPosTerminalAdapter();

function paymentsFor(applicationId: string) {
  return read("payments").filter((p) => p.applicationId === applicationId);
}

/** Duplicate-charge protection: one successful payment per application, ever. */
function assertPayable(applicationId: string) {
  const app = loadApp(applicationId);
  if (paymentsFor(applicationId).some((p) => p.status === "successful")) {
    throw new ServiceError("conflict", "This transaction has already been paid.");
  }
  if (app.status !== "payment_required" || !app.assessment) {
    throw new ServiceError("workflow", "This application is not ready for payment.");
  }
  const unresolved = paymentsFor(applicationId).find((p) => p.status === "unknown" || p.status === "processing");
  if (unresolved) {
    throw new ServiceError("conflict", `Payment ${unresolved.reference} has an unknown status. Check payment status before taking another payment.`);
  }
  return app;
}

function newPayment(applicationId: string, method: PaymentMethod, extra: Partial<Payment> = {}): Payment {
  const app = loadApp(applicationId);
  const a = actor();
  const ts = nowIso();
  return {
    id: uuid(),
    reference: generators.paymentReference(),
    applicationId,
    method,
    amount: app.assessment!.total,
    currency: "PGK",
    status: "processing",
    idempotencyKey: `${applicationId}:${app.assessment!.total.toFixed(2)}`,
    attempt: paymentsFor(applicationId).length + 1,
    officeId: app.officeId,
    cashierId: a.id,
    cashierName: actorName(),
    verificationToken: token(),
    createdAt: ts,
    updatedAt: ts,
    ...extra,
  };
}

function finalizeSuccess(payment: Payment, extra: Partial<Payment> = {}): Payment {
  const app = loadApp(payment.applicationId);
  if (paymentsFor(app.id).some((p) => p.status === "successful" && p.id !== payment.id)) {
    throw new ServiceError("conflict", "This transaction has already been paid.");
  }
  const ts = nowIso();
  const done: Payment = { ...payment, ...extra, status: "successful", receiptNumber: generators.receiptNumber(), completedAt: ts, updatedAt: ts, failureReason: undefined };
  upsert("payments", done);
  app.paymentId = done.id;
  transition(app, "paid", `Receipt ${done.receiptNumber}`);
  transition(app, "for_approval", "Sent for supervisor approval");
  saveApp(app);
  audit("payment_processed", "Payment", `${PAYMENT_METHOD_LABELS[done.method]} payment ${done.reference} — K ${done.amount.toFixed(2)} · receipt ${done.receiptNumber}`, { id: app.id, label: app.transactionNumber });
  notify("Payment Received", `K ${done.amount.toFixed(2)} received for ${app.transactionNumber} (${PAYMENT_METHOD_LABELS[done.method]}).`, "success", `/payments/${done.id}`);
  notify("Registration Ready for Approval", `${app.transactionNumber} is paid and waiting for approval.`, "info", `/registrations/${app.id}`);
  return done;
}

// FUTURE: Replace MockPaymentService with a real payment provider + webhook-confirmed SupabasePaymentService.
export class MockPaymentService implements PaymentService {
  async list(filter: PaymentListFilter = {}): Promise<Payment[]> {
    await mockDelay();
    let list = read("payments");
    if (filter.status) list = list.filter((p) => p.status === filter.status);
    if (filter.method) list = list.filter((p) => p.method === filter.method);
    if (filter.applicationId) list = list.filter((p) => p.applicationId === filter.applicationId);
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getById(id: string): Promise<Payment | null> {
    await mockDelay(150, 400);
    return findById("payments", id);
  }

  async listForApplication(applicationId: string): Promise<Payment[]> {
    await mockDelay(100, 300);
    return paymentsFor(applicationId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async queue(): Promise<PaymentQueueItem[]> {
    await mockDelay();
    return read("applications")
      .filter((a) => a.status === "payment_required")
      .map((application) => ({
        application,
        owner: findById("owners", application.ownerId),
        vehicle: findById("vehicles", application.vehicleId),
        lastAttempt: paymentsFor(application.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
      }))
      .sort((a, b) => b.application.updatedAt.localeCompare(a.application.updatedAt));
  }

  async findSuccessful(applicationId: string): Promise<Payment | null> {
    await mockDelay(100, 250);
    return paymentsFor(applicationId).find((p) => p.status === "successful") ?? null;
  }

  async payCash(applicationId: string, amountTendered: number): Promise<Payment> {
    requirePermission("payment.process", "take payments");
    requireOnline();
    await mockDelay(500, 900);
    simulateNetwork();
    const app = assertPayable(applicationId);
    const due = app.assessment!.total;
    if (!Number.isFinite(amountTendered) || amountTendered < due) throw new ServiceError("validation", `Amount tendered must be at least K ${due.toFixed(2)}.`);
    const p = newPayment(applicationId, "cash", { amountTendered, change: Math.round((amountTendered - due) * 100) / 100 });
    return finalizeSuccess(p);
  }

  async payOnline(applicationId: string, input: { bankName: string }): Promise<Payment> {
    requirePermission("payment.process", "take payments");
    requireOnline();
    await mockDelay(900, 1500);
    simulateNetwork();
    assertPayable(applicationId);
    const p = newPayment(applicationId, "online", { bankName: input.bankName, bankReference: `WEB${Date.now().toString().slice(-7)}` });
    return finalizeSuccess(p);
  }

  async payBankTransfer(applicationId: string, input: { bankName: string; bankReference: string; transferDate: string }): Promise<Payment> {
    requirePermission("payment.process", "take payments");
    requireOnline();
    await mockDelay(600, 1000);
    simulateNetwork();
    assertPayable(applicationId);
    if (!input.bankReference.trim()) throw new ServiceError("validation", "Enter the bank transfer reference.");
    if (read("payments").some((p) => p.status === "successful" && p.bankReference?.toLowerCase() === input.bankReference.trim().toLowerCase())) {
      throw new ServiceError("conflict", "This bank reference has already been used for another payment.");
    }
    const p = newPayment(applicationId, "bank_transfer", { bankName: input.bankName, bankReference: input.bankReference.trim() });
    return finalizeSuccess(p);
  }

  async payElectronic(applicationId: string, input: { method: "card" | "qr"; reference: string; provider?: string }): Promise<Payment> {
    requirePermission("payment.process", "take payments");
    requireOnline();
    await mockDelay(700, 1200);
    simulateNetwork();
    assertPayable(applicationId);
    if (!input.reference.trim()) throw new ServiceError("validation", `Enter the ${input.method === "qr" ? "QR transaction" : "card authorisation"} reference.`);
    if (read("payments").some((p) => p.status === "successful" && p.bankReference?.toLowerCase() === input.reference.trim().toLowerCase())) {
      throw new ServiceError("conflict", "This reference has already been used for another payment.");
    }
    const p = newPayment(applicationId, input.method, { bankName: input.provider, bankReference: input.reference.trim() });
    return finalizeSuccess(p);
  }

  async createPosAttempt(applicationId: string): Promise<Payment> {
    requirePermission("payment.process", "take payments");
    requireOnline();
    await mockDelay(200, 400);
    simulateNetwork();
    assertPayable(applicationId);
    const p = newPayment(applicationId, "pos", { terminalId: getPosState().activeTerminalId });
    upsert("payments", p);
    return p;
  }

  async completePosAttempt(paymentId: string, result: PosPaymentResult): Promise<Payment> {
    const p = mustFind("payments", paymentId, "Payment");
    if (p.status !== "processing") return p;
    const app = loadApp(p.applicationId);
    if (result.outcome === "approved") {
      return finalizeSuccess(p, { approvalCode: result.approvalCode, cardMasked: result.cardMasked, terminalId: result.terminalId });
    }
    const ts = nowIso();
    const next: Payment = result.outcome === "declined"
      ? { ...p, status: "declined", cardMasked: result.cardMasked, failureReason: result.declineReason ?? "Declined by issuer", completedAt: ts, updatedAt: ts }
      : { ...p, status: "unknown", failureReason: result.outcome === "disconnected" ? "Connection to the terminal was lost during payment" : result.outcome === "timeout" ? "The simulated terminal did not respond" : "The terminal did not return a final result", updatedAt: ts };
    upsert("payments", next);
    audit("payment_failed", "Payment", `POS payment ${p.reference} ${next.status}: ${next.failureReason}`, { id: app.id, label: app.transactionNumber });
    if (next.status === "declined") notify("Payment Declined", `POS payment for ${app.transactionNumber} was declined (${next.failureReason}).`, "warning", `/payments/${p.id}`);
    return next;
  }

  async checkPosStatus(paymentId: string): Promise<Payment> {
    requirePermission("payment.process", "check payment status");
    const p = mustFind("payments", paymentId, "Payment");
    if (p.status !== "unknown" && p.status !== "processing") return p;
    const status = await pos.checkPayment(p.reference);
    const app = loadApp(p.applicationId);
    audit("payment_status_checked", "Payment", `Status check for ${p.reference}: ${status.status}`, { id: app.id, label: app.transactionNumber });
    if (status.status === "approved") {
      await pos.cancelPayment(p.reference);
      return finalizeSuccess(p, { approvalCode: status.approvalCode, cardMasked: status.cardMasked });
    }
    const ts = nowIso();
    const next: Payment = { ...p, status: status.status === "declined" ? "declined" : "failed", failureReason: "Status check confirmed the card was not charged", completedAt: ts, updatedAt: ts };
    upsert("payments", next);
    await pos.cancelPayment(p.reference);
    return next;
  }

  async cancelPosAttempt(paymentId: string): Promise<Payment> {
    const p = mustFind("payments", paymentId, "Payment");
    if (p.status !== "processing") throw new ServiceError("workflow", "Only an attempt that has not reached the terminal can be cancelled. Check payment status instead.");
    const next: Payment = { ...p, status: "cancelled", failureReason: "Cancelled by cashier", updatedAt: nowIso() };
    upsert("payments", next);
    return next;
  }

  async getReceiptData(paymentId: string): Promise<ReceiptData | null> {
    await mockDelay(150, 400);
    const p = findById("payments", paymentId);
    if (!p || p.status !== "successful") return null;
    const app = findById("applications", p.applicationId);
    const owner = findById("owners", app?.ownerId);
    const v = findById("vehicles", app?.vehicleId);
    const office = findById("offices", p.officeId);
    return {
      receiptNumber: p.receiptNumber!,
      transactionNumber: app?.transactionNumber ?? "—",
      registrationNumber: app?.registrationNumber ?? v?.registrationNumber,
      owner: fullName(owner).toUpperCase(),
      vehicle: `${vehicleLabel(v)} ${v?.color ?? ""}`.toUpperCase().trim(),
      vehicleType: vehicleTypeLabel(v?.vehicleType),
      transactionType: transactionLabel(app?.type),
      plateNumber: app?.plateNumber ?? v?.plateNumber,
      vinOrChassis: v?.vin ?? "—",
      engineNumber: v?.engineNumber || "—",
      paymentMethod: PAYMENT_METHOD_LABELS[p.method],
      amount: p.amount,
      lines: app?.assessment?.lines.map((l) => ({ name: l.name, amount: l.amount, sample: l.sample })) ?? [{ name: "Registration", amount: p.amount }],
      paymentReference: p.reference,
      terminalId: p.terminalId,
      approvalCode: p.approvalCode,
      cardMasked: p.cardMasked,
      amountTendered: p.amountTendered,
      change: p.change,
      cashier: p.cashierName,
      office: office?.name ?? "RTA Office",
      paidAt: p.completedAt ?? p.createdAt,
      verifyPath: `/verify/receipt/${p.verificationToken}`,
    };
  }

  async findByToken(tok: string): Promise<Payment | null> {
    await mockDelay(300, 600);
    return read("payments").find((p) => p.verificationToken === tok) ?? null;
  }
}
