"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { useNetworkSimulation } from "@/hooks/use-network-simulation";
import { posService } from "@/services/pos.service";
import { formatMoney, formatTime, fullName, motorcycleLabel } from "@/lib/formatting";
import { ReceiptButtons } from "@/components/payments/receipt-buttons";
import { PaymentCollector } from "@/components/payments/payment-collector";
import { Alert } from "@/components/ui/feedback";
import { PosPaymentFlow } from "./pos-payment-flow";
import type { RegistrationDetail } from "@/services/interfaces";
import type { Payment } from "@/types";

/**
 * Android Smart POS layout (Wiseasy P5, 720×1280 / 1280×720): large amount, large buttons,
 * minimal scrolling, quick print.
 */
export function PosModeScreen({ detail }: { detail: RegistrationDetail }) {
  const router = useRouter();
  const { isOnline } = useNetworkSimulation();
  const { data: sim } = useServiceQuery(() => posService.getSimulator(), []);
  const app = detail.application;
  const existing = detail.payments.find((p) => p.status === "successful") ?? null;
  const [mode, setMode] = useState<"ready" | "card" | "cash">("ready");
  const [paid, setPaid] = useState<Payment | null>(existing);
  const due = app.assessment?.total ?? 0;

  if (paid) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
        <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-[#e9f7ef] p-6 text-center">
          <span className="grid h-[88px] w-[88px] place-items-center rounded-full bg-[#137a3b]"><Check size={48} strokeWidth={3} className="text-white" aria-hidden="true" /></span>
          <p className="m-0 text-[30px] font-extrabold text-[#0b4f25]">{existing && !paid.completedAt ? "PAID" : "APPROVED"}</p>
          <p className="num m-0 text-[34px] font-extrabold">{formatMoney(paid.amount)}</p>
          <p className="mono m-0 text-[13px] text-[#155c30]">{paid.approvalCode ? `Approval ${paid.approvalCode} · ` : ""}{formatTime(paid.completedAt)}</p>
          <p className="mono m-0 text-[12px] text-[#155c30]">{paid.receiptNumber}</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5"><ReceiptButtons paymentId={paid.id} applicationId={app.id} size="lg" /></div>
        <button type="button" className="btn btn-s btn-xl w-full" onClick={() => router.push("/payments")}>Done</button>
      </div>
    );
  }

  if (mode === "card") {
    return (
      <div className="flex flex-col gap-3">
        <PosPaymentFlow applicationId={app.id} amount={due} description={app.transactionNumber} large onPaid={setPaid} onChangeMethod={() => setMode("ready")} />
        <button type="button" className="btn btn-s btn-lg" onClick={() => setMode("ready")}>Back</button>
      </div>
    );
  }
  if (mode === "cash") {
    return (
      <div className="flex flex-col gap-3">
        <PaymentCollector detail={detail} large initialMethod="cash" onPaid={setPaid} />
        <button type="button" className="btn btn-s btn-lg" onClick={() => setMode("ready")}>Back</button>
      </div>
    );
  }

  const connected = sim?.terminalStatus === "connected" || sim?.terminalStatus === "printer_error";
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-[10px] bg-white p-3.5">
        <p className="m-0 text-[16px] font-bold">{fullName(detail.owner)}</p>
        <p className="m-0 text-[14px] text-[#3a3f4a]">{motorcycleLabel(detail.motorcycle)} · {app.type === "renewal" ? "Renewal" : "New registration"}</p>
        <p className="mono m-0 text-[12px] text-[#5a606c]">{app.transactionNumber}</p>
      </div>
      <div className="flex flex-col items-center justify-center gap-1 py-6">
        <p className="eb">Amount due</p>
        <p className="num m-0 text-[56px] font-extrabold tracking-[-.03em]">{formatMoney(due)}</p>
        <p className="m-0 text-[14px] font-semibold" style={{ color: connected ? "#0d6630" : "#a3111a" }}>● Terminal {connected ? "connected" : sim?.terminalStatus ?? "…"}</p>
      </div>
      {!isOnline && <Alert tone="bad" title="Payments require an active connection." />}
      {app.status !== "payment_required" && <Alert tone="warn" title="Not ready for payment">This application is {app.status.replace(/_/g, " ")}.</Alert>}
      <button type="button" className="btn btn-k w-full !min-h-[72px] !rounded-xl !text-[20px] !font-extrabold" disabled={!isOnline || app.status !== "payment_required"} onClick={() => setMode("card")}>PAY WITH CARD</button>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="btn btn-s !min-h-[60px] !text-[16px]" disabled={!isOnline || app.status !== "payment_required"} onClick={() => setMode("cash")}>Cash</button>
        <button type="button" className="btn btn-s !min-h-[60px] !text-[16px]" onClick={() => router.push("/payments")}>Cancel</button>
      </div>
    </div>
  );
}
