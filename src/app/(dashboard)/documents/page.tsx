"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { documentLabel, DOCUMENT_TYPE_OPTIONS } from "@/config/document-requirements";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { formatDate, formatDateTime, formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import { vehicleService } from "@/services/vehicle.service";
import { paymentService } from "@/services/payment.service";
import { PageHeader, Tabs } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { PlateChip } from "@/components/registry/renewal";
import type { ApplicationDocument, DocumentStatus, DocumentType, Owner, Payment, RegistrationApplication, Vehicle } from "@/types";

type TabKey = "uploaded" | "certificates" | "receipts";
type DocRow = { doc: ApplicationDocument; app: RegistrationApplication; owner: Owner | undefined };
type CertRow = { app: RegistrationApplication; owner: Owner | undefined; vehicle: Vehicle | undefined };
type ReceiptRow = { payment: Payment; app: RegistrationApplication | undefined; owner: Owner | undefined };

const typeLabel = (t: DocumentType) => documentLabel(t);
const STATUS_OPTIONS: { value: DocumentStatus; label: string }[] = [
  { value: "uploaded", label: "Uploaded · awaiting review" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

function DocumentsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const t = params.get("tab");
  const tab: TabKey = t === "certificates" || t === "receipts" ? t : "uploaded";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);

  const data = useServiceQuery(async () => {
    const [apps, owners, vehicles, payments] = await Promise.all([registrationService.list(), ownerService.list(), vehicleService.list(), paymentService.list({ status: "successful" })]);
    return { apps, owners, vehicles, payments };
  }, []);

  const sets = useMemo(() => {
    if (!data.data) return null;
    const { apps, owners, vehicles, payments } = data.data;
    const ownerOf = (id?: string) => owners.find((o) => o.id === id);
    const docs: DocRow[] = apps.flatMap((app) => app.documents.filter((d) => d.status !== "missing").map((doc) => ({ doc, app, owner: ownerOf(app.ownerId) })));
    const certs: CertRow[] = apps
      .filter((a) => a.status === "registered" && a.certificateNumber)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .map((app) => ({ app, owner: ownerOf(app.ownerId), vehicle: vehicles.find((m) => m.id === app.vehicleId) }));
    const receipts: ReceiptRow[] = [...payments]
      .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))
      .map((payment) => {
        const app = apps.find((a) => a.id === payment.applicationId);
        return { payment, app, owner: ownerOf(app?.ownerId) };
      });
    return { docs, certs, receipts };
  }, [data.data]);

  const docs = useMemo(() => sets?.docs.filter((r) => {
    if (status && r.doc.status !== status) return false;
    if (type && r.doc.type !== type) return false;
    if (q && ![r.doc.file?.name, r.app.transactionNumber, fullName(r.owner), typeLabel(r.doc.type)].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
    return true;
  }), [sets, status, type, q]);
  const certs = useMemo(() => sets?.certs.filter((r) => !q || [r.app.transactionNumber, r.app.registrationNumber, r.app.certificateNumber, r.app.plateNumber, fullName(r.owner)].filter(Boolean).join(" ").toLowerCase().includes(q)), [sets, q]);
  const receipts = useMemo(() => sets?.receipts.filter((r) => !q || [r.payment.receiptNumber, r.payment.reference, r.app?.transactionNumber, fullName(r.owner)].filter(Boolean).join(" ").toLowerCase().includes(q)), [sets, q]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!sets) return <PageSkeleton />;

  const setTab = (v: TabKey) => router.replace(v === "uploaded" ? "/documents" : `/documents?tab=${v}`, { scroll: false });
  const filtersOn = !!(query || status || type);
  const clear = () => { setQuery(""); setStatus(""); setType(""); };
  const pendingReview = sets.docs.filter((r) => r.doc.status === "uploaded").length;

  const docCols: ColumnDef<DocRow, unknown>[] = [
    { id: "type", header: "Document type", accessorFn: (r) => typeLabel(r.doc.type) },
    { id: "file", header: "File name", accessorFn: (r) => r.doc.file?.name ?? "", cell: ({ row }) => <span className="mono text-[12.5px] break-all">{row.original.doc.file?.name ?? "—"}</span> },
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "status", header: "Status", accessorFn: (r) => r.doc.status, cell: ({ row }) => <StatusBadge kind="document" status={row.original.doc.status} /> },
    { id: "verified", header: "Verified by / at", accessorFn: (r) => r.doc.verifiedAt ?? "", cell: ({ row }) => (row.original.doc.verifiedBy ? <span className="flex flex-col"><span>{row.original.doc.verifiedBy}</span><span className="mut mono text-[12px]">{formatDateTime(row.original.doc.verifiedAt)}</span></span> : "—") },
    { id: "reason", header: "Rejection reason", accessorFn: (r) => r.doc.rejectionReason ?? "", cell: ({ row }) => (row.original.doc.rejectionReason ? <span className="text-[#a3111a]">{row.original.doc.rejectionReason}</span> : "—") },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={`/registrations/new?id=${row.original.app.id}&step=5`} className="btn btn-s btn-sm" aria-label={`Review ${typeLabel(row.original.doc.type)} for ${row.original.app.transactionNumber}`}>Review</Link> },
  ];

  const certCols: ColumnDef<CertRow, unknown>[] = [
    { id: "cert", header: "Certificate No.", accessorFn: (r) => r.app.certificateNumber ?? "", cell: ({ row }) => <span className="mono font-semibold">{row.original.app.certificateNumber}</span> },
    { id: "reg", header: "Registration No.", accessorFn: (r) => r.app.registrationNumber ?? "", cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="mono">{row.original.app.registrationNumber ?? "—"}</Link> },
    { id: "plate", header: "Plate", accessorFn: (r) => r.app.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.app.plateNumber ?? row.original.vehicle?.plateNumber} size="sm" /> },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.vehicle) },
    { id: "vtype", header: "Vehicle type", accessorFn: (r) => vehicleTypeLabel(r.vehicle?.vehicleType) },
    { id: "valid", header: "Valid to", accessorFn: (r) => r.app.expiryDate ?? "", cell: ({ row }) => <span className="mono">{formatDate(row.original.app.expiryDate)}</span> },
    { id: "print", header: "Print", enableSorting: false, cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/registrations/${row.original.app.id}?print=certificate`} className="btn btn-s btn-sm">Certificate</Link>
        <Link href={`/registrations/${row.original.app.id}?print=label`} className="btn btn-s btn-sm">Label</Link>
      </div>
    ) },
  ];

  const receiptCols: ColumnDef<ReceiptRow, unknown>[] = [
    { id: "receipt", header: "Receipt No.", accessorFn: (r) => r.payment.receiptNumber ?? "", cell: ({ row }) => <Link href={`/payments/${row.original.payment.id}`} className="mono font-semibold">{row.original.payment.receiptNumber ?? row.original.payment.reference}</Link> },
    { id: "date", header: "Paid", accessorFn: (r) => r.payment.completedAt ?? r.payment.createdAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.payment.completedAt ?? row.original.payment.createdAt)}</span> },
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app?.transactionNumber ?? "", cell: ({ row }) => (row.original.app ? <Link href={`/registrations/${row.original.app.id}`} className="mono">{row.original.app.transactionNumber}</Link> : "—") },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "method", header: "Method", accessorFn: (r) => PAYMENT_METHOD_LABELS[r.payment.method] },
    { id: "amount", header: "Amount", accessorFn: (r) => r.payment.amount, meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.payment.amount) },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={`/payments/${row.original.payment.id}`} className="btn btn-s btn-sm">View receipt</Link> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Documents" title="Documents" description={can("documents.verify") ? `${pendingReview} uploaded document${pendingReview === 1 ? "" : "s"} awaiting review. Verify or reject documents on the application.` : "Uploaded application documents and printable records."} />

      <Tabs<TabKey>
        label="Document sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "uploaded", label: "Application documents", count: sets.docs.length },
          { value: "certificates", label: "Registration Certificates & Labels", count: sets.certs.length },
          { value: "receipts", label: "Receipts", count: sets.receipts.length },
        ]}
      />

      <section className="card sec" aria-label="Search and filters">
        <div className="form">
          <Field label="Search" htmlFor="doc-q" className={tab === "uploaded" ? "" : "full"}>
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
              <Input id="doc-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="!pl-10" autoComplete="off"
                placeholder={tab === "uploaded" ? "File, transaction or owner" : tab === "certificates" ? "Certificate, registration, plate or owner" : "Receipt, reference, transaction or owner"} />
            </div>
          </Field>
          {tab === "uploaded" && (
            <>
              <Field label="Status" htmlFor="doc-status">
                <Select id="doc-status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={STATUS_OPTIONS} />
              </Field>
              <Field label="Document type" htmlFor="doc-type">
                <Select id="doc-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="All types" options={DOCUMENT_TYPE_OPTIONS} />
              </Field>
            </>
          )}
        </div>
        {filtersOn && <div><button type="button" className="btn btn-g btn-sm min-h-[44px]" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button></div>}
      </section>

      {tab === "uploaded" && (
        <DataTable storageKey="documents" data={docs} loading={data.loading} columns={docCols}
          mobileCard={(r) => (
            <MobileCard href={`/registrations/new?id=${r.app.id}&step=5`} title={r.app.transactionNumber} badge={<StatusBadge kind="document" status={r.doc.status} />}
              lines={[typeLabel(r.doc.type), `${fullName(r.owner)} · ${r.doc.file?.name ?? "—"}`]}
              footer={r.doc.rejectionReason ? <span className="text-[12px] text-[#a3111a]">Rejected: {r.doc.rejectionReason}</span> : r.doc.verifiedBy ? <span className="mut text-[12px]">Verified by {r.doc.verifiedBy} · {formatDate(r.doc.verifiedAt)}</span> : <span className="text-[12px] font-semibold text-[#1515e8]">Review</span>} />
          )}
          empty={{ title: "No documents", message: filtersOn ? "No documents match the current filters." : "No application documents have been uploaded yet.", action: filtersOn ? { label: "Clear filters", onClick: clear } : undefined }} />
      )}

      {tab === "certificates" && (
        <DataTable storageKey="documents-certs" data={certs} loading={data.loading} columns={certCols}
          mobileCard={(r) => (
            <div className="card flex flex-col gap-2 p-3.5">
              <div className="flex items-center justify-between gap-2"><span className="mono text-[12.5px] font-semibold">{r.app.certificateNumber}</span><PlateChip plate={r.app.plateNumber ?? r.vehicle?.plateNumber} size="sm" /></div>
              <Link href={`/registrations/${r.app.id}`} className="text-[15px] font-bold text-[#0b0b0f]">{fullName(r.owner)}</Link>
              <p className="mut m-0 text-[13px]">{vehicleLabel(r.vehicle)} · valid to {formatDate(r.app.expiryDate)}</p>
              <div className="flex gap-2 border-t border-[#edeff3] pt-2.5">
                <Link href={`/registrations/${r.app.id}?print=certificate`} className="btn btn-s btn-sm min-h-[44px] flex-1">Certificate</Link>
                <Link href={`/registrations/${r.app.id}?print=label`} className="btn btn-s btn-sm min-h-[44px] flex-1">Label</Link>
              </div>
            </div>
          )}
          empty={{ title: "No certificates", message: q ? "No registered applications match your search." : "Certificates become available once a transaction is completed." }} />
      )}

      {tab === "receipts" && (
        <DataTable storageKey="documents-receipts" data={receipts} loading={data.loading} columns={receiptCols}
          mobileCard={(r) => (
            <MobileCard href={`/payments/${r.payment.id}`} title={r.payment.receiptNumber ?? r.payment.reference} badge={<StatusBadge kind="payment" status={r.payment.status} />}
              lines={[fullName(r.owner), `${PAYMENT_METHOD_LABELS[r.payment.method]} · ${r.app?.transactionNumber ?? "—"}`]}
              footer={<><span className="font-extrabold">{formatMoney(r.payment.amount)}</span><span className="mut text-[12px]">{formatDateTime(r.payment.completedAt ?? r.payment.createdAt)}</span></>} />
          )}
          empty={{ title: "No receipts", message: q ? "No receipts match your search." : "Receipts appear here after a successful payment." }} />
      )}
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DocumentsInner />
    </Suspense>
  );
}
