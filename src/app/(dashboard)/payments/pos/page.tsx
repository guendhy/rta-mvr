"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";
import { paymentService } from "@/services/payment.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { usePosTerminal } from "@/hooks/use-pos-terminal";
import { useServiceQuery } from "@/hooks/use-service";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { Breadcrumbs, DescriptionList, PageHeader, Section } from "@/components/ui/layout-bits";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PosStatusCard } from "@/components/pos/pos-status-card";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";

/** POS terminal console: detection, connection, test, and the queue of payable transactions. */
export default function PosConsolePage() {
  const { can } = useDemoUser();
  const terminal = usePosTerminal({ autoDetect: true });
  const env = terminal.env;
  const { data: queue, loading } = useServiceQuery(() => paymentService.queue(), []);
  const canCharge = can("payment.process");
  const payable = (queue ?? []).filter((q) => (q.application.assessment?.total ?? 0) > 0);
  return (
    <div className="flex flex-col gap-6">
      {!env.isPosDevice && <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments" }, { label: "POS Terminal" }]} />}
      <PageHeader title="POS Terminal" description="Terminal detection, connection and test. The terminal is reached through the POS adapter — change the simulated state and next result from Demo Tools." />
      <div className="split">
        <div className="l">
          {!terminal.canCharge && terminal.state !== "detecting" && (
            <Alert tone="warn" title={`${terminal.label} — card payments unavailable`}>Transactions can still be paid by the other enabled methods from the collection screen.</Alert>
          )}
          <Section title="Awaiting payment" description="Select a transaction to collect payment.">
            {loading && !queue ? <div className="sk h-40" /> : payable.length === 0 ? (
              <EmptyState title="No payments waiting" message="No transactions are waiting for payment." icon={<Smartphone size={36} />} />
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
                {payable.map((q) => (
                  <li key={q.application.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 flex-none place-items-center rounded-[10px] bg-[#f4f5f8]"><VehicleIcon type={q.vehicle?.vehicleType} size={20} /></span>
                      <div className="min-w-0">
                        <p className="mono m-0 text-[13px] font-semibold">{q.application.transactionNumber}</p>
                        <p className="m-0 text-[14.5px] font-semibold">{fullName(q.owner)}</p>
                        <p className="mut m-0 text-[12.5px]">{vehicleLabel(q.vehicle)} · {vehicleTypeLabel(q.vehicle?.vehicleType)} · {transactionLabel(q.application.type, true)}</p>
                        {q.lastAttempt && <p className="mut m-0 mt-1 flex items-center gap-1.5 text-[12.5px]">Last attempt <StatusBadge kind="payment" status={q.lastAttempt.status} /></p>}
                      </div>
                    </div>
                    <div className="row gap-3">
                      <span className="num text-[18px] font-extrabold">{formatMoney(q.application.assessment?.total)}</span>
                      {canCharge && <Link href={`/payments/collect/${q.application.id}`} className="btn btn-k" aria-label={`Collect payment for ${q.application.transactionNumber}`}>Collect</Link>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="r">
          <PosStatusCard terminal={terminal} />
          <Section title="Device environment" description="Detected by usePosEnvironment() — simulated in this prototype.">
            <DescriptionList items={[
              ["POS device", env.isPosDevice ? "Yes (POS mode)" : "No"],
              ["Screen class", env.screenClass],
              ["Android bridge", env.isAndroidBridgeAvailable ? "Available" : "Not available"],
              ["WebUSB", env.isUsbAvailable ? "Supported" : "Not supported"],
              ["Web Bluetooth", env.isBluetoothAvailable ? "Supported" : "Not supported"],
              ["Connection type", env.connectionType],
            ]} />
            <p className="help m-0">Open with <span className="mono">?pos=1</span>, use a 720×1280 / 1280×720 screen, or set POS device mode in Demo Tools to preview the Smart POS layout.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}
