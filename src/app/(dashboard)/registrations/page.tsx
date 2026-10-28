"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import { motorcycleService } from "@/services/motorcycle.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { useServiceQuery } from "@/hooks/use-service";
import { REGISTRATION_STATUS } from "@/lib/constants";
import { formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Input, Select } from "@/components/ui/form";
import { Breadcrumbs, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { ErrorState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RegistrationApplication, RegistrationStatus } from "@/types";

const GROUPS: { value: string; label: string; statuses?: RegistrationStatus[] }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending", statuses: ["draft", "pending"] },
  { value: "for_inspection", label: "For Inspection", statuses: ["for_inspection", "inspection_failed"] },
  { value: "insurance", label: "Insurance / Assessment", statuses: ["for_insurance_verification", "for_assessment"] },
  { value: "payment_required", label: "For Payment", statuses: ["payment_required"] },
  { value: "for_approval", label: "For Approval", statuses: ["for_approval", "approved"] },
  { value: "registered", label: "Completed", statuses: ["registered"] },
  { value: "returned", label: "Returned", statuses: ["returned"] },
  { value: "rejected", label: "Rejected", statuses: ["rejected", "cancelled"] },
];

function openHref(a: RegistrationApplication) {
  return ["registered", "rejected", "cancelled"].includes(a.status) ? `/registrations/${a.id}` : `/registrations/new?id=${a.id}`;
}

function RegistrationsList() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const group = params.get("status") ?? "all";
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const query = useDebouncedValue(q, 300);

  const { data, loading, error, reload } = useServiceQuery(async () => {
    const [apps, owners, motos] = await Promise.all([registrationService.list({ query }), ownerService.list(), motorcycleService.list()]);
    return apps.map((a) => ({ app: a, owner: owners.find((o) => o.id === a.ownerId) ?? null, moto: motos.find((m) => m.id === a.motorcycleId) ?? null }));
  }, [query]);

  type Row = NonNullable<typeof data>[number];
  const filtered = useMemo(() => {
    const g = GROUPS.find((x) => x.value === group);
    return (data ?? []).filter((r) => (!g?.statuses || g.statuses.includes(r.app.status)) && (!type || r.app.type === type));
  }, [data, group, type]);

  const counts = useMemo(() => Object.fromEntries(GROUPS.map((g) => [g.value, (data ?? []).filter((r) => !g.statuses || g.statuses.includes(r.app.status)).length])), [data]);

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={openHref(row.original.app)} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "type", header: "Type", accessorFn: (r) => r.app.type, cell: ({ row }) => (row.original.app.type === "new" ? "New" : "Renewal") },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (r) => motorcycleLabel(r.moto) },
    { id: "province", header: "Province", accessorFn: (r) => r.moto?.provinceOfOperation ?? "—" },
    { id: "status", header: "Status", accessorFn: (r) => REGISTRATION_STATUS[r.app.status].label, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "amount", header: "Amount", meta: { align: "right" }, accessorFn: (r) => r.app.assessment?.total ?? 0, cell: ({ row }) => (row.original.app.assessment ? formatMoney(row.original.app.assessment.total) : "—") },
    { id: "officer", header: "Officer", accessorFn: (r) => r.app.createdByName },
    { id: "updated", header: "Updated", accessorFn: (r) => r.app.updatedAt, cell: ({ row }) => <span className="mono text-[12.5px]">{formatDateTime(row.original.app.updatedAt)}</span> },
    { id: "act", header: "", enableSorting: false, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="btn btn-s btn-sm">View</Link> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Registrations" }]} />
      <PageHeader
        title={group === "all" ? "All Applications" : GROUPS.find((g) => g.value === group)?.label ?? "Applications"}
        description="Motorcycle registration and renewal applications. Open a row to continue the workflow."
        actions={can("registration.create") && <Link href="/registrations/new" className="btn btn-p"><Plus size={18} aria-hidden="true" />New Registration</Link>}
      />
      <Tabs label="Status" value={group} onChange={(v) => router.replace(v === "all" ? "/registrations" : `/registrations?status=${v}`)} tabs={GROUPS.map((g) => ({ value: g.value, label: g.label, count: counts[g.value] }))} />
      <div className="row">
        <div className="min-w-0 flex-[1_1_280px]">
          <label htmlFor="rq" className="sr">Search applications</label>
          <Input id="rq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transaction, owner, mobile, plate, VIN, engine…" />
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor="rt" className="sr">Type</label>
          <Select id="rt" value={type} onChange={(e) => setType(e.target.value)} placeholder="All types" options={[{ value: "new", label: "New registration" }, { value: "renewal", label: "Renewal" }]} />
        </div>
      </div>
      {error ? <ErrorState message={error} onRetry={() => reload()} /> : (
        <DataTable
          storageKey="registrations"
          data={data ? filtered : undefined}
          loading={loading}
          columns={columns}
          onRowClick={(r) => router.push(openHref(r.app))}
          mobileCard={(r) => (
            <MobileCard href={openHref(r.app)} title={r.app.transactionNumber} badge={<StatusBadge kind="registration" status={r.app.status} />} lines={[fullName(r.owner), `${motorcycleLabel(r.moto)} · ${r.app.type === "new" ? "New" : "Renewal"}`]} footer={<><span className="font-extrabold">{r.app.assessment ? formatMoney(r.app.assessment.total) : "—"}</span><span className="mut text-[12px]">{formatDateTime(r.app.updatedAt)}</span></>} />
          )}
          empty={{ title: "No Applications", message: "No motorcycle registration applications found.", action: can("registration.create") ? { label: "Create Registration", href: "/registrations/new" } : undefined }}
        />
      )}
    </div>
  );
}

export default function RegistrationsPage() {
  return (
    <Suspense fallback={null}>
      <RegistrationsList />
    </Suspense>
  );
}
