"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { formatDate, formatDateTime, fullName, motorcycleLabel } from "@/lib/formatting";
import { inspectionService } from "@/services/inspection.service";
import { registrationService } from "@/services/registration.service";
import { motorcycleService } from "@/services/motorcycle.service";
import { ownerService } from "@/services/owner.service";
import { userService } from "@/services/user.service";
import type { InspectionQueueItem } from "@/services/interfaces";
import { KpiCard, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { Field, Input } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import type { Inspection, InspectionStatus, Motorcycle, Owner, RegistrationApplication } from "@/types";

type TabKey = "waiting" | "in_progress" | "failed" | "passed" | "reinspection" | "history";
const TAB_STATUSES: Record<Exclude<TabKey, "history">, InspectionStatus[]> = {
  waiting: ["not_inspected", "scheduled"],
  in_progress: ["in_progress"],
  failed: ["failed"],
  passed: ["passed"],
  reinspection: ["reinspection_required"],
};
const ACTIONABLE: InspectionStatus[] = ["not_inspected", "scheduled", "in_progress", "reinspection_required"];
const TAB_KEYS: TabKey[] = ["waiting", "in_progress", "failed", "passed", "reinspection", "history"];

type HistoryRow = { insp: Inspection; app: RegistrationApplication | undefined; moto: Motorcycle | undefined; owner: Owner | undefined };

function InspectionsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw && TAB_KEYS.includes(raw) ? raw : "waiting";
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);

  const data = useServiceQuery(async () => {
    const [queue, inspections, apps, motos, owners, users, centers] = await Promise.all([
      inspectionService.queue(),
      inspectionService.list(),
      registrationService.list(),
      motorcycleService.list(),
      ownerService.list(),
      userService.list(),
      inspectionService.listCenters(),
    ]);
    const history: HistoryRow[] = inspections.map((insp) => {
      const app = apps.find((a) => a.id === insp.applicationId);
      return { insp, app, moto: motos.find((m) => m.id === insp.motorcycleId), owner: owners.find((o) => o.id === app?.ownerId) };
    });
    return { queue, history, users, centers };
  }, []);

  const filtered = useMemo(() => {
    if (!data.data) return null;
    const match = (parts: (string | undefined)[]) => !q || parts.filter(Boolean).join(" ").toLowerCase().includes(q);
    const queue = data.data.queue.filter((i) => match([i.application.transactionNumber, fullName(i.owner), motorcycleLabel(i.motorcycle), i.motorcycle?.engineNumber, i.motorcycle?.chassisNumber, i.motorcycle?.plateNumber]));
    const history = data.data.history.filter((h) => match([h.app?.transactionNumber, fullName(h.owner), motorcycleLabel(h.moto), h.insp.certificateNumber, h.moto?.engineNumber]));
    return { queue, history };
  }, [data.data, q]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!data.data || !filtered) return <PageSkeleton />;

  const { users, centers, queue: fullQueue } = data.data;
  const userName = (id?: string) => { const u = users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : "—"; };
  const centerName = (id?: string) => centers.find((c) => c.id === id)?.name ?? "—";
  const countOf = (k: Exclude<TabKey, "history">, list = fullQueue) => list.filter((i) => TAB_STATUSES[k].includes(i.status)).length;
  const setTab = (v: TabKey) => router.replace(v === "waiting" ? "/inspections" : `/inspections?tab=${v}`, { scroll: false });
  const canInspect = can("inspection.submit");
  const rows = tab === "history" ? [] : filtered.queue.filter((i) => TAB_STATUSES[tab].includes(i.status));

  const actionFor = (i: InspectionQueueItem) => {
    const inspect = canInspect && ACTIONABLE.includes(i.status) && i.application.status === "for_inspection";
    return (
      <Link href={`/inspections/${i.application.id}`} className={`btn btn-sm ${inspect ? "btn-p" : "btn-s"}`} aria-label={`${inspect ? "Inspect" : "View"} ${i.application.transactionNumber}`}>
        {inspect ? (i.status === "in_progress" ? "Continue" : "Inspect") : "View"}
      </Link>
    );
  };

  const queueCols: ColumnDef<InspectionQueueItem, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (i) => i.application.transactionNumber, cell: ({ row }) => <Link href={`/inspections/${row.original.application.id}`} className="mono font-semibold">{row.original.application.transactionNumber}</Link> },
    { id: "owner", header: "Owner", accessorFn: (i) => fullName(i.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (i) => motorcycleLabel(i.motorcycle) },
    { id: "province", header: "Province", accessorFn: (i) => i.motorcycle?.provinceOfOperation ?? "—" },
    { id: "submitted", header: "Submitted", accessorFn: (i) => i.application.submittedAt ?? "", cell: ({ row }) => <span className="mono">{formatDateTime(row.original.application.submittedAt)}</span> },
    { id: "status", header: "Status", accessorFn: (i) => i.status, cell: ({ row }) => <StatusBadge kind="inspection" status={row.original.status} /> },
    { id: "inspector", header: "Inspector", accessorFn: (i) => userName(i.inspection?.inspectorId) },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => actionFor(row.original) },
  ];

  const historyCols: ColumnDef<HistoryRow, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (h) => h.insp.submittedAt ?? h.insp.inspectionDate ?? h.insp.updatedAt, cell: ({ row }) => <span className="mono">{formatDate(row.original.insp.submittedAt ?? row.original.insp.inspectionDate ?? row.original.insp.updatedAt)}</span> },
    { id: "txn", header: "Transaction", accessorFn: (h) => h.app?.transactionNumber ?? "", cell: ({ row }) => <Link href={`/inspections/${row.original.insp.applicationId}`} className="mono font-semibold">{row.original.app?.transactionNumber ?? "—"}</Link> },
    { id: "moto", header: "Motorcycle", accessorFn: (h) => motorcycleLabel(h.moto) },
    { id: "attempt", header: "Attempt", accessorFn: (h) => h.insp.attempt, meta: { align: "right" } },
    { id: "result", header: "Result", accessorFn: (h) => h.insp.status, cell: ({ row }) => <StatusBadge kind="inspection" status={row.original.insp.status} /> },
    { id: "cert", header: "Certificate", accessorFn: (h) => h.insp.certificateNumber ?? "", cell: ({ row }) => (row.original.insp.certificateNumber ? <span className="mono">{row.original.insp.certificateNumber}</span> : row.original.insp.failureReason ? <span className="text-[#a3111a]">{row.original.insp.failureReason}</span> : "—") },
    { id: "centre", header: "Centre", accessorFn: (h) => centerName(h.insp.centerId) },
    { id: "inspector", header: "Inspector", accessorFn: (h) => userName(h.insp.inspectorId) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Inspection" title="Roadworthiness Inspections" description="Inspection queue for new registrations and renewals. Open a transaction to schedule, inspect and record the result." />

      <div className="g4">
        <KpiCard label="Waiting for inspection" value={countOf("waiting")} footer="Not inspected or scheduled" />
        <KpiCard label="In progress" value={countOf("in_progress")} footer="Checklist started" />
        <KpiCard tone="danger" label="Failed" value={countOf("failed")} footer="Awaiting reinspection request" />
        <KpiCard label="Reinspection" value={countOf("reinspection")} footer="Reinspection scheduled" />
      </div>

      <Tabs<TabKey>
        label="Inspection queues"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "waiting", label: "Waiting for Inspection", count: countOf("waiting", filtered.queue) },
          { value: "in_progress", label: "In Progress", count: countOf("in_progress", filtered.queue) },
          { value: "failed", label: "Failed", count: countOf("failed", filtered.queue) },
          { value: "passed", label: "Passed", count: countOf("passed", filtered.queue) },
          { value: "reinspection", label: "Reinspection", count: countOf("reinspection", filtered.queue) },
          { value: "history", label: "History", count: filtered.history.length },
        ]}
      />

      <Field label="Search" htmlFor="insp-q" help="Transaction, owner, motorcycle, engine number or plate">
        <div className="relative max-w-xl">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
          <Input id="insp-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="!pl-10" autoComplete="off" />
        </div>
      </Field>

      <div role="tabpanel" aria-label="Inspection records">
        {tab === "history" ? (
          <DataTable key="history" storageKey="inspections-history" data={filtered.history} loading={data.loading} columns={historyCols}
            mobileCard={(h) => (
              <MobileCard href={`/inspections/${h.insp.applicationId}`} title={h.app?.transactionNumber ?? "—"} badge={<StatusBadge kind="inspection" status={h.insp.status} />}
                lines={[motorcycleLabel(h.moto), `Attempt ${h.insp.attempt} · ${centerName(h.insp.centerId)} · ${userName(h.insp.inspectorId)}`]}
                footer={<><span className="mono text-[12px]">{h.insp.certificateNumber ?? h.insp.failureReason ?? "—"}</span><span className="mut text-[12px]">{formatDate(h.insp.submittedAt ?? h.insp.inspectionDate ?? h.insp.updatedAt)}</span></>} />
            )}
            empty={{ title: "No inspection records", message: q ? "No inspections match your search." : "No inspections have been recorded yet." }} />
        ) : (
          <DataTable key={tab} storageKey="inspections-queue" data={rows} loading={data.loading} columns={queueCols}
            mobileCard={(i) => (
              <div className="card flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/inspections/${i.application.id}`} className="mono truncate text-[12.5px] font-semibold">{i.application.transactionNumber}</Link>
                  <StatusBadge kind="inspection" status={i.status} />
                </div>
                <p className="m-0 text-[15px] font-bold">{fullName(i.owner)}</p>
                <p className="mut m-0 text-[13px]">{motorcycleLabel(i.motorcycle)} · {i.motorcycle?.provinceOfOperation ?? "—"}</p>
                <div className="flex items-center justify-between gap-2 border-t border-[#edeff3] pt-2.5">
                  <span className="mut text-[12px]">Submitted {formatDateTime(i.application.submittedAt)}{i.inspection?.inspectorId ? ` · ${userName(i.inspection.inspectorId)}` : ""}</span>
                  <span className="[&_.btn]:min-h-[44px]">{actionFor(i)}</span>
                </div>
              </div>
            )}
            empty={{ title: "Queue is empty", message: q ? "No inspections in this queue match your search." : "There are no motorcycles in this inspection queue." }} />
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
