"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import { motorcycleService } from "@/services/motorcycle.service";
import { paymentService } from "@/services/payment.service";
import { useServiceQuery } from "@/hooks/use-service";
import { formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Breadcrumbs, KpiCard, PageHeader } from "@/components/ui/layout-bits";
import { ErrorState } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/status-badge";

export default function ApprovalQueuePage() {
  const router = useRouter();
  const { data, loading, error, reload } = useServiceQuery(async () => {
    const [apps, owners, motos, pays] = await Promise.all([registrationService.list({ status: ["for_approval", "approved", "returned"] }), ownerService.list(), motorcycleService.list(), paymentService.list()]);
    return apps.map((a) => {
      const docsVerified = a.type === "renewal" || a.documents.filter((d) => ["owner_identification", "proof_of_ownership", "import_purchase"].includes(d.type)).every((d) => d.status === "verified");
      return { app: a, owner: owners.find((o) => o.id === a.ownerId), moto: motos.find((m) => m.id === a.motorcycleId), payment: pays.find((p) => p.applicationId === a.id && p.status === "successful"), docsVerified };
    });
  }, []);
  type Row = NonNullable<typeof data>[number];
  const waiting = (data ?? []).filter((r) => r.app.status === "for_approval");

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "type", header: "Type", accessorFn: (r) => r.app.type, cell: ({ row }) => (row.original.app.type === "new" ? "New" : "Renewal") },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (r) => motorcycleLabel(r.moto) },
    { id: "paid", header: "Paid", meta: { align: "right" }, accessorFn: (r) => r.payment?.amount ?? 0, cell: ({ row }) => (row.original.payment ? formatMoney(row.original.payment.amount) : "—") },
    { id: "docs", header: "Documents", accessorFn: (r) => (r.docsVerified ? 1 : 0), cell: ({ row }) => (row.original.docsVerified ? <Badge tone="ok">Verified</Badge> : <Badge tone="pend">Needs review</Badge>) },
    { id: "status", header: "Status", accessorFn: (r) => r.app.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "since", header: "Paid at", accessorFn: (r) => r.payment?.completedAt ?? "", cell: ({ row }) => <span className="mono text-[12.5px]">{formatDateTime(row.original.payment?.completedAt)}</span> },
    { id: "act", header: "", enableSorting: false, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="btn btn-p btn-sm">{row.original.app.status === "for_approval" ? "Review" : "View"}</Link> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Registrations", href: "/registrations" }, { label: "Approval Queue" }]} />
      <PageHeader title="Approval Queue" description="Paid applications waiting for a supervisor decision. Approval requires passed inspection, verified insurance, successful payment, verified documents and a valid assessment." />
      <div className="g4">
        <KpiCard label="Waiting for approval" value={waiting.length} />
        <KpiCard label="Documents need review" value={waiting.filter((r) => !r.docsVerified).length} />
        <KpiCard label="Approved · awaiting plate" value={(data ?? []).filter((r) => r.app.status === "approved").length} href="/plates?tab=assign" />
        <KpiCard label="Returned for correction" value={(data ?? []).filter((r) => r.app.status === "returned").length} href="/registrations?status=returned" />
      </div>
      {error ? <ErrorState message={error} onRetry={() => reload()} /> : (
        <DataTable
          storageKey="approval"
          data={data}
          loading={loading}
          columns={columns}
          onRowClick={(r) => router.push(`/registrations/${r.app.id}`)}
          mobileCard={(r) => <MobileCard href={`/registrations/${r.app.id}`} title={r.app.transactionNumber} badge={<StatusBadge kind="registration" status={r.app.status} />} lines={[fullName(r.owner), motorcycleLabel(r.moto)]} footer={<><span className="font-extrabold">{r.payment ? formatMoney(r.payment.amount) : "—"}</span>{r.docsVerified ? <Badge tone="ok">Docs verified</Badge> : <Badge tone="pend">Docs review</Badge>}</>} />}
          empty={{ title: "Approval queue is empty", message: "No paid applications are waiting for supervisor approval." }}
        />
      )}
    </div>
  );
}
