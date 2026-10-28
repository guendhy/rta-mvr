"use client";

import Link from "next/link";
import { Smartphone } from "lucide-react";
import { paymentService } from "@/services/payment.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { usePosEnvironment } from "@/hooks/use-pos-environment";
import { useServiceQuery } from "@/hooks/use-service";
import { formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { Breadcrumbs, DescriptionList, PageHeader, Section } from "@/components/ui/layout-bits";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PosStatusCard } from "@/components/pos/pos-status-card";

/** POS terminal console: detection, connection, test, and the queue of payable applications. */
export default function PosConsolePage() {
  const { can } = useDemoUser();
  const env = usePosEnvironment();
  const { data: queue, loading } = useServiceQuery(() => paymentService.queue(), []);
  return (
    <div className="flex flex-col gap-6">
      {!env.isPosDevice && <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments" }, { label: "POS Terminal" }]} />}
      <PageHeader title="POS Terminal" description="Simulated Wiseasy P5 Smart POS. Change the terminal state and next payment result from Demo Tools." />
      <div className="split">
        <div className="l">
          <Section title="Awaiting payment" description="Select an application to charge on the terminal.">
            {loading && !queue ? <div className="sk h-40" /> : (queue ?? []).length === 0 ? (
              <EmptyState title="No Payments" message="No applications are waiting for payment." icon={<Smartphone size={36} />} />
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
                {(queue ?? []).map((q) => (
                  <li key={q.application.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="mono m-0 text-[13px] font-semibold">{q.application.transactionNumber}</p>
                      <p className="m-0 text-[14.5px] font-semibold">{fullName(q.owner)}</p>
                      <p className="mut m-0 text-[12.5px]">{motorcycleLabel(q.motorcycle)}{q.lastAttempt ? <> · last attempt <StatusBadge kind="payment" status={q.lastAttempt.status} /></> : null}</p>
                    </div>
                    <div className="row gap-3">
                      <span className="num text-[18px] font-extrabold">{formatMoney(q.application.assessment?.total)}</span>
                      {can("payment.process") && <Link href={`/payments/collect/${q.application.id}`} className="btn btn-k">Charge</Link>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="r">
          <PosStatusCard />
          <Section title="Device environment" description="usePosEnvironment() — values are simulated in Phase 1.">
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
