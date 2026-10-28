"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { formatDate, fullName, motorcycleLabel } from "@/lib/formatting";
import { motorcycleService } from "@/services/motorcycle.service";
import { ownerService } from "@/services/owner.service";
import { registrationService } from "@/services/registration.service";
import { Breadcrumbs, DescriptionList, PageHeader, Section } from "@/components/ui/layout-bits";
import { Alert, EmptyState, ErrorState, PageSkeleton, Spinner } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlateChip, RenewalSteps, daysToExpiry, expiryText, isOpen, useStartRenewal } from "@/components/registry/renewal";

export default function RenewalReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useDemoUser();
  const renewal = useStartRenewal();

  const q = useServiceQuery(async () => {
    const app = await registrationService.getById(id);
    if (app?.type === "renewal") return { kind: "redirect" as const, appId: app.id };
    const motoId = app?.motorcycleId ?? id;
    const moto = await motorcycleService.getById(motoId);
    if (!moto) return null;
    const [owner, apps] = await Promise.all([ownerService.getById(moto.ownerId), registrationService.list()]);
    const mine = apps.filter((a) => a.motorcycleId === moto.id);
    const previous = mine.filter((a) => a.status === "registered").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
    return { kind: "review" as const, moto, owner, open: mine.find(isOpen), previous };
  }, [id]);

  const redirectTo = q.data?.kind === "redirect" ? q.data.appId : null;
  useEffect(() => {
    if (redirectTo) router.replace(`/registrations/new?id=${redirectTo}`);
  }, [redirectTo, router]);

  if (q.error) return <ErrorState message={q.error} onRetry={() => q.reload()} />;
  if (q.data === undefined) return <PageSkeleton />;
  if (q.data?.kind === "redirect") return <div className="card p-6"><Spinner label="Opening renewal transaction…" /></div>;
  if (q.data === null) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Renewals", href: "/renewals" }, { label: "Not found" }]} />
        <EmptyState title="Registration not found" message="No renewal transaction or motorcycle matches this link. Search for the registration on the renewals page." action={{ label: "Find registration", href: "/renewals" }} />
      </div>
    );
  }

  const { moto, owner, open, previous } = q.data;
  const days = daysToExpiry(moto);
  const renewable = moto.registrationStatus === "registered" || moto.registrationStatus === "expired";
  const canStart = can("renewal.create") && renewable && !open;
  const busy = renewal.busyId === moto.id;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Renewals", href: "/renewals" }, { label: moto.plateNumber ?? motorcycleLabel(moto) }]} />
      <PageHeader
        eyebrow="Renewal"
        title="Review before renewal"
        badge={<StatusBadge kind="motorcycle" status={moto.registrationStatus} />}
        description="Confirm the owner and motorcycle details. Starting a renewal creates a new transaction — the current registration stays in history."
        actions={
          canStart ? (
            <button type="button" className="btn btn-p btn-lg" disabled={busy} onClick={() => renewal.start(moto.id)}>
              <RefreshCw size={18} aria-hidden="true" className={busy ? "animate-spin" : ""} />
              {busy ? "Starting renewal…" : "Start renewal"}
            </button>
          ) : null
        }
      />

      {open && (
        <Alert tone="warn" title={`Application ${open.transactionNumber} is already open`} action={<Link href={open.type === "renewal" ? `/registrations/new?id=${open.id}` : `/registrations/${open.id}`} className="btn btn-s btn-sm min-h-[44px]">Open application</Link>}>
          Finish or cancel the open application before starting a renewal.
        </Alert>
      )}
      {!renewable && <Alert tone="bad" title="Not eligible for renewal">Only registered or expired motorcycles can be renewed. This motorcycle is {moto.registrationStatus}.</Alert>}
      {renewable && !can("renewal.create") && <Alert tone="info" title="View only">Your role cannot start renewals.</Alert>}

      <Section title="Renewal workflow"><RenewalSteps /></Section>

      <div className="g3">
        <Section title="Current registration">
          <div><PlateChip plate={moto.plateNumber} size="lg" /></div>
          <DescriptionList items={[
            ["Registration No.", <span key="r" className="mono">{moto.registrationNumber ?? "—"}</span>],
            ["Registered", formatDate(moto.registrationDate)],
            ["Expiry", <span key="e" className={days !== null && days < 0 ? "text-[#a3111a]" : ""}>{formatDate(moto.registrationExpiry)} · {expiryText(days)}</span>],
            ["Last transaction", previous ? <Link key="p" href={`/registrations/${previous.id}`} className="mono">{previous.transactionNumber}</Link> : "—"],
          ]} />
        </Section>
        <Section title="Owner" actions={owner ? <Link href={`/registry/${moto.id}`} className="btn btn-g btn-sm">Full record</Link> : null}>
          <DescriptionList items={[
            ["Name", fullName(owner)],
            ["Mobile", owner ? <span key="m" className="mono">{owner.mobile}</span> : "—"],
            ["ID number", owner?.identificationNumber ?? "—"],
            ["Province", owner?.province ?? "—"],
            ["Address", owner ? `${owner.street}, ${owner.district}` : "—"],
          ]} />
        </Section>
        <Section title="Motorcycle">
          <DescriptionList items={[
            ["Make / Model", motorcycleLabel(moto)],
            ["Colour", moto.color],
            ["Engine No.", <span key="e" className="mono">{moto.engineNumber}</span>],
            ["Chassis No.", <span key="c" className="mono">{moto.chassisNumber}</span>],
            ["VIN", <span key="v" className="mono">{moto.vin}</span>],
            ["Province", moto.provinceOfOperation],
          ]} />
        </Section>
      </div>
    </div>
  );
}
