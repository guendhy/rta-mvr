"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Banknote, CheckCircle2, CreditCard, Globe, Landmark, Printer } from "lucide-react";
import { paymentService } from "@/services/payment.service";
import { settingsService } from "@/services/settings.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useNetworkSimulation } from "@/hooks/use-network-simulation";
import { useServiceQuery } from "@/hooks/use-service";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { QrCode } from "@/components/ui/qr-code";
import { Section } from "@/components/ui/layout-bits";
import { PosStatusCard } from "@/components/pos/pos-status-card";
import { PosPaymentFlow } from "@/components/pos/pos-payment-flow";
import { ReceiptButtons } from "./receipt-buttons";
import type { RegistrationDetail } from "@/services/interfaces";
import type { Payment, PaymentMethod } from "@/types";

const BANKS = ["BSP", "Kina Bank", "Westpac PNG", "ANZ PNG", "TISA Bank"];

function PaidBlock({ payment, applicationId }: { payment: Payment; applicationId: string }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-[#bfe6cd] bg-[#e9f7ef] p-6">
        <CheckCircle2 size={40} className="flex-none text-[#137a3b]" aria-hidden="true" />
        <div>
          <p className="m-0 text-[22px] font-extrabold text-[#0b4f25]">This registration has already been paid.</p>
          <p className="m-0 mt-0.5 text-[14px] text-[#155c30]">{formatMoney(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.method]} · {formatDateTime(payment.completedAt)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <dl className="dl">
          <dt>Receipt number</dt><dd className="mono">{payment.receiptNumber}</dd>
          <dt>Payment reference</dt><dd className="mono">{payment.reference}</dd>
          {payment.terminalId && <><dt>Terminal</dt><dd className="mono">{payment.terminalId}</dd></>}
          {payment.change !== undefined && <><dt>Tendered / change</dt><dd>{formatMoney(payment.amountTendered)} / {formatMoney(payment.change)}</dd></>}
          <dt>Cashier</dt><dd>{payment.cashierName}</dd>
        </dl>
        <p className="help m-0">Additional payments are disabled — duplicate charge protection is active for this application.</p>
        <div className="row">
          <ReceiptButtons paymentId={payment.id} applicationId={applicationId} />
          <Link href={`/payments/${payment.id}`} className="btn btn-g">Payment details</Link>
        </div>
      </div>
    </div>
  );
}

/** Payment selection + collection for one application (spec §26–33). */
export function PaymentCollector({ detail, onPaid, large, initialMethod }: { detail: RegistrationDetail; onPaid?: (p: Payment) => void; large?: boolean; initialMethod?: PaymentMethod }) {
  const { can } = useDemoUser();
  const { isOnline } = useNetworkSimulation();
  const app = detail.application;
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const [method, setMethod] = useState<PaymentMethod | null>(initialMethod ?? null);
  const [tendered, setTendered] = useState("");
  const [bank, setBank] = useState(BANKS[0]);
  const [bankRef, setBankRef] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [onlineLink, setOnlineLink] = useState(false);
  const [confirm, setConfirm] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const [justPaid, setJustPaid] = useState<Payment | null>(null);

  const paid = justPaid ?? detail.payments.find((p) => p.status === "successful") ?? null;
  const due = app.assessment?.total ?? 0;
  const tenderedNum = Number(tendered || 0);
  const change = tenderedNum - due;

  const methods: { m: PaymentMethod; icon: typeof CreditCard; allowed: boolean; sub: string }[] = [
    { m: "pos", icon: CreditCard, allowed: !!settings?.payments.allowPos && !!settings?.demo.enableMockPos, sub: "Wiseasy P5 card terminal" },
    { m: "cash", icon: Banknote, allowed: !!settings?.payments.allowCash, sub: "Notes and coins at the counter" },
    { m: "online", icon: Globe, allowed: !!settings?.payments.allowOnline, sub: "Payment link / QR (simulated)" },
    { m: "bank_transfer", icon: Landmark, allowed: !!settings?.payments.allowBankTransfer, sub: "Direct deposit with bank reference" },
  ];

  useEffect(() => {
    if (!method && settings) setMethod(methods.find((x) => x.allowed)?.m ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const finish = (p: Payment) => {
    setJustPaid(p);
    onPaid?.(p);
  };

  const pay = async (m: PaymentMethod) => {
    setBusy(true);
    try {
      const p = m === "cash" ? await paymentService.payCash(app.id, tenderedNum)
        : m === "online" ? await paymentService.payOnline(app.id, { bankName: "RTA Online Gateway (simulated)" })
          : await paymentService.payBankTransfer(app.id, { bankName: bank, bankReference: bankRef, transferDate });
      toast.success("Payment successful", { description: `${formatMoney(p.amount)} · receipt ${p.receiptNumber}` });
      setConfirm(null);
      finish(p);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (paid) return <PaidBlock payment={paid} applicationId={app.id} />;
  if (app.status !== "payment_required") {
    return <Alert tone="info" title="Payment not yet available">The assessment must be generated before payment can be collected.</Alert>;
  }
  if (!can("payment.process")) {
    return <Alert tone="info" title="Awaiting payment at the cashier">A cashier collects {formatMoney(due)} for {app.transactionNumber}. Switch to the Cashier role in Demo Tools to continue.</Alert>;
  }

  const lastFailed = detail.payments.find((p) => p.status !== "successful");

  return (
    <div className="flex flex-col gap-5">
      <div className="split">
        <div className="l">
          <Section title="Payment summary">
            <dl className="dl">
              <dt>Transaction Number</dt><dd className="mono">{app.transactionNumber}</dd>
              <dt>Applicant</dt><dd>{fullName(detail.owner)}</dd>
              <dt>Motorcycle</dt><dd>{motorcycleLabel(detail.motorcycle)} · <span className="mono">{detail.motorcycle?.vin}</span></dd>
              <dt>Registration Type</dt><dd>{app.type === "renewal" ? "Renewal" : "New registration"}{detail.motorcycle?.sidecar ? " · with sidecar" : ""}</dd>
            </dl>
            {lastFailed && <Alert tone="warn" title={`Previous attempt ${lastFailed.status}`}>{lastFailed.reference} · {lastFailed.failureReason}</Alert>}
          </Section>
        </div>
        <div className="r">
          <div className="card flex flex-col items-center justify-center gap-1 !border-[#0b0b0f] !bg-[#0b0b0f] p-6 text-center text-white">
            <p className="eb !text-[#c4c7d0]">Total due</p>
            <p className="num m-0 text-[44px] font-extrabold tracking-[-.02em] text-[#ffd21a]">{formatMoney(due)}</p>
            <p className="m-0 text-[12.5px] text-[#c4c7d0]">{app.assessment?.lines.map((l) => `${l.name} ${formatMoney(l.amount)}`).join(" + ")}</p>
          </div>
        </div>
      </div>

      {!isOnline && <Alert tone="bad" title="Payments require an active connection.">Drafts still save locally. Set Network to Online in Demo Tools to continue.</Alert>}

      <Section title="Payment method">
        <div className="g4" role="radiogroup" aria-label="Payment method">
          {methods.map(({ m, icon: Icon, allowed, sub }) => (
            <button key={m} type="button" role="radio" aria-checked={method === m} disabled={!allowed} onClick={() => setMethod(m)} className={`opt flex-col !items-start disabled:cursor-not-allowed disabled:opacity-50 ${method === m ? "opt-on" : ""}`}>
              <Icon size={22} className={method === m ? "text-[#1515e8]" : "text-[#474d59]"} aria-hidden="true" />
              <span className="text-[15px]">{PAYMENT_METHOD_LABELS[m]}</span>
              <span className="mut text-[12px] font-medium">{allowed ? sub : "Disabled in Settings"}</span>
            </button>
          ))}
        </div>
      </Section>

      {method === "pos" && (
        <div className="flex flex-col gap-5">
          {!large && <PosStatusCard onManual={() => setMethod("cash")} compact />}
          <PosPaymentFlow applicationId={app.id} amount={due} description={`${app.transactionNumber} motorcycle ${app.type}`} onPaid={finish} onChangeMethod={() => setMethod("cash")} large={large} />
        </div>
      )}

      {method === "cash" && (
        <Section title="Cash payment">
          <div className="form">
            <Field label="Amount Due" htmlFor="due"><Input id="due" value={formatMoney(due)} readOnly className="!text-[18px] !font-bold" /></Field>
            <Field label="Amount Tendered (PGK)" required htmlFor="tend" error={tendered && tenderedNum < due ? `Must be at least ${formatMoney(due)}` : undefined}>
              <Input id="tend" type="number" inputMode="decimal" min={due} step="0.01" value={tendered} onChange={(e) => setTendered(e.target.value)} invalid={!!tendered && tenderedNum < due} className="!text-[18px] !font-bold" autoFocus />
            </Field>
            <Field label="Change" htmlFor="chg"><Input id="chg" readOnly value={tendered && change >= 0 ? formatMoney(change) : "—"} className="!text-[18px] !font-bold !text-[#0d6630]" /></Field>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Quick amounts">
            {[due, Math.ceil(due / 50) * 50, Math.ceil(due / 100) * 100, Math.ceil(due / 100) * 100 + 100].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
              <button key={v} type="button" className="btn btn-s" onClick={() => setTendered(String(v))}>{formatMoney(v)}</button>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn btn-ok btn-lg" disabled={!isOnline || !tendered || tenderedNum < due} onClick={() => setConfirm("cash")}><Banknote size={18} aria-hidden="true" />Confirm Cash Payment</button>
          </div>
        </Section>
      )}

      {method === "online" && (
        <Section title="Online payment (simulated)">
          {!onlineLink ? (
            <div className="flex flex-col items-start gap-3">
              <p className="m-0 text-[14px]">Generate a payment link the applicant pays on their phone. No real payment gateway is used in Phase 1.</p>
              <button type="button" className="btn btn-p" disabled={!isOnline} onClick={() => setOnlineLink(true)}>Generate payment link</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <QrCode path={`/verify/registration/${app.verificationToken}?pay=${app.transactionNumber}`} size={132} label="Simulated online payment QR" />
              <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                <p className="mono m-0 break-all text-[13px]">https://pay.rta.gov.pg/demo/{app.transactionNumber}</p>
                <p className="mut m-0 text-[13px]">Waiting for the applicant to pay {formatMoney(due)}…</p>
                <div><button type="button" className="btn btn-ok" disabled={!isOnline} onClick={() => setConfirm("online")}>Simulate customer payment</button></div>
              </div>
            </div>
          )}
        </Section>
      )}

      {method === "bank_transfer" && (
        <Section title="Bank transfer">
          <div className="form">
            <Field label="Bank" required htmlFor="bk"><Select id="bk" value={bank} onChange={(e) => setBank(e.target.value)} options={BANKS} /></Field>
            <Field label="Bank Reference" required htmlFor="br" help="Must be unique — reused references are blocked."><Input id="br" mono value={bankRef} onChange={(e) => setBankRef(e.target.value)} /></Field>
            <Field label="Transfer Date" required htmlFor="td"><Input id="td" type="date" value={transferDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setTransferDate(e.target.value)} /></Field>
          </div>
          <div className="flex justify-end"><button type="button" className="btn btn-ok btn-lg" disabled={!isOnline || bankRef.trim().length < 4} onClick={() => setConfirm("bank_transfer")}>Confirm Bank Transfer</button></div>
        </Section>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        busy={busy}
        tone="success"
        title={`Confirm ${confirm ? PAYMENT_METHOD_LABELS[confirm] : ""} payment`}
        confirmLabel="Confirm Payment"
        message={
          <div className="flex flex-col gap-2">
            <p className="m-0">Record a payment of <strong>{formatMoney(due)}</strong> for <span className="mono">{app.transactionNumber}</span>?</p>
            {confirm === "cash" && <p className="m-0">Tendered {formatMoney(tenderedNum)} · change <strong>{formatMoney(change)}</strong></p>}
            {confirm === "bank_transfer" && <p className="m-0">{bank} · reference <span className="mono">{bankRef}</span></p>}
            <p className="help m-0">A receipt number is issued and the application goes to supervisor approval.</p>
          </div>
        }
        onConfirm={() => { if (confirm) return pay(confirm); }}
      />
      <p className="help m-0 flex items-center gap-1.5"><Printer size={14} aria-hidden="true" />Receipts can be printed as 58 mm thermal or A4 after payment.</p>
    </div>
  );
}
