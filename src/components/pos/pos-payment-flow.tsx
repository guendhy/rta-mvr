"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Ban, Check, CreditCard, Nfc, RefreshCw, X } from "lucide-react";
import { paymentService } from "@/services/payment.service";
import { useServiceQuery } from "@/hooks/use-service";
import type { PosTerminalController } from "@/hooks/use-pos-terminal";
import { friendlyError } from "@/lib/errors";
import { formatDateLong, formatMoney, formatTime } from "@/lib/formatting";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { POS_STATE_TONE, WithPosTerminal } from "./with-pos-terminal";
import type { Payment, PosFlowStage } from "@/types";

type Stage = PosFlowStage | "cancelled";

const ORDER: Stage[] = ["idle", "connecting", "connected", "sending", "present_card", "processing", "approved"];
const RESULT_STAGES: Stage[] = ["declined", "unknown", "connection_lost", "cancelled"];
const BUSY_STAGES: Stage[] = ["connecting", "connected", "sending", "present_card", "processing"];

function stageIndex(s: Stage) {
  if (RESULT_STAGES.includes(s)) return ORDER.indexOf("approved");
  return ORDER.indexOf(s);
}

const STAGE_TEXT: Record<Stage, string> = {
  idle: "Ready for payment",
  connecting: "Checking terminal",
  connected: "Terminal connected",
  sending: "Sending amount to the terminal",
  present_card: "Present, insert or tap card",
  processing: "Processing payment",
  approved: "Payment successful",
  declined: "Payment failed — declined",
  connection_lost: "Connection lost — payment status unknown",
  unknown: "Payment status unknown",
  cancelled: "Payment cancelled",
};

interface Props {
  applicationId: string;
  amount: number;
  description: string;
  onPaid: (p: Payment) => void;
  onChangeMethod: () => void;
  large?: boolean;
  /** Shared controller from the parent screen; the flow creates its own when omitted. */
  terminal?: PosTerminalController;
}

/**
 * Terminal card payment: Check → Connect → Send Amount → Present Card → Processing →
 * Successful / Failed / Cancelled / Unknown. Retries after an unknown result are only allowed
 * once a status check confirms the card was not charged.
 */
export function PosPaymentFlow(props: Props) {
  if (props.terminal) return <Flow {...props} terminal={props.terminal} />;
  return <WithPosTerminal>{(t) => <Flow {...props} terminal={t} />}</WithPosTerminal>;
}

function Flow({ applicationId, amount, description, onPaid, onChangeMethod, large, terminal }: Props & { terminal: PosTerminalController }) {
  const { data: attempts } = useServiceQuery(() => paymentService.listForApplication(applicationId), [applicationId]);
  const [stage, setStage] = useState<Stage>("idle");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedNotCharged, setCheckedNotCharged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const cancelRequested = useRef(false);
  const headingRef = useRef<HTMLParagraphElement>(null);

  // Resume an unresolved attempt (e.g. page refreshed mid-payment) — must be status-checked first.
  useEffect(() => {
    if (running.current || payment) return;
    const unresolved = attempts?.find((p) => p.method === "pos" && (p.status === "unknown" || p.status === "processing"));
    if (unresolved) {
      setPayment(unresolved);
      setStage("unknown");
    }
  }, [attempts, payment]);

  // Move focus to the outcome heading so screen-reader and keyboard users land on the result.
  useEffect(() => {
    if (["approved", ...RESULT_STAGES].includes(stage)) headingRef.current?.focus();
  }, [stage, payment?.status]);

  const start = async () => {
    if (running.current) return;
    running.current = true;
    cancelRequested.current = false;
    setError(null);
    setCheckedNotCharged(false);
    try {
      setStage("connecting");
      const conn = await terminal.ensureConnected();
      if (!conn.ok) throw new Error(conn.message || "Terminal not detected.");
      setStage("connected");
      if (cancelRequested.current) {
        setStage("cancelled");
        return;
      }
      const attempt = await paymentService.createPosAttempt(applicationId);
      setPayment(attempt);
      if (cancelRequested.current) {
        const c = await paymentService.cancelPosAttempt(attempt.id);
        setPayment(c);
        setStage("cancelled");
        return;
      }
      const result = await terminal.charge({ reference: attempt.reference, amount, currency: "PGK", description }, setStage);
      const final = await paymentService.completePosAttempt(attempt.id, result);
      setPayment(final);
      if (final.status === "successful") {
        setStage("approved");
        toast.success("Payment Successful", { description: `${formatMoney(final.amount)} · ${final.receiptNumber}` });
        onPaid(final);
      } else if (final.status === "declined") {
        setStage("declined");
      } else {
        setStage(result.outcome === "disconnected" ? "connection_lost" : "unknown");
      }
    } catch (e) {
      const msg = e instanceof Error && !("code" in e) ? e.message : friendlyError(e);
      setError(msg);
      setStage("idle");
    } finally {
      running.current = false;
    }
  };

  const cancel = () => {
    if (running.current) {
      cancelRequested.current = true;
      toast.message("Cancelling — the amount will not be sent to the terminal.");
    } else {
      setStage("cancelled");
    }
  };

  const checkStatus = async () => {
    if (!payment) return;
    setChecking(true);
    setError(null);
    try {
      const p = await paymentService.checkPosStatus(payment.id);
      setPayment(p);
      if (p.status === "successful") {
        setStage("approved");
        toast.success("Status check: payment was approved", { description: "The card was charged — no retry needed." });
        onPaid(p);
      } else {
        setCheckedNotCharged(true);
        toast.message("Status check: the card was not charged", { description: "You can safely retry the payment." });
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setChecking(false);
    }
  };

  const idx = stageIndex(stage);
  const isBusy = BUSY_STAGES.includes(stage);
  const cancellable = isBusy && (stage === "connecting" || stage === "connected");
  const unknown = stage === "unknown" || stage === "connection_lost";
  const amountCls = large ? "text-[56px]" : "text-[48px] sm:text-[64px]";
  const model = terminal.terminal ? `${terminal.terminal.manufacturer} ${terminal.terminal.model}` : "Payment terminal";
  const steps: { key: Stage; label: string; sub: string }[] = [
    { key: "connecting", label: "Checking Terminal", sub: "Payment terminal adapter" },
    { key: "connected", label: "Terminal Connected", sub: `${model} · ${terminal.terminalId ?? "—"}` },
    { key: "sending", label: "Sending Amount", sub: formatMoney(amount) },
    { key: "present_card", label: "Present Card", sub: "Insert, tap or swipe on the terminal" },
    { key: "processing", label: "Processing", sub: "Waiting for the acquirer" },
    { key: "approved", label: "Result", sub: "Successful / failed / cancelled" },
  ];
  const resultLabel = stage === "approved" ? "Payment Successful" : stage === "declined" ? "Payment Failed" : stage === "cancelled" ? "Payment Cancelled" : stage === "connection_lost" ? "Connection Lost" : "Payment Status Unknown";

  return (
    <div className="split">
      <p className="sr" role="status" aria-live="polite">{STAGE_TEXT[stage]}{payment && stage !== "idle" ? ` · reference ${payment.reference}` : ""}</p>
      {!large && (
        <div className="r" style={{ flex: "1 1 260px" }}>
          <div className="card sec gap-1">
            <ol className="m-0 flex list-none flex-col p-0" aria-label="Payment progress">
              {steps.map((s, i) => {
                const n = i + 1;
                const done = idx > n || (idx === n && stage === "approved" && n === 6);
                const active = idx === n && !done;
                const failed = n === 6 && RESULT_STAGES.includes(stage);
                return (
                  <li key={s.key} className="flex items-start gap-3.5 py-2.5" aria-current={active ? "step" : undefined}>
                    <span className={`grid h-8 w-8 flex-none place-items-center rounded-full border-2 text-[13px] font-bold ${failed ? "border-[#c4141b] bg-[#c4141b] text-white" : done ? "border-[#137a3b] bg-[#137a3b] text-white" : active ? "border-[#1515e8] bg-[#1515e8] text-white" : "border-[#c9ced8] bg-white text-[#5a606c]"}`}>
                      {failed ? <X size={14} aria-hidden="true" /> : done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : active && stage !== "idle" ? <span className="spin h-3.5 w-3.5" aria-hidden="true" /> : n}
                    </span>
                    <div>
                      <p className={`m-0 text-[14px] ${active ? "font-bold text-[#1515e8]" : "font-semibold"}`}>
                        {n === 6 && idx === 6 ? resultLabel : s.label}
                        <span className="sr">{failed ? " — not completed" : done ? " — done" : active ? " — in progress" : ""}</span>
                      </p>
                      <p className="mut m-0 mt-0.5 text-[12.5px]">{s.sub}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
      <div className="l">
        <div className="card flex min-h-[420px] flex-col overflow-hidden">
          {error && (
            <div className="p-4">
              <Alert tone="bad" title="Payment could not be started" action={<button type="button" className="btn btn-s btn-sm" onClick={onChangeMethod}>Use Manual Payment</button>}>
                {error} No money was taken.
              </Alert>
            </div>
          )}
          {stage === "idle" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <Badge tone={POS_STATE_TONE[terminal.state]}>{terminal.label}</Badge>
              <p className="eb">Amount to charge</p>
              <p className={`num m-0 font-extrabold tracking-[-.03em] ${amountCls}`}>{formatMoney(amount)}</p>
              <p className="mut m-0 max-w-[420px] text-[14px]">The amount is sent to the terminal — the officer never types it on the device.</p>
              {!terminal.canCharge && (
                <Alert tone="warn" title={terminal.enabled ? "The terminal cannot take a payment right now" : "POS terminal payments are switched off"}>
                  {terminal.enabled ? "Check the network connection and the terminal, or use another payment method." : "Use another payment method."}
                </Alert>
              )}
              <button type="button" className="btn btn-k btn-xl w-full max-w-[340px]" disabled={!terminal.canCharge} onClick={start}><CreditCard size={20} aria-hidden="true" />Send to terminal</button>
              <p className="help m-0">Next simulated result: <strong>{terminal.nextResult ?? "approved"}</strong> (change in Demo Tools)</p>
            </div>
          )}
          {isBusy && (
            <div className={`flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center ${stage === "present_card" ? "bg-[#1515e8] text-white" : "bg-[#f7f7ff]"}`}>
              {stage === "present_card" ? (
                <div className="pulse grid h-[150px] w-[150px] place-items-center rounded-full border-4 border-white/50"><Nfc size={72} strokeWidth={1.6} aria-hidden="true" /></div>
              ) : (
                <span className="spin" style={{ width: 56, height: 56, borderWidth: 5, color: "#1515e8" }} aria-hidden="true" />
              )}
              <p className="m-0 text-[24px] font-extrabold sm:text-[28px]">{STAGE_TEXT[stage]}{stage === "processing" ? "…" : ""}</p>
              <p className={`num m-0 text-[36px] font-extrabold ${stage === "present_card" ? "text-[#ffd21a]" : ""}`}>{formatMoney(amount)}</p>
              <p className={`m-0 text-[14px] ${stage === "present_card" ? "opacity-85" : "mut"}`}>{stage === "present_card" ? "Do not remove the card until approved" : `Reference ${payment?.reference ?? "reserved when the amount is sent"}`}</p>
              {cancellable && <button type="button" className="btn btn-s" onClick={cancel}><Ban size={16} aria-hidden="true" />Cancel</button>}
            </div>
          )}
          {stage === "approved" && payment?.status === "successful" && (
            <>
              <div className="flex items-center gap-4 border-b border-[#bfe6cd] bg-[#e9f7ef] p-6 sm:p-7">
                <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-[#137a3b]"><Check size={28} strokeWidth={2.8} className="text-white" aria-hidden="true" /></span>
                <div><p ref={headingRef} tabIndex={-1} className="m-0 text-[24px] font-extrabold text-[#0b4f25] outline-none sm:text-[26px]">Payment Successful</p><p className="m-0 mt-0.5 text-[14px] text-[#155c30]">{formatMoney(payment.amount)} charged to card {payment.cardMasked}</p></div>
              </div>
              <dl className="dl px-6 py-6 sm:px-7" style={{ fontSize: 14.5 }}>
                <dt>Payment reference</dt><dd className="mono">{payment.reference}</dd>
                <dt>Approval code</dt><dd className="mono">{payment.approvalCode}</dd>
                <dt>Amount</dt><dd>{formatMoney(payment.amount)}</dd>
                <dt>Terminal ID</dt><dd className="mono">{payment.terminalId}</dd>
                <dt>Date</dt><dd>{formatDateLong(payment.completedAt)}</dd>
                <dt>Time</dt><dd className="mono">{formatTime(payment.completedAt)}</dd>
                <dt>Receipt</dt><dd className="mono">{payment.receiptNumber}</dd>
              </dl>
            </>
          )}
          {stage === "declined" && payment && (
            <>
              <div className="flex items-center gap-4 border-b border-[#f4c3c5] bg-[#fdecec] p-6 sm:p-7">
                <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-[#c4141b]"><X size={26} strokeWidth={2.8} className="text-white" aria-hidden="true" /></span>
                <div><p ref={headingRef} tabIndex={-1} className="m-0 text-[24px] font-extrabold text-[#7a0c13] outline-none">Payment Failed</p><p className="m-0 mt-0.5 text-[14px] text-[#8c1018]">Declined · reason: <strong>{payment.failureReason}</strong></p></div>
              </div>
              <div className="flex flex-col gap-4 p-6">
                <p className="m-0 text-[14.5px]">The bank declined the card. No money was taken. Ask the applicant for another card or change the payment method.</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <button type="button" className="btn btn-p btn-lg" disabled={!terminal.canCharge} onClick={start}><RefreshCw size={16} aria-hidden="true" />Retry Payment</button>
                  <button type="button" className="btn btn-s btn-lg" onClick={onChangeMethod}>Change Method</button>
                  <button type="button" className="btn btn-s btn-lg" onClick={cancel}>Cancel</button>
                </div>
                <p className="help m-0">Attempt {payment.attempt} · reference {payment.reference}. A retry creates a new reference under the same idempotency key.</p>
              </div>
            </>
          )}
          {stage === "cancelled" && (
            <>
              <div className="flex items-center gap-4 border-b border-[#e1e4ea] bg-[#f4f5f8] p-6 sm:p-7">
                <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-[#474d59]"><Ban size={26} className="text-white" aria-hidden="true" /></span>
                <div><p ref={headingRef} tabIndex={-1} className="m-0 text-[24px] font-extrabold outline-none">Payment Cancelled</p><p className="mut m-0 mt-0.5 text-[14px]">No amount was charged.{payment ? ` Reference ${payment.reference}.` : ""}</p></div>
              </div>
              <div className="grid grid-cols-1 gap-2.5 p-6 sm:grid-cols-2">
                <button type="button" className="btn btn-p btn-lg" disabled={!terminal.canCharge} onClick={start}><RefreshCw size={16} aria-hidden="true" />Retry Payment</button>
                <button type="button" className="btn btn-s btn-lg" onClick={onChangeMethod}>Change Method</button>
              </div>
            </>
          )}
          {unknown && payment && (
            <>
              <div className="flex items-center gap-4 border-b border-[#f2de85] bg-[#fff8d6] p-6 sm:p-7">
                <span className="grid h-14 w-14 flex-none place-items-center rounded-full bg-[#c25a00] text-[26px] font-extrabold text-white" aria-hidden="true">?</span>
                <div>
                  <p ref={headingRef} tabIndex={-1} className="m-0 text-[24px] font-extrabold text-[#4d3900] outline-none">{stage === "connection_lost" ? "Connection Lost" : "Payment Status Unknown"}</p>
                  <p className="m-0 mt-0.5 text-[14px] text-[#5e4600]">{payment.failureReason ?? "The terminal did not return a final result."}</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 p-6">
                <p className="m-0 text-[14.5px] leading-relaxed">The card <strong>may or may not</strong> have been charged. To prevent double charging, check the payment status with the terminal host before retrying. Payments are never retried automatically.</p>
                {checkedNotCharged && <Alert tone="ok" title="Status confirmed: the card was not charged">Payment {payment.reference} has been closed as failed. You can retry safely.</Alert>}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <button type="button" className="btn btn-p btn-lg" disabled={checking || checkedNotCharged} onClick={checkStatus}>{checking ? <span className="spin" aria-hidden="true" /> : null}Check Payment Status</button>
                  <button type="button" className="btn btn-s btn-lg" disabled={!checkedNotCharged || !terminal.canCharge} onClick={start}>Retry Payment</button>
                  <button type="button" className="btn btn-s btn-lg" disabled={!checkedNotCharged} onClick={onChangeMethod}>Change Method</button>
                </div>
                {!checkedNotCharged && <p className="help m-0">Retry and Change Method unlock after the status check confirms the card was not charged.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
