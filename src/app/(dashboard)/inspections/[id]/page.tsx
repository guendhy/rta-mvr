"use client";

import { use } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { useServiceQuery } from "@/hooks/use-service";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { fullName, vehicleLabel } from "@/lib/formatting";
import { Breadcrumbs, PageHeader } from "@/components/ui/layout-bits";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { VehicleCard } from "@/components/registrations/cards";
import { InspectionPanel } from "@/components/inspections/inspection-panel";

/** Inspection work screen for one transaction (id = application id). */
export default function InspectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: detail, loading, error, reload } = useServiceQuery(() => registrationService.getDetail(id), [id]);
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !detail) return <PageSkeleton />;
  if (!detail) return <EmptyState title="Inspection record missing" message="No transaction matches this inspection link." action={{ label: "Inspection queue", href: "/inspections" }} icon={<ClipboardList size={36} />} />;
  const app = detail.application;
  const v = detail.vehicle;
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Inspections", href: "/inspections" }, { label: detail.inspection?.reference ?? app.transactionNumber }]} />
      <PageHeader
        eyebrow={transactionLabel(app.type)}
        title="Motor Vehicle Inspection"
        badge={<StatusBadge kind="registration" status={app.status} />}
        description={<><span className="mono font-semibold text-[#0b0b0f]">{app.transactionNumber}</span> · {fullName(detail.owner)}{v ? ` · ${vehicleLabel(v)} · ${vehicleTypeLabel(v.vehicleType)}` : ""}</>}
        actions={<Link href={`/registrations/${app.id}`} className="btn btn-s btn-sm">Transaction record</Link>}
      />
      {v && <VehicleCard vehicle={v} compact />}
      <InspectionPanel detail={detail} />
    </div>
  );
}
