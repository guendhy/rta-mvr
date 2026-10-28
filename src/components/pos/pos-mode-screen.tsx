"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { useNetworkSimulation } from "@/hooks/use-network-simulation";
import { usePosTerminal } from "@/hooks/use-pos-terminal";
import { settingsService } from "@/services/settings.service";
import { enabledPaymentChannels } from "@/config/payment-channels";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { formatMoney, formatTime, fullName, vehicleLabel } from "@/lib/formatting";
import { ReceiptButtons } from "@/components/payments/receipt-buttons";
import { PaymentCollector } from "@/components/payments/payment-collector";
import { Alert } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { PosPaymentFlow } from "./pos-payment-flow";
import { POS_STATE_TONE } from "./with-pos-terminal";
import type { RegistrationDetail } from "@/services/interfaces";
import type { Payment, PaymentMethod } from "@/types";

/**
 * Smart POS layout (portrait / landscape terminal screens): large amount, large buttons,
 * minimal scrolling, quick print. Works with any terminal behind the POS adapter.
 */
export function PosModeScreen({ detail }: { detail: RegistrationDetail }) {
  const router = useRouter();
  const { isOnline } = useNetworkSimulation();
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const terminal = usePosTerminal({ autoDetect: true });
  const app = detail.application;
  const vehicle = detail.vehicle;
  const existing = detail.payments.find((p) => p.status === "successful") ?? null;
  const [mode, setMode] = useState<"ready" | "card" | "manual">("ready");
  const [manualMethod, setManualMethod] = useState<PaymentMethod | undefined>(undefined);
  const [justPaid, setPaid] = useState<Payment | null>(null);
  const paid = justPaid ?? existing;
  const due = app.assessment?.total ?? 0;
  const channels = useMemo(() => (settings ? enabledPaymentChannels(settings) : []), [settings]);
  const manualChannels = channels.filter((c) => c.method !== "pos");
  const posEnabled = channels.some((c) => c.method === "pos");
  const payable = isOnline && app.status === "payment_required";

  if (paid) {
    const already = !justPaid;
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
        <div className="flex flex-col items-center gap-2.5 rounded-2xl bg-[#e9f7ef] p-6 text-center" role="status">
          <span className="grid h-[88px] w-[88px] place-items-center rounded-full bg-[#137a3b]"><Check size={48} strokeWidth={3} className="text-white" aria-hidden="true" /></span>
          <p className="m-0 text-[28px] font-extrabold text-[#0b4f25]">{already ? "ALREADY PAID" : "PAYMENT SUCCESSFUL"}</p>
          {already && <p className="m-0 text-[14px] text-[#155c30]">This transaction has already been paid.</p>}
          <p className="num m-0 text-[34px] font-extrabold">{formatMoney(paid.amount)}</p>
          <p className="mono m-0 text-[13px] text-[#155c30]">{paid.approvalCode ? `Approval ${paid.approvalCode} · ` : ""}{formatTime(paid.completedAt)}</p>
          <p className="mono m-0 text-[12px] text-[#155c30]">{paid.receiptNumber}</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5"><ReceiptButtons paymentId={paid.id} applicationId={app.id} size="lg" /></div>
        <button type="button" className="btn btn-s btn-xl w-full" onClick={() => router.push("/payments")}>Done</button>
      </div>
    );
  }

  if (app.assessment && app.assessment.total === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
        <Alert tone="ok" title="No amount due">No fees are payable for {app.transactionNumber}. The transaction continues to approval without a payment.</Alert>
        <button type="button" className="btn btn-s btn-xl w-full" onClick={() => router.push("/payments")}>Done</button>
      </div>
    );
  }

  if (mode === "card") {
    return (
      <div className="flex flex-col gap-3">
        <PosPaymentFlow terminal={terminal} applicationId={app.id} amount={due} description={`${app.transactionNumber} · ${transactionLabel(app.type)}`} large onPaid={setPaid} onChangeMethod={() => { setManualMethod(manualChannels[0]?.method); setMode(manualChannels.length ? "manual" : "ready"); }} />
        <button type="button" className="btn btn-s btn-lg" onClick={() => setMode("ready")}>Back</button>
      </div>
    );
  }
  if (mode === "manual") {
    return (
      <div className="flex flex-col gap-3">
        <PaymentCollector detail={detail} large initialMethod={manualMethod} onPaid={setPaid} />
        <button type="button" className="btn btn-s btn-lg" onClick={() => setMode("ready")}>Back</button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
      <div className="flex items-start gap-3 rounded-[10px] bg-white p-3.5">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-[10px] bg-[#f4f5f8]"><VehicleIcon type={vehicle?.vehicleType} size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[16px] font-bold">{fullName(detail.owner)}</p>
          <p className="m-0 text-[14px] text-[#3a3f4a]">{vehicleLabel(vehicle)} · {vehicleTypeLabel(vehicle?.vehicleType)}</p>
          <p className="m-0 text-[13px] text-[#3a3f4a]">{transactionLabel(app.type)}{vehicle?.registrationNumber ? ` · ${vehicle.registrationNumber}` : ""}</p>
          <p className="mono m-0 text-[12px] text-[#5a606c]">{app.transactionNumber}</p>
        </div>
        <StatusBadge kind="registration" status={app.status} />
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        <p className="eb">Total amount due</p>
        <p className="num m-0 text-[56px] font-extrabold tracking-[-.03em]">{formatMoney(due)}</p>
        {posEnabled && <Badge tone={POS_STATE_TONE[terminal.state]}>{terminal.label}{terminal.terminalId ? ` · ${terminal.terminalId}` : ""}</Badge>}
        <p className="sr" role="status" aria-live="polite">{terminal.label}</p>
      </div>
      {!isOnline && <Alert tone="bad" title="Payments require an active connection." />}
      {app.status !== "payment_required" && <Alert tone="warn" title="Not ready for payment">This transaction is {app.status.replace(/_/g, " ")}.</Alert>}
      {posEnabled && !terminal.canCharge && terminal.state !== "detecting" && manualChannels.length > 0 && (
        <Alert tone="warn" title="Card terminal unavailable">Use one of the manual payment methods below.</Alert>
      )}
      {posEnabled && (
        <button type="button" className="btn btn-k w-full !min-h-[72px] !rounded-xl !text-[20px] !font-extrabold" disabled={!payable || !terminal.canCharge} onClick={() => setMode("card")}>PAY WITH CARD</button>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {manualChannels.map((c) => (
          <button key={c.method} type="button" className="btn btn-s !min-h-[60px] !text-[16px]" disabled={!payable} onClick={() => { setManualMethod(c.method); setMode("manual"); }}>{c.label}</button>
        ))}
        <button type="button" className="btn btn-s !min-h-[60px] !text-[16px]" onClick={() => router.push("/payments")}>Cancel</button>
      </div>
    </div>
  );
}
