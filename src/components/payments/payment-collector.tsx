"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Banknote, CheckCircle2, CreditCard, Globe, Landmark, Printer, QrCode as QrIcon, RefreshCw, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";
import { paymentService } from "@/services/payment.service";
import { settingsService } from "@/services/settings.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useNetworkSimulation } from "@/hooks/use-network-simulation";
import { usePosTerminal } from "@/hooks/use-pos-terminal";
import { useServiceQuery } from "@/hooks/use-service";
import { enabledPaymentChannels, PAYMENT_METHOD_LABELS, type PaymentChannelDef } from "@/config/payment-channels";
import { transactionLabel } from "@/config/transaction-types";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/formatting";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { QrCode } from "@/components/ui/qr-code";
import { Section } from "@/components/ui/layout-bits";
import { Badge } from "@/components/ui/status-badge";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import { TransactionSummary } from "@/components/registrations/transaction-summary";
import { PosStatusCard } from "@/components/pos/pos-status-card";
import { PosPaymentFlow } from "@/components/pos/pos-payment-flow";
import { POS_STATE_TONE } from "@/components/pos/with-pos-terminal";
import { ReceiptButtons } from "./receipt-buttons";
import type { RegistrationDetail } from "@/services/interfaces";
import type { Payment, PaymentMethod } from "@/types";

const BANKS = ["BSP", "Kina Bank", "Westpac PNG", "ANZ PNG", "TISA Bank"];

const ICONS: Record<PaymentMethod, LucideIcon> = {
  pos: Smartphone,
  card: CreditCard,
  qr: QrIcon,
  cash: Banknote,
  online: Globe,
  bank_transfer: Landmark,
};

type ManualState = { kind: "idle" } | { kind: "processing"; method: PaymentMethod } | { kind: "failed"; method: PaymentMethod; message: string } | { kind: "cancelled"; method: PaymentMethod };

/** Successful payment — shown right after collection and whenever the transaction is already paid. */
export function PaidBlock({ payment, applicationId, justPaid }: { payment: Payment; applicationId: string; justPaid?: boolean }) {
  const headingRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (justPaid) headingRef.current?.focus();
  }, [justPaid]);
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 border-b border-[#bfe6cd] bg-[#e9f7ef] p-6">
        <CheckCircle2 size={40} className="flex-none text-[#137a3b]" aria-hidden="true" />
        <div>
          <p ref={headingRef} tabIndex={-1} className="m-0 text-[22px] font-extrabold text-[#0b4f25] outline-none">{justPaid ? "Payment Successful" : "This transaction has already been paid."}</p>
          <p className="m-0 mt-0.5 text-[14px] text-[#155c30]">{formatMoney(payment.amount)} · {PAYMENT_METHOD_LABELS[payment.method]} · {formatDateTime(payment.completedAt)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-6">
        <dl className="dl">
          <dt>Receipt number</dt><dd className="mono">{payment.receiptNumber}</dd>
          <dt>Payment reference</dt><dd className="mono">{payment.reference}</dd>
          {payment.terminalId && <><dt>Terminal</dt><dd className="mono">{payment.terminalId}</dd></>}
          {payment.approvalCode && <><dt>Approval code</dt><dd className="mono">{payment.approvalCode}</dd></>}
          {payment.bankReference && <><dt>{payment.method === "qr" ? "QR reference" : payment.method === "card" ? "Authorisation reference" : "Bank reference"}</dt><dd className="mono">{payment.bankName ? `${payment.bankName} · ` : ""}{payment.bankReference}</dd></>}
          {payment.change !== undefined && <><dt>Tendered / change</dt><dd>{formatMoney(payment.amountTendered)} / {formatMoney(payment.change)}</dd></>}
          <dt>Cashier</dt><dd>{payment.cashierName}</dd>
        </dl>
        {justPaid && <Alert tone="ok" title="Registration transaction updated automatically">Pending Payment → Pending Approval · the payment is linked to the transaction and the supervisor is notified.</Alert>}
        <p className="help m-0">Additional payments are disabled — duplicate charge protection is active for this transaction.</p>
        <div className="row">
          <ReceiptButtons paymentId={payment.id} applicationId={applicationId} />
          <Link href={`/payments/${payment.id}`} className="btn btn-g">Payment details</Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Payment selection + collection for one transaction. Channels come from
 * `enabledPaymentChannels(settings)`; the POS channel goes through `usePosTerminal()` and
 * every other channel keeps working when no terminal is available.
 */
export function PaymentCollector({ detail, onPaid, large, initialMethod }: { detail: RegistrationDetail; onPaid?: (p: Payment) => void; large?: boolean; initialMethod?: PaymentMethod }) {
  const { can } = useDemoUser();
  const { isOnline } = useNetworkSimulation();
  const app = detail.application;
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const channels = useMemo(() => (settings ? enabledPaymentChannels(settings) : []), [settings]);
  const posEnabled = channels.some((c) => c.method === "pos");
  const terminal = usePosTerminal({ autoDetect: posEnabled && app.status === "payment_required" });
  const [method, setMethod] = useState<PaymentMethod | null>(initialMethod ?? null);
  const [tendered, setTendered] = useState("");
  const [bank, setBank] = useState(BANKS[0]);
  const [bankRef, setBankRef] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [elecRef, setElecRef] = useState("");
  const [provider, setProvider] = useState("");
  const [onlineLink, setOnlineLink] = useState(false);
  const [confirm, setConfirm] = useState<PaymentMethod | null>(null);
  const [manual, setManual] = useState<ManualState>({ kind: "idle" });
  const [justPaid, setJustPaid] = useState<Payment | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const paid = justPaid ?? detail.payments.find((p) => p.status === "successful") ?? null;
  const due = app.assessment?.total ?? 0;
  const tenderedNum = Number(tendered || 0);
  const change = tenderedNum - due;
  const busy = manual.kind === "processing";
  const manualChannels = channels.filter((c) => c.method !== "pos");

  useEffect(() => {
    if (!settings || (method && channels.some((c) => c.method === method))) return;
    setMethod(channels[0]?.method ?? null);
  }, [settings, channels, method]);

  /** Switching method clears a previous failure / cancellation message. */
  const choose = (m: PaymentMethod | null) => {
    setMethod(m);
    setManual({ kind: "idle" });
  };

  const finish = (p: Payment) => {
    setJustPaid(p);
    onPaid?.(p);
  };

  const pay = async (m: PaymentMethod) => {
    setManual({ kind: "processing", method: m });
    setConfirm(null);
    try {
      const p = m === "cash" ? await paymentService.payCash(app.id, tenderedNum)
        : m === "card" || m === "qr" ? await paymentService.payElectronic(app.id, { method: m, reference: elecRef.trim(), provider: provider.trim() || undefined })
          : m === "online" ? await paymentService.payOnline(app.id, { bankName: "Online payment gateway (simulated)" })
            : await paymentService.payBankTransfer(app.id, { bankName: bank, bankReference: bankRef, transferDate });
      toast.success("Payment Successful", { description: `${formatMoney(p.amount)} · receipt ${p.receiptNumber}` });
      setManual({ kind: "idle" });
      finish(p);
    } catch (e) {
      const message = friendlyError(e);
      setManual({ kind: "failed", method: m, message });
      toast.error("Payment Failed", { description: message });
    }
  };

  const toManual = () => choose(manualChannels[0]?.method ?? null);

  if (paid) return <PaidBlock payment={paid} applicationId={app.id} justPaid={!!justPaid} />;

  if (app.assessment && app.assessment.total === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="ok" title="No amount due">No fees are payable for this {transactionLabel(app.type).toLowerCase()}. The transaction continues to approval without a payment.</Alert>
        {!large && <TransactionSummary detail={detail} showAmount={false} />}
        <Section title="Fee breakdown"><FeeBreakdown assessment={app.assessment} /></Section>
      </div>
    );
  }
  if (app.status !== "payment_required" || !app.assessment) {
    return <Alert tone="info" title="Payment not yet available">{app.assessment ? `This transaction is ${app.status.replace(/_/g, " ")} — payment can only be collected while it is Pending Payment.` : "The fee assessment must be generated before payment can be collected."}</Alert>;
  }
  if (!can("payment.process")) {
    return <Alert tone="info" title="Awaiting payment at the cashier">A cashier collects {formatMoney(due)} for {app.transactionNumber}. Switch to the Cashier role in Demo Tools to continue.</Alert>;
  }

  const attempts = detail.payments;
  const lastFailed = attempts.find((p) => p.status !== "successful");
  const enabledMethods = channels.map((c) => c.method);
  const onGroupKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir || !enabledMethods.length) return;
    e.preventDefault();
    const i = method ? enabledMethods.indexOf(method) : -1;
    const next = enabledMethods[(i + dir + enabledMethods.length) % enabledMethods.length];
    choose(next);
    requestAnimationFrame(() => groupRef.current?.querySelector<HTMLButtonElement>(`[data-method="${next}"]`)?.focus());
  };
  const channelSub = (c: PaymentChannelDef) => (c.method === "pos" ? terminal.label : c.description);

  const statusText = manual.kind === "processing" ? `Processing ${PAYMENT_METHOD_LABELS[manual.method]} payment…` : manual.kind === "failed" ? `Payment failed: ${manual.message}` : manual.kind === "cancelled" ? "Payment cancelled" : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="split">
        {!large && (
          <div className="l">
            <TransactionSummary detail={detail} showAmount={false} />
            <Section title="Fee breakdown" description={`${transactionLabel(app.type)} · rule set ${app.assessment.ruleSet}`}>
              <FeeBreakdown assessment={app.assessment} />
            </Section>
          </div>
        )}
        <div className="r">
          <div className="card flex flex-col items-center justify-center gap-1 !border-[#0b0b0f] !bg-[#0b0b0f] p-6 text-center text-white">
            <p className="eb !text-[#c4c7d0]">Total amount due</p>
            <p className="num m-0 text-[44px] font-extrabold tracking-[-.02em] text-[#ffd21a]">{formatMoney(due)}</p>
            <p className="mono m-0 text-[12.5px] text-[#c4c7d0]">{app.transactionNumber}</p>
          </div>
          <div className="card sec gap-3">
            <dl className="dl">
              <dt>Transaction ref.</dt><dd className="mono">{app.transactionNumber}</dd>
              <dt>Transaction type</dt><dd>{transactionLabel(app.type)}</dd>
              <dt>Attempts</dt><dd>{attempts.length ? `${attempts.length} (last ${attempts[0].reference})` : "None yet"}</dd>
            </dl>
            <p className="help m-0 flex items-start gap-1.5"><ShieldCheck size={14} className="mt-0.5 flex-none" aria-hidden="true" />Duplicate protection: one idempotency key per assessment — at most one successful charge, across retries and method changes.</p>
          </div>
          {lastFailed && <Alert tone="warn" title={`Previous attempt ${lastFailed.status}`}>{lastFailed.reference}{lastFailed.failureReason ? ` · ${lastFailed.failureReason}` : ""}</Alert>}
        </div>
      </div>

      {!isOnline && <Alert tone="bad" title="Payments require an active connection.">Drafts still save locally. Set Network to Online in Demo Tools to continue.</Alert>}
      {settings && !channels.length && <Alert tone="bad" title="No payment methods are enabled">An administrator must enable at least one channel in Administration → Settings → Payments.</Alert>}

      <Section title="Payment method" actions={can("settings.manage") ? <Link href="/administration/settings" className="btn btn-g btn-sm">Configure channels</Link> : undefined}>
        <div ref={groupRef} className="g3" role="radiogroup" aria-label="Payment method" onKeyDown={onGroupKey}>
          {channels.map((c) => {
            const Icon = ICONS[c.method];
            const on = method === c.method;
            return (
              <button key={c.method} type="button" role="radio" data-method={c.method} aria-checked={on} tabIndex={on || (!method && c === channels[0]) ? 0 : -1} disabled={busy} onClick={() => choose(c.method)} className={`opt flex-col !items-start ${on ? "opt-on" : ""}`}>
                <span className="flex w-full items-center justify-between gap-2">
                  <Icon size={22} className={on ? "text-[#1515e8]" : "text-[#474d59]"} aria-hidden="true" />
                  {c.method === "pos" && <Badge tone={POS_STATE_TONE[terminal.state]}>{terminal.state === "ready" ? "Ready" : terminal.state === "detecting" ? "Checking" : terminal.label}</Badge>}
                </span>
                <span className="text-[15px]">{c.label}</span>
                <span className="mut text-[12px] font-medium">{channelSub(c)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      <p className="sr" role="status" aria-live="polite">{statusText}</p>
      {manual.kind === "processing" && (
        <div className="card flex items-center gap-3 p-4" aria-hidden="true">
          <span className="spin text-[#1515e8]" /><span className="font-semibold">Processing {PAYMENT_METHOD_LABELS[manual.method]} payment…</span>
        </div>
      )}
      {manual.kind === "failed" && (
        <Alert tone="bad" title="Payment Failed" action={<button type="button" className="btn btn-p btn-sm" onClick={() => setConfirm(manual.method)}><RefreshCw size={14} aria-hidden="true" />Retry Payment</button>}>
          {manual.message} No payment was recorded.
        </Alert>
      )}
      {manual.kind === "cancelled" && <Alert tone="info" title="Payment cancelled">Nothing was recorded. Choose a method and try again when ready.</Alert>}

      {method === "pos" && (
        <div className="flex flex-col gap-5">
          {!large && <PosStatusCard terminal={terminal} onManual={manualChannels.length ? toManual : undefined} compact />}
          <PosPaymentFlow terminal={terminal} applicationId={app.id} amount={due} description={`${app.transactionNumber} · ${transactionLabel(app.type)}`} onPaid={finish} onChangeMethod={toManual} large={large} />
        </div>
      )}

      {method === "card" && (
        <Section title="Card payment (manual / virtual terminal)" description="For counters without a terminal. Card details are entered on the acquirer’s secure page or virtual terminal — never in this system.">
          <div className="form">
            <Field label="Acquirer / gateway" htmlFor="cp" help="Optional — as shown on the authorisation slip."><Input id="cp" value={provider} onChange={(e) => setProvider(e.target.value)} autoComplete="off" /></Field>
            <Field label="Authorisation reference" required htmlFor="cr" help="Approval or transaction reference from the gateway. Each reference can be used once."><Input id="cr" mono value={elecRef} onChange={(e) => setElecRef(e.target.value)} autoComplete="off" /></Field>
          </div>
          <div className="flex justify-end"><button type="button" className="btn btn-ok btn-lg" disabled={!isOnline || busy || elecRef.trim().length < 4} onClick={() => setConfirm("card")}><CreditCard size={18} aria-hidden="true" />Confirm Card Payment</button></div>
        </Section>
      )}

      {method === "qr" && (
        <Section title="QR payment" description="The applicant scans the code with a supported banking or wallet app, then the cashier records the confirmation reference.">
          <div className="flex flex-wrap items-start gap-5">
            <QrCode path={`/verify/registration/${app.verificationToken}?pay=${app.transactionNumber}`} size={132} label={`Payment QR for ${app.transactionNumber}`} />
            <div className="form min-w-[240px] flex-1">
              <Field label="Wallet / bank app" htmlFor="qp" help="Optional."><Input id="qp" value={provider} onChange={(e) => setProvider(e.target.value)} autoComplete="off" /></Field>
              <Field label="QR transaction reference" required htmlFor="qr" help={`Shown on the applicant’s confirmation for ${formatMoney(due)}.`}><Input id="qr" mono value={elecRef} onChange={(e) => setElecRef(e.target.value)} autoComplete="off" /></Field>
            </div>
          </div>
          <div className="flex justify-end"><button type="button" className="btn btn-ok btn-lg" disabled={!isOnline || busy || elecRef.trim().length < 4} onClick={() => setConfirm("qr")}><QrIcon size={18} aria-hidden="true" />Confirm QR Payment</button></div>
        </Section>
      )}

      {method === "cash" && (
        <Section title="Cash payment">
          <div className="form">
            <Field label="Amount Due" htmlFor="due"><Input id="due" value={formatMoney(due)} readOnly className="!text-[18px] !font-bold" /></Field>
            <Field label="Amount Tendered (PGK)" required htmlFor="tend" error={tendered && tenderedNum < due ? `Must be at least ${formatMoney(due)}` : undefined}>
              <Input id="tend" type="number" inputMode="decimal" min={due} step="0.01" value={tendered} onChange={(e) => setTendered(e.target.value)} invalid={!!tendered && tenderedNum < due} className="!text-[18px] !font-bold" />
            </Field>
            <Field label="Change" htmlFor="chg"><Input id="chg" readOnly value={tendered && change >= 0 ? formatMoney(change) : "—"} className="!text-[18px] !font-bold !text-[#0d6630]" /></Field>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
            {[due, Math.ceil(due / 50) * 50, Math.ceil(due / 100) * 100, Math.ceil(due / 100) * 100 + 100].filter((v, i, a) => a.indexOf(v) === i).map((v) => (
              <button key={v} type="button" className="btn btn-s" onClick={() => setTendered(String(v))}>{formatMoney(v)}</button>
            ))}
          </div>
          <div className="flex justify-end">
            <button type="button" className="btn btn-ok btn-lg" disabled={!isOnline || busy || !tendered || tenderedNum < due} onClick={() => setConfirm("cash")}><Banknote size={18} aria-hidden="true" />Confirm Cash Payment</button>
          </div>
        </Section>
      )}

      {method === "online" && (
        <Section title="Electronic payment (simulated)">
          {!onlineLink ? (
            <div className="flex flex-col items-start gap-3">
              <p className="m-0 text-[14px]">Generate a payment link the applicant pays through online banking or a payment gateway. No real gateway is connected in this prototype.</p>
              <button type="button" className="btn btn-p" disabled={!isOnline} onClick={() => setOnlineLink(true)}>Generate payment link</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-5">
              <QrCode path={`/verify/registration/${app.verificationToken}?pay=${app.transactionNumber}`} size={132} label="Simulated online payment link" />
              <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                <p className="mono m-0 break-all text-[13px]">https://pay.rta.gov.pg/demo/{app.transactionNumber}</p>
                <p className="mut m-0 text-[13px]">Waiting for the applicant to pay {formatMoney(due)}…</p>
                <div><button type="button" className="btn btn-ok" disabled={!isOnline || busy} onClick={() => setConfirm("online")}>Simulate customer payment</button></div>
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
          <div className="flex justify-end"><button type="button" className="btn btn-ok btn-lg" disabled={!isOnline || busy || bankRef.trim().length < 4} onClick={() => setConfirm("bank_transfer")}>Confirm Bank Transfer</button></div>
        </Section>
      )}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => {
          if (confirm) setManual({ kind: "cancelled", method: confirm });
          setConfirm(null);
        }}
        busy={busy}
        tone="success"
        title={`Confirm ${confirm ? PAYMENT_METHOD_LABELS[confirm] : ""} payment`}
        confirmLabel="Confirm Payment"
        message={
          <div className="flex flex-col gap-2">
            <p className="m-0">Record a payment of <strong>{formatMoney(due)}</strong> for <span className="mono">{app.transactionNumber}</span> ({transactionLabel(app.type)})?</p>
            {confirm === "cash" && <p className="m-0">Tendered {formatMoney(tenderedNum)} · change <strong>{formatMoney(change)}</strong></p>}
            {confirm === "bank_transfer" && <p className="m-0">{bank} · reference <span className="mono">{bankRef}</span></p>}
            {(confirm === "card" || confirm === "qr") && <p className="m-0">{provider ? `${provider} · ` : ""}reference <span className="mono">{elecRef}</span></p>}
            <p className="help m-0">A receipt number is issued and the transaction goes to supervisor approval.</p>
          </div>
        }
        onConfirm={() => { if (confirm) return pay(confirm); }}
      />
      <p className="help m-0 flex items-center gap-1.5"><Printer size={14} aria-hidden="true" />Receipts can be printed as 58 mm thermal or A4 after payment.</p>
    </div>
  );
}
