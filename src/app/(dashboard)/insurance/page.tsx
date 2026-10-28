"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { Search } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { formatDate, formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { insuranceService } from "@/services/insurance.service";
import { registrationService } from "@/services/registration.service";
import { motorcycleService } from "@/services/motorcycle.service";
import { ownerService } from "@/services/owner.service";
import { KpiCard, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { Field, Input } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import type { InsuranceRecord, Motorcycle, Owner, RegistrationApplication } from "@/types";

type TabKey = "awaiting" | "all" | "expiring" | "problems";
const TAB_KEYS: TabKey[] = ["awaiting", "all", "expiring", "problems"];
type AwaitRow = { app: RegistrationApplication; owner: Owner | undefined; moto: Motorcycle | undefined; record: InsuranceRecord | undefined };
type RecRow = { rec: InsuranceRecord; app: RegistrationApplication | undefined; days: number };

function InsuranceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw && TAB_KEYS.includes(raw) ? raw : "awaiting";
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);

  const data = useServiceQuery(async () => {
    const [records, apps, motos, owners] = await Promise.all([insuranceService.list(), registrationService.list(), motorcycleService.list(), ownerService.list()]);
    const awaiting: AwaitRow[] = apps
      .filter((a) => a.status === "for_insurance_verification")
      .map((app) => ({
        app,
        owner: owners.find((o) => o.id === app.ownerId),
        moto: motos.find((m) => m.id === app.motorcycleId),
        record: records.find((r) => r.id === app.insuranceId) ?? records.find((r) => r.applicationId === app.id),
      }));
    const all: RecRow[] = records.map((rec) => ({ rec, app: apps.find((a) => a.id === rec.applicationId), days: differenceInCalendarDays(new Date(rec.coverageExpiry), new Date()) }));
    return { awaiting, all };
  }, []);

  const sets = useMemo(() => {
    if (!data.data) return null;
    const match = (parts: (string | undefined)[]) => !q || parts.filter(Boolean).join(" ").toLowerCase().includes(q);
    const awaiting = data.data.awaiting.filter((r) => match([r.app.transactionNumber, fullName(r.owner), motorcycleLabel(r.moto), r.record?.policyNumber, r.moto?.vin, r.moto?.chassisNumber]));
    const all = data.data.all.filter((r) => match([r.rec.provider, r.rec.policyNumber, r.rec.policyHolder, r.app?.transactionNumber, r.rec.vinOrChassis]));
    return {
      awaiting,
      all,
      expiring: all.filter((r) => r.rec.status === "verified" && r.days >= 0 && r.days <= 30).sort((a, b) => a.days - b.days),
      problems: all.filter((r) => ["expired", "invalid", "rejected"].includes(r.rec.status) || (r.rec.status === "verified" && r.days < 0)),
    };
  }, [data.data, q]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!sets || !data.data) return <PageSkeleton />;

  const setTab = (v: TabKey) => router.replace(v === "awaiting" ? "/insurance" : `/insurance?tab=${v}`, { scroll: false });
  const canVerify = can("insurance.verify");
  const totalVerified = data.data.all.filter((r) => r.rec.status === "verified" && r.days >= 0).length;

  const awaitCols: ColumnDef<AwaitRow, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/insurance/${row.original.app.id}`} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "type", header: "Type", accessorFn: (r) => r.app.type, cell: ({ row }) => (row.original.app.type === "renewal" ? "Renewal" : "New") },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (r) => motorcycleLabel(r.moto) },
    { id: "vin", header: "VIN / Chassis", accessorFn: (r) => r.moto?.vin ?? "", cell: ({ row }) => <span className="mono text-[12.5px]">{row.original.moto?.vin ?? row.original.moto?.chassisNumber ?? "—"}</span> },
    { id: "captured", header: "Policy captured", accessorFn: (r) => r.record?.policyNumber ?? "", cell: ({ row }) => (row.original.record ? <span className="flex flex-col"><span className="mono">{row.original.record.policyNumber}</span><StatusBadge kind="insurance" status={row.original.record.status} /></span> : <span className="mut">Not captured</span>) },
    { id: "updated", header: "Updated", accessorFn: (r) => r.app.updatedAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.app.updatedAt)}</span> },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={`/insurance/${row.original.app.id}`} className={`btn btn-sm ${canVerify ? "btn-p" : "btn-s"}`}>{canVerify ? "Verify" : "View"}</Link> },
  ];

  const recCols: ColumnDef<RecRow, unknown>[] = [
    { id: "provider", header: "Provider", accessorFn: (r) => r.rec.provider },
    { id: "policy", header: "Policy No.", accessorFn: (r) => r.rec.policyNumber, cell: ({ row }) => <span className="mono">{row.original.rec.policyNumber}</span> },
    { id: "holder", header: "Policy holder", accessorFn: (r) => r.rec.policyHolder },
    { id: "start", header: "Coverage start", accessorFn: (r) => r.rec.coverageStart, cell: ({ row }) => <span className="mono">{formatDate(row.original.rec.coverageStart)}</span> },
    { id: "expiry", header: "Expiry", accessorFn: (r) => r.rec.coverageExpiry, cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="mono">{formatDate(row.original.rec.coverageExpiry)}</span>
        <span className={`text-[12px] ${row.original.days < 0 ? "text-[#a3111a]" : row.original.days <= 30 ? "text-[#6e5200]" : "mut"}`}>{row.original.days < 0 ? `Expired ${-row.original.days}d ago` : `${row.original.days}d left`}</span>
      </span>
    ) },
    { id: "premium", header: "Premium", accessorFn: (r) => r.rec.premium, meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.rec.premium) },
    { id: "status", header: "Status", accessorFn: (r) => r.rec.status, cell: ({ row }) => <StatusBadge kind="insurance" status={row.original.rec.status} /> },
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app?.transactionNumber ?? "", cell: ({ row }) => <Link href={`/insurance/${row.original.rec.applicationId}`} className="mono">{row.original.app?.transactionNumber ?? "View"}</Link> },
  ];

  const recCard = (r: RecRow) => (
    <MobileCard href={`/insurance/${r.rec.applicationId}`} title={r.rec.policyNumber} badge={<StatusBadge kind="insurance" status={r.rec.status} />}
      lines={[r.rec.policyHolder, `${r.rec.provider} · ${r.app?.transactionNumber ?? ""}`]}
      footer={<><span className="font-extrabold">{formatMoney(r.rec.premium)}</span><span className={`text-[12px] ${r.days < 0 ? "text-[#a3111a]" : "mut"}`}>{formatDate(r.rec.coverageStart)} – {formatDate(r.rec.coverageExpiry)}</span></>} />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Insurance" title="Insurance Verification" description="Verify third-party insurance before assessment, and monitor expiring or problem policies." />

      <div className="g4">
        <KpiCard label="Awaiting verification" value={data.data.awaiting.length} footer={<StatusBadge kind="registration" status="for_insurance_verification" />} />
        <KpiCard label="Active verified policies" value={totalVerified} footer="Verified and not expired" />
        <KpiCard label="Expiring in 30 days" value={data.data.all.filter((r) => r.rec.status === "verified" && r.days >= 0 && r.days <= 30).length} footer="Verified policies ending soon" />
        <KpiCard tone="danger" label="Problems" value={data.data.all.filter((r) => ["expired", "invalid", "rejected"].includes(r.rec.status) || (r.rec.status === "verified" && r.days < 0)).length} footer="Expired, invalid or rejected" />
      </div>

      <Tabs<TabKey>
        label="Insurance sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "awaiting", label: "Awaiting verification", count: sets.awaiting.length },
          { value: "all", label: "All records", count: sets.all.length },
          { value: "expiring", label: "Expiring", count: sets.expiring.length },
          { value: "problems", label: "Problems", count: sets.problems.length },
        ]}
      />

      <Field label="Search" htmlFor="ins-q" help="Transaction, owner, provider, policy number, holder or VIN">
        <div className="relative max-w-xl">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
          <Input id="ins-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="!pl-10" autoComplete="off" />
        </div>
      </Field>

      <div role="tabpanel" aria-label="Insurance records">
        {tab === "awaiting" ? (
          <DataTable key="awaiting" storageKey="insurance-awaiting" data={sets.awaiting} loading={data.loading} columns={awaitCols}
            mobileCard={(r) => (
              <MobileCard href={`/insurance/${r.app.id}`} title={r.app.transactionNumber} badge={r.record ? <StatusBadge kind="insurance" status={r.record.status} /> : <span className="badge s-draft">Not captured</span>}
                lines={[fullName(r.owner), motorcycleLabel(r.moto)]}
                footer={<><span className="mono text-[12px]">{r.record?.policyNumber ?? r.moto?.vin ?? ""}</span><span className="text-[12.5px] font-semibold text-[#1515e8]">{canVerify ? "Verify" : "View"}</span></>} />
            )}
            empty={{ title: "Nothing awaiting verification", message: q ? "No applications match your search." : "No applications are waiting for insurance verification." }} />
        ) : (
          <DataTable key={tab} storageKey="insurance-records" data={tab === "all" ? sets.all : tab === "expiring" ? sets.expiring : sets.problems} loading={data.loading} columns={recCols}
            mobileCard={recCard}
            empty={tab === "expiring"
              ? { title: "No policies expiring soon", message: "No verified policies expire within the next 30 days." }
              : tab === "problems"
                ? { title: "No problem policies", message: "There are no expired, invalid or rejected insurance records." }
                : { title: "No insurance records", message: q ? "No insurance records match your search." : "No insurance has been captured yet." }} />
        )}
      </div>
    </div>
  );
}

export default function InsurancePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InsuranceInner />
    </Suspense>
  );
}
