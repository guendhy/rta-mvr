"use client";

import { use } from "react";
import Link from "next/link";
import { registrationService } from "@/services/registration.service";
import { useServiceQuery } from "@/hooks/use-service";
import { usePosEnvironment } from "@/hooks/use-pos-environment";
import { fullName } from "@/lib/formatting";
import { Breadcrumbs, PageHeader } from "@/components/ui/layout-bits";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PaymentCollector } from "@/components/payments/payment-collector";
import { PosModeScreen } from "@/components/pos/pos-mode-screen";

/** Cashier collection screen for one application. Switches to the Smart POS layout on POS devices. */
export default function CollectPaymentPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = use(params);
  const env = usePosEnvironment();
  const { data: detail, loading, error, reload } = useServiceQuery(() => registrationService.getDetail(applicationId), [applicationId]);
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !detail) return <PageSkeleton />;
  if (!detail) return <EmptyState title="Application not found" message="No application matches this payment link." action={{ label: "Payment queue", href: "/payments" }} />;
  const app = detail.application;
  if (env.isPosDevice) return <PosModeScreen detail={detail} />;
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments" }, { label: "Collect Payment" }]} />
      <PageHeader
        title="Collect Payment"
        badge={<StatusBadge kind="registration" status={app.status} />}
        description={<><span className="mono font-semibold text-[#0b0b0f]">{app.transactionNumber}</span> · {fullName(detail.owner)}</>}
        actions={<Link href={`/registrations/${app.id}`} className="btn btn-s btn-sm">Application record</Link>}
      />
      <PaymentCollector detail={detail} />
    </div>
  );
}
