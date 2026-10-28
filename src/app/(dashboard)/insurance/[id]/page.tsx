"use client";

import { use } from "react";
import Link from "next/link";
import { registrationService } from "@/services/registration.service";
import { insuranceService } from "@/services/insurance.service";
import { useServiceQuery } from "@/hooks/use-service";
import { fullName, motorcycleLabel } from "@/lib/formatting";
import { Breadcrumbs, PageHeader } from "@/components/ui/layout-bits";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { InsurancePanel } from "@/components/insurance/insurance-panel";

/** Insurance verification for one application. Accepts an application id or an insurance record id. */
export default function InsuranceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: detail, loading, error, reload } = useServiceQuery(async () => {
    const direct = await registrationService.getDetail(id);
    if (direct) return direct;
    const rec = await insuranceService.getById(id);
    return rec ? registrationService.getDetail(rec.applicationId) : null;
  }, [id]);
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !detail) return <PageSkeleton />;
  if (!detail) return <EmptyState title="Insurance record not found" message="No application or policy matches this link." action={{ label: "Insurance", href: "/insurance" }} />;
  const app = detail.application;
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Insurance", href: "/insurance" }, { label: app.transactionNumber }]} />
      <PageHeader
        title="Insurance Verification"
        badge={detail.insurance ? <StatusBadge kind="insurance" status={detail.insurance.status} /> : <StatusBadge kind="registration" status={app.status} />}
        description={<><span className="mono font-semibold text-[#0b0b0f]">{app.transactionNumber}</span> · {fullName(detail.owner)} · {motorcycleLabel(detail.motorcycle)} · VIN <span className="mono">{detail.motorcycle?.vin}</span></>}
        actions={<Link href={`/registrations/${app.id}`} className="btn btn-s btn-sm">Application record</Link>}
      />
      <InsurancePanel detail={detail} />
    </div>
  );
}
