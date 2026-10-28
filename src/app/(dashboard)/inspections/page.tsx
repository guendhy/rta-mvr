"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { INSPECTION_STATUS } from "@/config/statuses";
import { TRANSACTION_TYPE_OPTIONS, transactionLabel } from "@/config/transaction-types";
import { VEHICLE_TYPE_OPTIONS, vehicleTypeLabel } from "@/config/vehicle-types";
import { formatDate, formatDateTime, fullName, vehicleLabel } from "@/lib/formatting";
import { inspectionService } from "@/services/inspection.service";
import { registrationService } from "@/services/registration.service";
import { vehicleService } from "@/services/vehicle.service";
import { ownerService } from "@/services/owner.service";
import { userService } from "@/services/user.service";
import type { InspectionQueueItem } from "@/services/interfaces";
import { KpiCard, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import type { Inspection, InspectionStatus, Owner, RegistrationApplication, Vehicle } from "@/types";

type QueueTab = "waiting" | "in_progress" | "reinspection" | "failed" | "conditional" | "passed";
type TabKey = QueueTab | "history";
const TAB_STATUSES: Record<QueueTab, InspectionStatus[]> = {
  waiting: ["not_inspected", "scheduled"],
  in_progress: ["in_progress"],
  reinspection: ["reinspection_required"],
  failed: ["failed"],
  conditional: ["conditional"],
  passed: ["passed"],
};
const ACTIONABLE: InspectionStatus[] = ["not_inspected", "scheduled", "in_progress", "reinspection_required"];
const TAB_KEYS: TabKey[] = ["waiting", "in_progress", "reinspection", "failed", "conditional", "passed", "history"];

type HistoryRow = { insp: Inspection; app: RegistrationApplication | undefined; vehicle: Vehicle | undefined; owner: Owner | undefined };

function VehicleTypeCell({ vehicle }: { vehicle: Vehicle | null | undefined }) {
  if (!vehicle) return <span className="mut">—</span>;
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><VehicleIcon type={vehicle.vehicleType} size={16} />{vehicleTypeLabel(vehicle.vehicleType)}</span>;
}

function InspectionsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw && TAB_KEYS.includes(raw) ? raw : "waiting";
  const [query, setQuery] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [txnType, setTxnType] = useState("");
  const [result, setResult] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);

  const data = useServiceQuery(async () => {
    const [queue, inspections, apps, vehicles, owners, users, centers] = await Promise.all([
      inspectionService.queue(),
      inspectionService.list(),
      registrationService.list(),
      vehicleService.list(),
      ownerService.list(),
      userService.list(),
      inspectionService.listCenters(),
    ]);
    const history: HistoryRow[] = inspections
      .filter((i) => i.submittedAt || ["passed", "failed", "conditional", "reinspection_required"].includes(i.status))
      .map((insp) => {
        const app = apps.find((a) => a.id === insp.applicationId);
        return { insp, app, vehicle: vehicles.find((v) => v.id === insp.vehicleId), owner: owners.find((o) => o.id === app?.ownerId) };
      });
    return { queue, history, users, centers };
  }, []);

  const filtered = useMemo(() => {
    if (!data.data) return null;
    const match = (parts: (string | undefined)[]) => !q || parts.filter(Boolean).join(" ").toLowerCase().includes(q);
    const typeOk = (v: Vehicle | null | undefined, a: RegistrationApplication | undefined) => (!vehicleType || v?.vehicleType === vehicleType) && (!txnType || a?.type === txnType);
    const queue = data.data.queue.filter((i) => typeOk(i.vehicle, i.application) && match([i.application.transactionNumber, i.inspection?.reference, fullName(i.owner), vehicleLabel(i.vehicle), i.vehicle?.vin, i.vehicle?.engineNumber, i.vehicle?.chassisNumber, i.vehicle?.plateNumber, i.vehicle?.registrationNumber]));
    const history = data.data.history.filter((h) => typeOk(h.vehicle, h.app) && (!result || h.insp.status === result) && match([h.app?.transactionNumber, h.insp.reference, fullName(h.owner), vehicleLabel(h.vehicle), h.insp.certificateNumber, h.vehicle?.vin, h.vehicle?.engineNumber, h.vehicle?.plateNumber]));
    return { queue, history };
  }, [data.data, q, vehicleType, txnType, result]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!data.data || !filtered) return <PageSkeleton />;

  const { users, centers, queue: fullQueue } = data.data;
  const userName = (id?: string) => { const u = users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : "—"; };
  const centerName = (id?: string) => centers.find((c) => c.id === id)?.name ?? "—";
  const countOf = (k: QueueTab, list = fullQueue) => list.filter((i) => TAB_STATUSES[k].includes(i.status)).length;
  const setTab = (v: TabKey) => router.replace(v === "waiting" ? "/inspections" : `/inspections?tab=${v}`, { scroll: false });
  const canInspect = can("inspection.submit");
  const rows = tab === "history" ? [] : filtered.queue.filter((i) => TAB_STATUSES[tab].includes(i.status));
  const filtersOn = !!(query || vehicleType || txnType || (tab === "history" && result));
  const clear = () => { setQuery(""); setVehicleType(""); setTxnType(""); setResult(""); };

  const actionFor = (i: InspectionQueueItem) => {
    const inspect = canInspect && ACTIONABLE.includes(i.status) && i.application.status === "for_inspection";
    return (
      <Link href={`/inspections/${i.application.id}`} className={`btn btn-sm ${inspect ? "btn-p" : "btn-s"}`} aria-label={`${inspect ? "Inspect" : "View"} ${i.application.transactionNumber}`}>
        {inspect ? (i.status === "in_progress" ? "Continue" : i.status === "reinspection_required" ? "Reinspect" : "Inspect") : "View"}
      </Link>
    );
  };

  const queueCols: ColumnDef<InspectionQueueItem, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (i) => i.application.transactionNumber, cell: ({ row }) => (
      <span className="flex flex-col"><Link href={`/inspections/${row.original.application.id}`} className="mono font-semibold">{row.original.application.transactionNumber}</Link><span className="mut text-[12px]">{transactionLabel(row.original.application.type, true)}</span></span>
    ) },
    { id: "ref", header: "Inspection ref.", accessorFn: (i) => i.inspection?.reference ?? "", cell: ({ row }) => <span className="mono text-[12.5px]">{row.original.inspection?.reference ?? "—"}</span> },
    { id: "owner", header: "Owner", accessorFn: (i) => fullName(i.owner) },
    { id: "vehicle", header: "Vehicle", accessorFn: (i) => vehicleLabel(i.vehicle), cell: ({ row }) => (
      <span className="flex flex-col"><span>{vehicleLabel(row.original.vehicle)}</span>{row.original.vehicle?.plateNumber && <span className="mono mut text-[12px]">{row.original.vehicle.plateNumber}</span>}</span>
    ) },
    { id: "vtype", header: "Vehicle type", accessorFn: (i) => vehicleTypeLabel(i.vehicle?.vehicleType), cell: ({ row }) => <VehicleTypeCell vehicle={row.original.vehicle} /> },
    { id: "province", header: "Province", accessorFn: (i) => i.vehicle?.provinceOfOperation ?? "—" },
    { id: "submitted", header: "Submitted", accessorFn: (i) => i.application.submittedAt ?? "", cell: ({ row }) => <span className="mono">{formatDateTime(row.original.application.submittedAt)}</span> },
    { id: "status", header: "Status", accessorFn: (i) => i.status, cell: ({ row }) => <StatusBadge kind="inspection" status={row.original.status} /> },
    { id: "inspector", header: "Inspector", accessorFn: (i) => userName(i.inspection?.inspectorId) },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => actionFor(row.original) },
  ];

  const historyCols: ColumnDef<HistoryRow, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (h) => h.insp.submittedAt ?? h.insp.inspectionDate ?? h.insp.updatedAt, cell: ({ row }) => <span className="mono">{formatDate(row.original.insp.submittedAt ?? row.original.insp.inspectionDate ?? row.original.insp.updatedAt)}</span> },
    { id: "ref", header: "Inspection ref.", accessorFn: (h) => h.insp.reference ?? "", cell: ({ row }) => <Link href={`/inspections/${row.original.insp.applicationId}`} className="mono font-semibold">{row.original.insp.reference ?? "—"}</Link> },
    { id: "txn", header: "Transaction", accessorFn: (h) => h.app?.transactionNumber ?? "", cell: ({ row }) => (
      <span className="flex flex-col"><span className="mono">{row.original.app?.transactionNumber ?? "—"}</span><span className="mut text-[12px]">{transactionLabel(row.original.app?.type, true)}</span></span>
    ) },
    { id: "vehicle", header: "Vehicle", accessorFn: (h) => vehicleLabel(h.vehicle) },
    { id: "vtype", header: "Vehicle type", accessorFn: (h) => vehicleTypeLabel(h.vehicle?.vehicleType), cell: ({ row }) => <VehicleTypeCell vehicle={row.original.vehicle} /> },
    { id: "attempt", header: "Attempt", accessorFn: (h) => h.insp.attempt, meta: { align: "right" } },
    { id: "result", header: "Result", accessorFn: (h) => h.insp.status, cell: ({ row }) => <StatusBadge kind="inspection" status={row.original.insp.status} /> },
    { id: "cert", header: "Certificate / reason", accessorFn: (h) => h.insp.certificateNumber ?? h.insp.failureReason ?? "", cell: ({ row }) => (row.original.insp.certificateNumber ? <span className="mono">{row.original.insp.certificateNumber}</span> : row.original.insp.failureReason ? <span className="text-[#a3111a]">{row.original.insp.failureReason}</span> : "—") },
    { id: "centre", header: "Location", accessorFn: (h) => h.insp.location || centerName(h.insp.centerId) },
    { id: "inspector", header: "Inspector", accessorFn: (h) => userName(h.insp.inspectorId) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Inspection" title="Motor Vehicle Inspections" description="Inspection queue for every vehicle type and transaction that requires one. Open a transaction to schedule, inspect and record the result." />

      <div className="g4">
        <KpiCard label="Waiting for inspection" value={countOf("waiting")} footer="Not inspected or scheduled" />
        <KpiCard label="In progress" value={countOf("in_progress")} footer="Checklist started" />
        <KpiCard tone="danger" label="Failed / reinspection" value={countOf("failed") + countOf("reinspection")} footer="Awaiting repairs or reinspection" />
        <KpiCard label="Conditional approvals" value={countOf("conditional")} footer="Passed with repair conditions" />
      </div>

      <Tabs<TabKey>
        label="Inspection queues"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "waiting", label: "Waiting", count: countOf("waiting", filtered.queue) },
          { value: "in_progress", label: "In Progress", count: countOf("in_progress", filtered.queue) },
          { value: "reinspection", label: "Requires Reinspection", count: countOf("reinspection", filtered.queue) },
          { value: "failed", label: "Failed", count: countOf("failed", filtered.queue) },
          { value: "conditional", label: "Conditional", count: countOf("conditional", filtered.queue) },
          { value: "passed", label: "Passed", count: countOf("passed", filtered.queue) },
          { value: "history", label: "History", count: filtered.history.length },
        ]}
      />

      <section className="card sec" aria-label="Search and filters">
        <div className="form">
          <Field label="Search" htmlFor="insp-q">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
              <Input id="insp-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="!pl-10" autoComplete="off" placeholder="Transaction, reference, owner, vehicle, VIN or plate" />
            </div>
          </Field>
          <Field label="Vehicle type" htmlFor="insp-vt">
            <Select id="insp-vt" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="All vehicle types" options={VEHICLE_TYPE_OPTIONS} />
          </Field>
          <Field label="Transaction type" htmlFor="insp-tt">
            <Select id="insp-tt" value={txnType} onChange={(e) => setTxnType(e.target.value)} placeholder="All transaction types" options={TRANSACTION_TYPE_OPTIONS} />
          </Field>
          {tab === "history" && (
            <Field label="Result" htmlFor="insp-res">
              <Select id="insp-res" value={result} onChange={(e) => setResult(e.target.value)} placeholder="All results" options={(["passed", "conditional", "failed", "reinspection_required"] as InspectionStatus[]).map((s) => ({ value: s, label: INSPECTION_STATUS[s].label }))} />
            </Field>
          )}
        </div>
        {filtersOn && <div><button type="button" className="btn btn-g btn-sm min-h-[44px]" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button></div>}
      </section>

      <div role="tabpanel" aria-label="Inspection records">
        {tab === "history" ? (
          <DataTable key="history" storageKey="inspections-history" data={filtered.history} loading={data.loading} columns={historyCols}
            mobileCard={(h) => (
              <MobileCard href={`/inspections/${h.insp.applicationId}`} title={h.insp.reference ?? h.app?.transactionNumber ?? "—"} badge={<StatusBadge kind="inspection" status={h.insp.status} />}
                lines={[`${vehicleLabel(h.vehicle)} · ${vehicleTypeLabel(h.vehicle?.vehicleType)}`, `${h.app?.transactionNumber ?? "—"} · attempt ${h.insp.attempt}`, `${h.insp.location || centerName(h.insp.centerId)} · ${userName(h.insp.inspectorId)}`]}
                footer={<><span className="mono text-[12px]">{h.insp.certificateNumber ?? h.insp.failureReason ?? "—"}</span><span className="mut text-[12px]">{formatDate(h.insp.submittedAt ?? h.insp.inspectionDate ?? h.insp.updatedAt)}</span></>} />
            )}
            empty={{ title: "No inspection records", message: filtersOn ? "No inspections match the current filters." : "No inspections have been recorded yet.", action: filtersOn ? { label: "Clear filters", onClick: clear } : undefined }} />
        ) : (
          <DataTable key={tab} storageKey="inspections-queue" data={rows} loading={data.loading} columns={queueCols}
            mobileCard={(i) => (
              <div className="card flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/inspections/${i.application.id}`} className="mono truncate text-[12.5px] font-semibold">{i.application.transactionNumber}</Link>
                  <StatusBadge kind="inspection" status={i.status} />
                </div>
                <p className="m-0 text-[15px] font-bold">{fullName(i.owner)}</p>
                <p className="mut m-0 flex items-center gap-1.5 text-[13px]"><VehicleIcon type={i.vehicle?.vehicleType} size={15} />{vehicleLabel(i.vehicle)} · {vehicleTypeLabel(i.vehicle?.vehicleType)}</p>
                <p className="mut m-0 text-[12.5px]">{transactionLabel(i.application.type, true)} · {i.vehicle?.provinceOfOperation ?? "—"}{i.inspection?.reference ? ` · ${i.inspection.reference}` : ""}</p>
                <div className="flex items-center justify-between gap-2 border-t border-[#edeff3] pt-2.5">
                  <span className="mut text-[12px]">Submitted {formatDateTime(i.application.submittedAt)}{i.inspection?.inspectorId ? ` · ${userName(i.inspection.inspectorId)}` : ""}</span>
                  <span className="[&_.btn]:min-h-[44px]">{actionFor(i)}</span>
                </div>
              </div>
            )}
            empty={{ title: "Queue is empty", message: filtersOn ? "No inspections in this queue match the current filters." : "There are no vehicles in this inspection queue.", action: filtersOn ? { label: "Clear filters", onClick: clear } : undefined }} />
        )}
      </div>
    </div>
  );
}

export default function InspectionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InspectionsInner />
    </Suspense>
  );
}
