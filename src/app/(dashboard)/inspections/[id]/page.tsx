"use client";

import { use } from "react";
import Link from "next/link";
import { registrationService } from "@/services/registration.service";
import { useServiceQuery } from "@/hooks/use-service";
import { fullName, motorcycleLabel } from "@/lib/formatting";
import { Breadcrumbs, PageHeader } from "@/components/ui/layout-bits";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { VehicleCard } from "@/components/registrations/cards";
import { InspectionPanel } from "@/components/inspections/inspection-panel";

/** Inspection work screen for one application (id = application id). */
export default function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: detail, loading, error, reload } = useServiceQuery(() => registrationService.getDetail(id), [id]);
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !detail) return <PageSkeleton />;
  if (!detail) return <EmptyState title="Inspection not found" message="No application matches this inspection." action={{ label: "Inspection queue", href: "/inspections" }} />;
  const app = detail.application;
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Inspection", href: "/inspections" }, { label: app.transactionNumber }]} />
      <PageHeader
        title="Roadworthiness Inspection"
        badge={<StatusBadge kind="registration" status={app.status} />}
        description={<><span className="mono font-semibold text-[#0b0b0f]">{app.transactionNumber}</span> · {fullName(detail.owner)} · {motorcycleLabel(detail.motorcycle)}</>}
        actions={<Link href={`/registrations/${app.id}`} className="btn btn-s btn-sm">Application record</Link>}
      />
      {detail.motorcycle && <VehicleCard motorcycle={detail.motorcycle} compact />}
      <InspectionPanel detail={detail} />
    </div>
  );
}
