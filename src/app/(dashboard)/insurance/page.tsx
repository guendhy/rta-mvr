"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { Search, X } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { formatDate, formatDateTime, formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { TRANSACTION_TYPE_OPTIONS, transactionLabel } from "@/config/transaction-types";
import { VEHICLE_TYPE_OPTIONS, vehicleTypeLabel } from "@/config/vehicle-types";
import { insuranceService } from "@/services/insurance.service";
import { registrationService } from "@/services/registration.service";
import { vehicleService } from "@/services/vehicle.service";
import { ownerService } from "@/services/owner.service";
import { KpiCard, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import type { InsuranceRecord, Owner, RegistrationApplication, Vehicle } from "@/types";

type TabKey = "awaiting" | "all" | "expiring" | "problems";
const TAB_KEYS: TabKey[] = ["awaiting", "all", "expiring", "problems"];
type AwaitRow = { app: RegistrationApplication; owner: Owner | undefined; vehicle: Vehicle | undefined; record: InsuranceRecord | undefined };
type RecRow = { rec: InsuranceRecord; app: RegistrationApplication | undefined; vehicle: Vehicle | undefined; days: number };

function VehicleTypeCell({ vehicle }: { vehicle: Vehicle | undefined }) {
  if (!vehicle) return <span className="mut">—</span>;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><VehicleIcon type={vehicle.vehicleType} size={16} />{vehicleTypeLabel(vehicle.vehicleType)}</span>;
}

function InsuranceInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw && TAB_KEYS.includes(raw) ? raw : "awaiting";
  const [query, setQuery] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [txnType, setTxnType] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);

  const data = useServiceQuery(async () => {
    const [records, apps, vehicles, owners] = await Promise.all([insuranceService.list(), registrationService.list(), vehicleService.list(), ownerService.list()]);
    const awaiting: AwaitRow[] = apps
      .filter((a) => a.status === "for_insurance_verification")
      .map((app) => ({
        app,
        owner: owners.find((o) => o.id === app.ownerId),
        vehicle: vehicles.find((v) => v.id === app.vehicleId),
        record: records.find((r) => r.id === app.insuranceId) ?? records.find((r) => r.applicationId === app.id),
      }));
    const all: RecRow[] = records.map((rec) => ({ rec, app: apps.find((a) => a.id === rec.applicationId), vehicle: vehicles.find((v) => v.id === rec.vehicleId), days: differenceInCalendarDays(new Date(rec.coverageExpiry), new Date()) }));
    return { awaiting, all };
  }, []);

  const sets = useMemo(() => {
    if (!data.data) return null;
    const match = (parts: (string | undefined)[]) => !q || parts.filter(Boolean).join(" ").toLowerCase().includes(q);
    const typeOk = (v: Vehicle | undefined, a: RegistrationApplication | undefined) => (!vehicleType || v?.vehicleType === vehicleType) && (!txnType || a?.type === txnType);
    const awaiting = data.data.awaiting.filter((r) => typeOk(r.vehicle, r.app) && match([r.app.transactionNumber, fullName(r.owner), vehicleLabel(r.vehicle), r.record?.policyNumber, r.vehicle?.vin, r.vehicle?.chassisNumber, r.vehicle?.plateNumber]));
    const all = data.data.all.filter((r) => typeOk(r.vehicle, r.app) && match([r.rec.provider, r.rec.policyNumber, r.rec.policyHolder, r.app?.transactionNumber, r.rec.vinOrChassis, vehicleLabel(r.vehicle), r.vehicle?.plateNumber]));
    return {
      awaiting,
      all,
      expiring: all.filter((r) => r.rec.status === "verified" && r.days >= 0 && r.days <= 30).sort((a, b) => a.days - b.days),
      problems: all.filter((r) => ["expired", "invalid", "rejected"].includes(r.rec.status) || (r.rec.status === "verified" && r.days < 0)),
    };
  }, [data.data, q, vehicleType, txnType]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!sets || !data.data) return <PageSkeleton />;

  const setTab = (v: TabKey) => router.replace(v === "awaiting" ? "/insurance" : `/insurance?tab=${v}`, { scroll: false });
  const canVerify = can("insurance.verify");
  const filtersOn = !!(query || vehicleType || txnType);
  const clear = () => { setQuery(""); setVehicleType(""); setTxnType(""); };
  const totalVerified = data.data.all.filter((r) => r.rec.status === "verified" && r.days >= 0).length;

  const awaitCols: ColumnDef<AwaitRow, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/insurance/${row.original.app.id}`} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "type", header: "Transaction type", accessorFn: (r) => transactionLabel(r.app.type, true) },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.vehicle) },
    { id: "vtype", header: "Vehicle type", accessorFn: (r) => vehicleTypeLabel(r.vehicle?.vehicleType), cell: ({ row }) => <VehicleTypeCell vehicle={row.original.vehicle} /> },
    { id: "vin", header: "VIN / Chassis", accessorFn: (r) => r.vehicle?.vin || r.vehicle?.chassisNumber || "", cell: ({ row }) => <span className="mono text-[12.5px]">{row.original.vehicle?.vin || row.original.vehicle?.chassisNumber || "—"}</span> },
    { id: "captured", header: "Policy captured", accessorFn: (r) => r.record?.policyNumber ?? "", cell: ({ row }) => (row.original.record ? <span className="flex flex-col"><span className="mono">{row.original.record.policyNumber}</span><StatusBadge kind="insurance" status={row.original.record.status} /></span> : <span className="mut">Not captured</span>) },
    { id: "updated", header: "Updated", accessorFn: (r) => r.app.updatedAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.app.updatedAt)}</span> },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={`/insurance/${row.original.app.id}`} className={`btn btn-sm ${canVerify ? "btn-p" : "btn-s"}`}>{canVerify ? "Verify" : "View"}</Link> },
  ];

  const recCols: ColumnDef<RecRow, unknown>[] = [
    { id: "provider", header: "Provider", accessorFn: (r) => r.rec.provider },
    { id: "policy", header: "Policy No.", accessorFn: (r) => r.rec.policyNumber, cell: ({ row }) => <span className="mono">{row.original.rec.policyNumber}</span> },
    { id: "holder", header: "Policy holder", accessorFn: (r) => r.rec.policyHolder },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.vehicle), cell: ({ row }) => <span className="flex flex-col"><span>{vehicleLabel(row.original.vehicle)}</span><span className="mono mut text-[12px]">{row.original.rec.vinOrChassis}</span></span> },
    { id: "vtype", header: "Vehicle type", accessorFn: (r) => vehicleTypeLabel(r.vehicle?.vehicleType), cell: ({ row }) => <VehicleTypeCell vehicle={row.original.vehicle} /> },
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
      lines={[r.rec.policyHolder, `${vehicleLabel(r.vehicle)} · ${vehicleTypeLabel(r.vehicle?.vehicleType)}`, `${r.rec.provider} · ${r.app?.transactionNumber ?? ""}`]}
      footer={<><span className="font-extrabold">{formatMoney(r.rec.premium)}</span><span className={`text-[12px] ${r.days < 0 ? "text-[#a3111a]" : "mut"}`}>{formatDate(r.rec.coverageStart)} – {formatDate(r.rec.coverageExpiry)}</span></>} />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Insurance" title="Insurance Verification" description="Verify third-party insurance for every vehicle type before assessment, and monitor expiring or problem policies." />

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

      <section className="card sec" aria-label="Search and filters">
        <div className="form">
          <Field label="Search" htmlFor="ins-q" help="Transaction, owner, vehicle, provider, policy, holder, VIN or chassis">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
              <Input id="ins-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="!pl-10" autoComplete="off" />
            </div>
          </Field>
          <Field label="Vehicle type" htmlFor="ins-vt"><Select id="ins-vt" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="All vehicle types" options={VEHICLE_TYPE_OPTIONS} /></Field>
          <Field label="Transaction type" htmlFor="ins-tt"><Select id="ins-tt" value={txnType} onChange={(e) => setTxnType(e.target.value)} placeholder="All transaction types" options={TRANSACTION_TYPE_OPTIONS} /></Field>
        </div>
        {filtersOn && <div><button type="button" className="btn btn-g btn-sm min-h-[44px]" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button></div>}
      </section>

      <div role="tabpanel" aria-label="Insurance records">
        {tab === "awaiting" ? (
          <DataTable key="awaiting" storageKey="insurance-awaiting" data={sets.awaiting} loading={data.loading} columns={awaitCols}
            mobileCard={(r) => (
              <MobileCard href={`/insurance/${r.app.id}`} title={r.app.transactionNumber} badge={r.record ? <StatusBadge kind="insurance" status={r.record.status} /> : <span className="badge s-draft">Not captured</span>}
                lines={[fullName(r.owner), `${vehicleLabel(r.vehicle)} · ${vehicleTypeLabel(r.vehicle?.vehicleType)}`, transactionLabel(r.app.type)]}
                footer={<><span className="mono text-[12px]">{r.record?.policyNumber ?? r.vehicle?.vin ?? ""}</span><span className="text-[12.5px] font-semibold text-[#1515e8]">{canVerify ? "Verify" : "View"}</span></>} />
            )}
            empty={{ title: "Nothing awaiting verification", message: filtersOn ? "No transactions match the current filters." : "No transactions are waiting for insurance verification." }} />
        ) : (
          <DataTable key={tab} storageKey="insurance-records" data={tab === "all" ? sets.all : tab === "expiring" ? sets.expiring : sets.problems} loading={data.loading} columns={recCols}
            mobileCard={recCard}
            empty={tab === "expiring"
              ? { title: "No policies expiring soon", message: "No verified policies expire within the next 30 days." }
              : tab === "problems"
                ? { title: "No problem policies", message: "There are no expired, invalid or rejected insurance records." }
                : { title: "No insurance records", message: filtersOn ? "No insurance records match the current filters." : "No insurance has been captured yet." }} />
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
