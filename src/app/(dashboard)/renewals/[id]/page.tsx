"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useServiceQuery } from "@/hooks/use-service";
import { registrationService } from "@/services/registration.service";
import { vehicleService } from "@/services/vehicle.service";
import { Breadcrumbs } from "@/components/ui/layout-bits";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { applicationHref } from "@/components/registry/renewal";

/**
 * Legacy deep link. Renewals are now ordinary transactions in the registration workflow:
 * - a renewal application id opens that transaction;
 * - a vehicle id opens the renewal check for that vehicle on /renewals.
 */
export default function RenewalRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const q = useServiceQuery(async () => {
    const app = await registrationService.getById(id);
    if (app) return app.type === "renewal" ? applicationHref(app) : `/registrations/${app.id}`;
    const vehicle = await vehicleService.getById(id);
    return vehicle ? `/renewals?vehicle=${vehicle.id}` : null;
  }, [id], { live: false });

  const target = q.data;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (q.error) return <ErrorState message={q.error} onRetry={() => q.reload()} />;
  if (q.data === null) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Renewals", href: "/renewals" }, { label: "Not found" }]} />
        <EmptyState title="No registrations found" message="No renewal transaction or vehicle matches this link. Search for the vehicle on the renewals page." action={{ label: "Find vehicle record", href: "/renewals" }} />
      </div>
    );
  }
  return <div className="card p-6"><Spinner label="Opening renewal…" /></div>;
}
