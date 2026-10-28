"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import { vehicleService } from "@/services/vehicle.service";
import { paymentService } from "@/services/payment.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { useServiceQuery } from "@/hooks/use-service";
import { downloadText, formatDate, formatMoney, fullName, toCsv, vehicleLabel } from "@/lib/formatting";
import { paymentStateOf } from "@/lib/workflow";
import { getStatusLabel } from "@/config/statuses";
import { getTransactionType, TRANSACTION_BUCKETS, TRANSACTION_TYPE_OPTIONS, transactionLabel } from "@/config/transaction-types";
import { VEHICLE_TYPE_OPTIONS, vehicleTypeLabel } from "@/config/vehicle-types";
import { vehicleUsageLabel } from "@/config/vehicle-usage";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/form";
import { Breadcrumbs, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { ErrorState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RegistrationApplication, RegistrationStatus } from "@/types";

const GROUPS: { value: string; label: string; statuses?: RegistrationStatus[] }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "All open", statuses: ["draft", "pending", "for_inspection", "inspection_failed", "for_insurance_verification", "for_assessment", "payment_required", "for_approval", "approved", "returned"] },
  { value: "pending", label: "Draft / Pending Verification", statuses: ["draft", "pending"] },
  { value: "for_inspection", label: "Pending Inspection", statuses: ["for_inspection", "inspection_failed", "for_insurance_verification"] },
  { value: "payment_required", label: "Pending Payment", statuses: ["for_assessment", "payment_required"] },
  { value: "for_approval", label: "Pending Approval", statuses: ["for_approval", "approved"] },
  { value: "registered", label: "Completed", statuses: ["registered"] },
  { value: "returned", label: "Returned", statuses: ["returned"] },
  { value: "rejected", label: "Rejected / Cancelled", statuses: ["rejected", "cancelled"] },
];

const PAYMENT_OPTIONS = [
  { value: "not_due", label: "Not due" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
];

function openHref(a: RegistrationApplication) {
  return ["registered", "rejected", "cancelled"].includes(a.status) ? `/registrations/${a.id}` : `/registrations/new?id=${a.id}`;
}

function actionLabel(a: RegistrationApplication) {
  switch (a.status) {
    case "draft": case "returned": return "Continue";
    case "pending": return "Verify";
    case "for_inspection": case "inspection_failed": return "Inspect";
    case "for_insurance_verification": return "Insurance";
    case "for_assessment": return "Assess";
    case "payment_required": return "Collect";
    case "for_approval": return "Review";
    case "approved": return "Assign plate";
    default: return "View";
  }
}

/** Applications / transactions — every motor vehicle transaction, any type and stage. */
function ApplicationsList() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const group = params.get("status") ?? "all";
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState("all");
  const [filters, setFilters] = useState({ type: params.get("type") ?? "", vehicleType: "", payment: "", officer: "", from: "", to: "" });
  const query = useDebouncedValue(q, 300);

  const { data, loading, error, reload } = useServiceQuery(async () => {
    const [apps, owners, vehicles, payments] = await Promise.all([registrationService.list({ query }), ownerService.list(), vehicleService.list(), paymentService.list()]);
    return apps.map((a) => ({
      app: a,
      owner: owners.find((o) => o.id === a.ownerId) ?? null,
      newOwner: a.transfer?.newOwnerId ? owners.find((o) => o.id === a.transfer!.newOwnerId) ?? null : null,
      vehicle: vehicles.find((m) => m.id === a.vehicleId) ?? null,
      payment: paymentStateOf(a, payments),
    }));
  }, [query]);

  type Row = NonNullable<typeof data>[number];
  const officers = useMemo(() => [...new Map((data ?? []).map((r) => [r.app.assignedOfficerId ?? r.app.createdBy, r.app.assignedOfficerName ?? r.app.createdByName])).entries()].map(([value, label]) => ({ value, label })), [data]);
  const filtered = useMemo(() => {
    const g = GROUPS.find((x) => x.value === group);
    return (data ?? []).filter((r) => {
      const a = r.app;
      const submitted = (a.submittedAt ?? a.createdAt).slice(0, 10);
      return (!g?.statuses || g.statuses.includes(a.status))
        && (bucket === "all" || getTransactionType(a.type).bucket === bucket)
        && (!filters.type || a.type === filters.type)
        && (!filters.vehicleType || (a.type === "new" ? a.draft.classification?.vehicleType ?? r.vehicle?.vehicleType : r.vehicle?.vehicleType) === filters.vehicleType)
        && (!filters.payment || r.payment === filters.payment)
        && (!filters.officer || (a.assignedOfficerId ?? a.createdBy) === filters.officer)
        && (!filters.from || submitted >= filters.from)
        && (!filters.to || submitted <= filters.to);
    });
  }, [data, group, bucket, filters]);

  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.value, (data ?? []).filter((r) => !g.statuses || g.statuses.includes(r.app.status)).length])), [data]);
  const bucketCounts = useMemo(() => Object.fromEntries(TRANSACTION_BUCKETS.map((b) => [b.key, (data ?? []).filter((r) => getTransactionType(r.app.type).bucket === b.key).length])), [data]);
  const typeOf = (r: Row) => r.vehicle?.vehicleType ?? r.app.draft.classification?.vehicleType;

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "txn", header: "Reference", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={openHref(row.original.app)} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "type", header: "Transaction", accessorFn: (r) => transactionLabel(r.app.type, true) },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner), cell: ({ row }) => <span className="font-semibold">{fullName(row.original.owner)}{row.original.newOwner && <span className="mut block text-[12px] font-medium">→ {fullName(row.original.newOwner)}</span>}</span> },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.vehicle) },
    { id: "vtype", header: "Vehicle type", accessorFn: (r) => vehicleTypeLabel(typeOf(r)), cell: ({ row }) => <span>{vehicleTypeLabel(typeOf(row.original))}{row.original.vehicle && <span className="mut block text-[12px]">{vehicleUsageLabel(row.original.vehicle.vehicleUsage)}</span>}</span> },
    { id: "submitted", header: "Submitted", accessorFn: (r) => r.app.submittedAt ?? r.app.createdAt, cell: ({ row }) => <span className="mono text-[12.5px]">{formatDate(row.original.app.submittedAt ?? row.original.app.createdAt, "dd/MM HH:mm")}</span> },
    { id: "amount", header: "Amount due", meta: { align: "right" }, accessorFn: (r) => r.app.assessment?.total ?? 0, cell: ({ row }) => (row.original.app.assessment ? <span className="font-semibold">{formatMoney(row.original.app.assessment.total)}</span> : "—") },
    { id: "payment", header: "Payment", accessorFn: (r) => r.payment, cell: ({ row }) => <StatusBadge kind="application-payment" status={row.original.payment} /> },
    { id: "status", header: "Status", accessorFn: (r) => getStatusLabel("registration", r.app.status), cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "officer", header: "Officer", accessorFn: (r) => r.app.assignedOfficerName ?? r.app.createdByName },
    { id: "act", header: "", enableSorting: false, cell: ({ row }) => <Link href={openHref(row.original.app)} className="btn btn-g btn-sm" onClick={(e) => e.stopPropagation()}>{actionLabel(row.original.app)}</Link> },
  ];

  const exportCsv = () => {
    const cols = [
      { key: "ref", label: "Reference" }, { key: "txn", label: "Transaction" }, { key: "owner", label: "Owner" }, { key: "vehicle", label: "Vehicle" }, { key: "vtype", label: "Vehicle type" },
      { key: "submitted", label: "Submitted" }, { key: "amount", label: "Amount due (PGK)" }, { key: "payment", label: "Payment" }, { key: "status", label: "Status" }, { key: "officer", label: "Officer" },
    ];
    downloadText(`rta-applications-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(cols, filtered.map((r) => ({
      ref: r.app.transactionNumber, txn: transactionLabel(r.app.type), owner: fullName(r.owner), vehicle: vehicleLabel(r.vehicle), vtype: vehicleTypeLabel(typeOf(r)),
      submitted: formatDate(r.app.submittedAt ?? r.app.createdAt, "yyyy-MM-dd HH:mm"), amount: r.app.assessment?.total ?? "", payment: getStatusLabel("application-payment", r.payment), status: getStatusLabel("registration", r.app.status), officer: r.app.assignedOfficerName ?? r.app.createdByName,
    }))));
  };

  const set = (k: keyof typeof filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Applications" }]} />
      <PageHeader
        title="Applications & transactions"
        description="Every motor vehicle transaction in progress, across all transaction types. Open a row to continue the workflow."
        actions={
          <>
            <button type="button" className="btn btn-s" onClick={exportCsv} disabled={!filtered.length}><Download size={16} aria-hidden="true" />Export</button>
            {(can("registration.create") || can("renewal.create") || can("transfer.create")) && <Link href="/registrations/new" className="btn btn-p"><Plus size={18} aria-hidden="true" />New Vehicle Transaction</Link>}
          </>
        }
      />
      <Tabs label="Application status" value={group} onChange={(v) => router.replace(v === "all" ? "/registrations" : `/registrations?status=${v}`)} tabs={GROUPS.map((g) => ({ value: g.value, label: g.label, count: counts[g.value] }))} />
      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-2 border-b border-[#e1e4ea] px-[18px] py-3.5" role="group" aria-label="Transaction type">
          {[{ key: "all", label: "All" }, ...TRANSACTION_BUCKETS].map((b) => (
            <button key={b.key} type="button" className={`chip ${bucket === b.key ? "chip-on" : ""}`} aria-pressed={bucket === b.key} onClick={() => setBucket(b.key)}>
              {b.label} <span className="opacity-70">{b.key === "all" ? (data?.length ?? 0) : bucketCounts[b.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-3 px-[18px] py-3.5 [grid-template-columns:repeat(auto-fit,minmax(min(170px,100%),1fr))]">
          <div className="sm:col-span-2"><label className="lbl" htmlFor="rq">Search</label><Input id="rq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Reference, owner, plate, VIN, phone" /></div>
          <div><label className="lbl" htmlFor="f-type">Transaction type</label><Select id="f-type" value={filters.type} onChange={set("type")} placeholder="All transactions" options={TRANSACTION_TYPE_OPTIONS} /></div>
          <div><label className="lbl" htmlFor="f-vt">Vehicle type</label><Select id="f-vt" value={filters.vehicleType} onChange={set("vehicleType")} placeholder="All vehicle types" options={VEHICLE_TYPE_OPTIONS} /></div>
          <div><label className="lbl" htmlFor="f-pay">Payment status</label><Select id="f-pay" value={filters.payment} onChange={set("payment")} placeholder="Any" options={PAYMENT_OPTIONS} /></div>
          <div><label className="lbl" htmlFor="f-off">Assigned officer</label><Select id="f-off" value={filters.officer} onChange={set("officer")} placeholder="Anyone" options={officers} /></div>
          <div><label className="lbl" htmlFor="f-from">Submitted from</label><Input id="f-from" type="date" value={filters.from} onChange={set("from")} /></div>
          <div><label className="lbl" htmlFor="f-to">Submitted to</label><Input id="f-to" type="date" value={filters.to} onChange={set("to")} /></div>
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={() => reload()} /> : (
        <DataTable
          storageKey="applications"
          data={data ? filtered : undefined}
          loading={loading}
          columns={columns}
          onRowClick={(r) => router.push(openHref(r.app))}
          mobileCard={(r) => (
            <MobileCard
              href={openHref(r.app)}
              title={r.app.transactionNumber}
              badge={<StatusBadge kind="registration" status={r.app.status} />}
              lines={[fullName(r.owner), `${transactionLabel(r.app.type, true)} · ${vehicleLabel(r.vehicle)} · ${vehicleTypeLabel(typeOf(r))}`, <StatusBadge key="p" kind="application-payment" status={r.payment} />]}
              footer={<><span className="font-extrabold">{r.app.assessment ? formatMoney(r.app.assessment.total) : "—"}</span><span className="btn btn-p btn-sm">{actionLabel(r.app)}</span></>}
            />
          )}
          empty={{ title: "No applications found", message: "No motor vehicle transactions match these filters.", action: can("registration.create") ? { label: "New Vehicle Transaction", href: "/registrations/new" } : undefined }}
        />
      )}
    </div>
  );
}

export default function RegistrationsPage() {
  return (
    <Suspense fallback={null}>
      <ApplicationsList />
    </Suspense>
  );
}
