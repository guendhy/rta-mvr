"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { formatDate, formatDateTime, fullName, motorcycleLabel } from "@/lib/formatting";
import { motorcycleService } from "@/services/motorcycle.service";
import { ownerService } from "@/services/owner.service";
import { registrationService } from "@/services/registration.service";
import { KpiCard, PageHeader, Section } from "@/components/ui/layout-bits";
import { Field, Input } from "@/components/ui/form";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { PlateChip, RenewalSteps, daysToExpiry, expiryText, isOpen, useStartRenewal } from "@/components/registry/renewal";
import type { Motorcycle, Owner, RegistrationApplication } from "@/types";

type MotoRow = { moto: Motorcycle; owner: Owner | undefined; days: number | null; open: RegistrationApplication | undefined };
type AppRow = { app: RegistrationApplication; owner: Owner | undefined; moto: Motorcycle | undefined };

export default function RenewalsPage() {
  const { can } = useDemoUser();
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);
  const renewal = useStartRenewal();
  const canCreate = can("renewal.create");

  const data = useServiceQuery(async () => {
    const [motos, owners, apps] = await Promise.all([motorcycleService.list(), ownerService.list(), registrationService.list()]);
    return { motos, owners, apps };
  }, []);

  const derived = useMemo(() => {
    if (!data.data) return null;
    const { motos, owners, apps } = data.data;
    const ownerOf = (id?: string) => owners.find((o) => o.id === id);
    const motoOf = (id?: string) => motos.find((m) => m.id === id);
    const eligible: MotoRow[] = motos
      .filter((m) => m.registrationStatus === "registered" || m.registrationStatus === "expired")
      .map((m) => ({ moto: m, owner: ownerOf(m.ownerId), days: daysToExpiry(m), open: apps.find((a) => a.motorcycleId === m.id && isOpen(a)) }))
      .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));
    const renewals = apps.filter((a) => a.type === "renewal");
    const inProgress: AppRow[] = renewals.filter(isOpen).map((app) => ({ app, owner: ownerOf(app.ownerId), moto: motoOf(app.motorcycleId) }));
    const recent: AppRow[] = renewals
      .filter((a) => a.status === "registered")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 8)
      .map((app) => ({ app, owner: ownerOf(app.ownerId), moto: motoOf(app.motorcycleId) }));
    return {
      eligible,
      inProgress,
      recent,
      expired: eligible.filter((r) => r.days !== null && r.days < 0).length,
      expiring: eligible.filter((r) => r.days !== null && r.days >= 0 && r.days <= 30).length,
    };
  }, [data.data]);

  const results = useMemo(() => {
    if (!derived) return undefined;
    if (!q) return derived.eligible.filter((r) => r.days !== null && r.days <= 30);
    return derived.eligible.filter((r) => {
      const m = r.moto;
      return [m.plateNumber, m.registrationNumber, m.engineNumber, m.chassisNumber, m.vin, fullName(r.owner)].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [derived, q]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!derived) return <PageSkeleton />;

  const action = (r: MotoRow) => {
    if (r.open) {
      return (
        <Link href={r.open.type === "renewal" ? `/registrations/new?id=${r.open.id}` : `/registrations/${r.open.id}`} className="btn btn-s btn-sm min-h-[44px]">
          Open {r.open.transactionNumber}
        </Link>
      );
    }
    if (!canCreate) return <Link href={`/registry/${r.moto.id}`} className="btn btn-s btn-sm min-h-[44px]">View</Link>;
    const busy = renewal.busyId === r.moto.id;
    return (
      <button type="button" className="btn btn-p btn-sm min-h-[44px]" disabled={!!renewal.busyId} onClick={() => renewal.start(r.moto.id)} aria-label={`Start renewal for ${r.moto.plateNumber ?? r.moto.registrationNumber}`}>
        <RefreshCw size={14} aria-hidden="true" className={busy ? "animate-spin" : ""} />
        {busy ? "Starting…" : "Start renewal"}
      </button>
    );
  };

  const motoCols: ColumnDef<MotoRow, unknown>[] = [
    { id: "plate", header: "Plate", accessorFn: (r) => r.moto.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.moto.plateNumber} size="sm" /> },
    { id: "reg", header: "Registration No.", accessorFn: (r) => r.moto.registrationNumber ?? "", cell: ({ row }) => <Link href={`/registry/${row.original.moto.id}`} className="mono font-semibold">{row.original.moto.registrationNumber ?? "—"}</Link> },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (r) => motorcycleLabel(r.moto) },
    { id: "expiry", header: "Expiry", accessorFn: (r) => r.days ?? 0, cell: ({ row }) => <span className="flex flex-col"><span className="mono">{formatDate(row.original.moto.registrationExpiry)}</span><span className={`text-[12px] ${row.original.days !== null && row.original.days < 0 ? "text-[#a3111a]" : "mut"}`}>{expiryText(row.original.days)}</span></span> },
    { id: "status", header: "Status", accessorFn: (r) => r.moto.registrationStatus, cell: ({ row }) => <StatusBadge kind="motorcycle" status={row.original.moto.registrationStatus} /> },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => action(row.original) },
  ];

  const appCols: ColumnDef<AppRow, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/registrations/new?id=${row.original.app.id}`} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "plate", header: "Plate", accessorFn: (r) => r.moto?.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.moto?.plateNumber} size="sm" /> },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (r) => motorcycleLabel(r.moto) },
    { id: "status", header: "Status", accessorFn: (r) => r.app.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "updated", header: "Updated", accessorFn: (r) => r.app.updatedAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.app.updatedAt)}</span> },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={`/registrations/new?id=${row.original.app.id}`} className="btn btn-s btn-sm">Continue</Link> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Renewals" title="Renew Registration" description="Find a registered motorcycle and start a renewal transaction." />

      <div className="g3">
        <KpiCard tone="danger" label="Expired registrations" value={derived.expired} href="/registry?expiry=expired" footer="Past expiry date — renewal overdue" />
        <KpiCard label="Expiring within 30 days" value={derived.expiring} href="/registry?expiry=30" footer="Due for renewal soon" />
        <KpiCard label="Renewals in progress" value={derived.inProgress.length} footer="Open renewal transactions" />
      </div>

      <Section title="Renewal workflow" description="A renewal never overwrites history — it creates a new transaction linked to the previous registration.">
        <RenewalSteps />
      </Section>

      <Section title="Find registration" description={q ? undefined : "Showing expired and soon-to-expire registrations. Search to find any registered motorcycle."}>
        <Field label="Search" htmlFor="ren-q" help="Plate number, registration number, engine number, chassis number or owner name">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
            <Input id="ren-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. P1234 or NCD-2025-00012" className="!pl-10" autoComplete="off" />
          </div>
        </Field>
        {!canCreate && <Alert tone="info" title="View only">Your role can view renewals but cannot start them.</Alert>}
        <p className="mut m-0 text-[13px]" aria-live="polite">{results?.length ?? 0} motorcycle{results?.length === 1 ? "" : "s"}</p>
        <div className="-mx-6 -mb-[22px] max-[760px]:-mx-4 max-[760px]:-mb-[18px]">
          <DataTable
            storageKey="renewal-search"
            data={results}
            loading={data.loading}
            columns={motoCols}
            mobileCard={(r) => (
              <div className="card flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <PlateChip plate={r.moto.plateNumber} size="sm" />
                  <StatusBadge kind="motorcycle" status={r.moto.registrationStatus} />
                </div>
                <Link href={`/registry/${r.moto.id}`} className="text-[15px] font-bold text-[#0b0b0f]">{fullName(r.owner)}</Link>
                <p className="mut m-0 text-[13px]">{motorcycleLabel(r.moto)} · <span className="mono">{r.moto.registrationNumber}</span></p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edeff3] pt-2.5">
                  <span className={`text-[12.5px] ${r.days !== null && r.days < 0 ? "text-[#a3111a]" : "mut"}`}>{formatDate(r.moto.registrationExpiry)} · {expiryText(r.days)}</span>
                  {action(r)}
                </div>
              </div>
            )}
            empty={{ title: q ? "No matching registrations" : "Nothing due for renewal", message: q ? "No registered or expired motorcycle matches your search." : "No registrations are expired or expiring within 30 days. Search above to renew any registered motorcycle." }}
          />
        </div>
      </Section>

      <div className="split">
        <div className="l">
          <Section title="Renewals in progress" description="Open renewal transactions — continue in the registration workflow.">
            <div className="-mx-6 -mb-[22px] max-[760px]:-mx-4 max-[760px]:-mb-[18px]">
              <DataTable
                storageKey="renewals-open"
                data={derived.inProgress}
                columns={appCols}
                mobileCard={(r) => <MobileCard href={`/registrations/new?id=${r.app.id}`} title={r.app.transactionNumber} badge={<StatusBadge kind="registration" status={r.app.status} />} lines={[fullName(r.owner), `${motorcycleLabel(r.moto)}${r.moto?.plateNumber ? ` · ${r.moto.plateNumber}` : ""}`]} footer={<span className="mut text-[12px]">Updated {formatDateTime(r.app.updatedAt)}</span>} />}
                empty={{ title: "No renewals in progress", message: "Start a renewal from the search above." }}
              />
            </div>
          </Section>
        </div>
        <div className="r">
          <Section title="Recently renewed">
            {derived.recent.length ? (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {derived.recent.map((r) => (
                  <li key={r.app.id} className="flex items-start justify-between gap-3 border-b border-[#edeff3] pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <Link href={`/registrations/${r.app.id}`} className="mono text-[13px] font-semibold">{r.app.transactionNumber}</Link>
                      <p className="m-0 text-[13.5px] font-semibold">{fullName(r.owner)}</p>
                      <p className="mut m-0 text-[12.5px]">Valid to {formatDate(r.app.expiryDate)}</p>
                    </div>
                    <PlateChip plate={r.moto?.plateNumber ?? r.app.plateNumber} size="sm" />
                  </li>
                ))}
              </ul>
            ) : <p className="mut m-0 text-[13px]">No renewals have been completed yet.</p>}
          </Section>
        </div>
      </div>
    </div>
  );
}
