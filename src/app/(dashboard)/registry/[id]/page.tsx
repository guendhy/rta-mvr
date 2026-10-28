"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Award, Ban, ExternalLink, FilePlus2, PauseCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { friendlyError } from "@/lib/errors";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { documentLabel } from "@/config/document-requirements";
import { inspectionRuleText } from "@/config/inspection-checklists";
import { getStatusLabel, vehicleRegistrationState, type VehicleRegistrationState } from "@/config/statuses";
import { TRANSACTION_TYPES, transactionLabel } from "@/config/transaction-types";
import { vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { plateCategoryLabel, vehicleUsageLabel } from "@/config/vehicle-usage";
import { vehicleService } from "@/services/vehicle.service";
import { settingsService } from "@/services/settings.service";
import { inspectionService } from "@/services/inspection.service";
import { Breadcrumbs, DescriptionList, Section, Tabs } from "@/components/ui/layout-bits";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { Badge, RegistrationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { OwnerCard, VehicleCard } from "@/components/registrations/cards";
import { SpecList } from "@/components/vehicles/vehicle-specs";
import { CertificateOfRegistration, type CertificateData } from "@/components/printing/documents";
import { PrintPreview } from "@/components/printing/print-preview";
import { PlateChip, applicationHref, applicationPaymentState, daysToExpiry, expiryText, useStartTransaction } from "@/components/registry/renewal";
import type { ApplicationDocument, AuditEvent, Inspection, OwnershipPeriod, Payment, RegistrationApplication, TransactionType } from "@/types";

type TabKey = "overview" | "vehicle" | "owner" | "history" | "inspections" | "payments" | "documents" | "audit";

type HistoryRow = { key: string; date: string; label: string; app?: RegistrationApplication; detail: string; result: React.ReactNode };

/** Transactions offered under "Other transaction" (renewal and transfer have their own buttons). */
const OTHER_TRANSACTIONS: TransactionType[] = [
  "replacement_certificate",
  "replacement_plate",
  "duplicate_certificate",
  "change_vehicle",
  "change_owner",
  "reclassification",
  "registration_transfer",
  "deregistration",
  "reinstatement",
];

const OWNERSHIP_REASON: Record<OwnershipPeriod["reason"], string> = {
  first_registration: "First registration",
  transfer: "Transfer of ownership",
  legacy_import: "Imported record",
  reinstatement: "Reinstatement",
};

const CURRENT_STATES: VehicleRegistrationState[] = ["active", "expiring_soon"];

function Tile({ tone, title, detail }: { tone: "ok" | "warn" | "bad"; title: string; detail: string }) {
  const s = { ok: { bg: "#dff3e7", fg: "#0d6630", mark: "✓", sr: "OK" }, warn: { bg: "#fff6cc", fg: "#6e5200", mark: "!", sr: "Attention" }, bad: { bg: "#fdecec", fg: "#a3111a", mark: "✕", sr: "Problem" } }[tone];
  return (
    <div className="card tile !flex-row items-center gap-3">
      <span className="ic font-extrabold" style={{ background: s.bg, color: s.fg }} aria-hidden="true">{s.mark}</span>
      <div className="min-w-0">
        <p className="m-0 font-bold"><span className="sr">{s.sr}: </span>{title}</p>
        <p className="mut m-0 mt-0.5 text-[12.5px]">{detail}</p>
      </div>
    </div>
  );
}

export default function VehicleRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useDemoUser();
  const [tab, setTab] = useState<TabKey>("overview");
  const [otherOpen, setOtherOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<null | "suspended" | "cancelled">(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const txn = useStartTransaction();

  const q = useServiceQuery(async () => {
    const history = await vehicleService.getHistory(id);
    if (!history) return null;
    const [offices, centers] = await Promise.all([settingsService.listOffices().catch(() => []), inspectionService.listCenters().catch(() => [])]);
    return { ...history, offices, centers };
  }, [id]);

  if (q.error) return <ErrorState message={q.error} onRetry={() => q.reload()} />;
  if (q.data === undefined) return <PageSkeleton />;
  if (q.data === null) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Motor Vehicle Registry", href: "/registry" }, { label: "Not found" }]} />
        <EmptyState title="No vehicle found" message="This vehicle record does not exist or has been removed. Search the registry by registration number, plate, VIN, chassis or engine number." action={{ label: "Back to registry", href: "/registry" }} />
      </div>
    );
  }

  const d = q.data;
  const { vehicle: v, owner, openApplication: openApp } = d.record;
  const state = vehicleRegistrationState(v);
  const days = daysToExpiry(v);
  const now = Date.now();
  const appById = (appId: string) => d.applications.find((a) => a.id === appId);
  const officeName = (oid?: string) => d.offices.find((o) => o.id === oid)?.name ?? "—";
  const centerName = (cid?: string) => d.centers.find((c) => c.id === cid)?.name ?? "—";
  const ownerName = (oid?: string) => {
    if (!oid) return "—";
    const o = d.owners.find((x) => x.id === oid);
    return o ? fullName(o) : v.ownershipHistory.find((p) => p.ownerId === oid)?.ownerName ?? "—";
  };

  const latestInsp = d.inspections.find((i) => i.status === "passed" || i.status === "failed" || i.status === "conditional") ?? d.inspections[0];
  const latestIns = d.insurance[0];
  const insured = !!latestIns && latestIns.status === "verified" && new Date(latestIns.coverageExpiry).getTime() >= now;
  const openPayment = openApp ? applicationPaymentState(openApp, d.payments) : null;
  const ownerSince = [...v.ownershipHistory].reverse().find((p) => p.ownerId === v.ownerId && !p.to);
  const firstRegistered = v.ownershipHistory.find((p) => p.reason === "first_registration")?.from ?? d.applications.filter((a) => a.type === "new" && a.registrationDate).at(-1)?.registrationDate ?? v.registrationDate;
  const completed = d.applications.filter((a) => a.status === "registered" && a.registrationNumber).sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt));
  const latestCompleted = completed[0];
  const certificate: CertificateData | null = latestCompleted && owner ? {
    application: latestCompleted,
    owner,
    vehicle: v,
    office: d.offices.find((o) => o.id === latestCompleted.officeId) ?? null,
    supervisorName: latestCompleted.approval?.byName ?? "Authorized Supervisor",
    receiptNumber: d.payments.find((p) => p.applicationId === latestCompleted.id && p.status === "successful")?.receiptNumber,
  } : null;

  const busyType = txn.busy?.vehicleId === v.id ? txn.busy.type : null;
  const closed = state === "deregistered" || state === "unregistered";
  const canRenew = can("renewal.create") && !openApp && (CURRENT_STATES.includes(state) || state === "expired");
  const canTransfer = can("transfer.create") && !openApp && CURRENT_STATES.includes(state);
  const otherAllowed = (t: TransactionType) => (t === "reinstatement" ? state === "suspended" || state === "cancelled" : !["suspended", "cancelled"].includes(state));
  const canOther = can("registration.create") && !openApp && !closed;
  const canSuspend = can("approval.decide") && (CURRENT_STATES.includes(state) || state === "expired");

  const changeStatus = async (reason: string) => {
    if (!statusAction) return;
    setStatusBusy(true);
    try {
      await vehicleService.setStatus(v.id, statusAction, reason);
      toast.success(`Registration ${statusAction === "suspended" ? "suspended" : "cancelled"}`, { description: "The change is recorded in the registration history and audit trail." });
      setStatusAction(null);
    } catch (e) {
      toast.error("Status not changed", { description: friendlyError(e) });
    } finally {
      setStatusBusy(false);
    }
  };

  // Registration history: every transaction plus suspensions / cancellations — never overwritten.
  const historyRows: HistoryRow[] = [
    ...d.applications.map((a): HistoryRow => {
      let detail = "—";
      if (a.type === "transfer" && a.transfer) detail = `${ownerName(a.transfer.previousOwnerId)} → ${a.transfer.newOwnerId ? ownerName(a.transfer.newOwnerId) : "new owner pending"}`;
      else if (a.changeRequest?.summary) detail = a.changeRequest.summary;
      else if (a.closureReason) detail = a.closureReason;
      else if (a.registrationDate) detail = `${formatDate(a.registrationDate)} – ${formatDate(a.expiryDate)}`;
      else detail = `Started by ${a.createdByName}`;
      return { key: a.id, date: a.completedAt ?? a.createdAt, label: transactionLabel(a.type), app: a, detail, result: <StatusBadge kind="registration" status={a.status} /> };
    }),
    ...d.audit.filter((e) => e.action === "vehicle_status_changed").map((e): HistoryRow => {
      const to = /→\s*([a-z_]+)/.exec(e.description)?.[1];
      const label = to === "suspended" ? "Suspension" : to === "cancelled" ? "Cancellation" : to === "deregistered" ? "Deregistration" : "Registration status change";
      return { key: e.id, date: e.timestamp, label, detail: `${e.description.split(": ").slice(1).join(": ") || e.description} · ${e.userName}`, result: to ? <StatusBadge kind="vehicle" status={to} /> : <Badge tone="draft">Recorded</Badge> };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const docs = d.applications.flatMap((a) => a.documents.filter((doc) => doc.status !== "missing").map((doc) => ({ doc, app: a })));

  const historyCols: ColumnDef<HistoryRow, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (r) => r.date, cell: ({ row }) => <span className="mono whitespace-nowrap">{formatDate(row.original.date)}</span> },
    { id: "txn", header: "Transaction", accessorFn: (r) => r.label, cell: ({ row }) => <span className="font-semibold">{row.original.label}</span> },
    { id: "ref", header: "Reference", accessorFn: (r) => r.app?.transactionNumber ?? "", cell: ({ row }) => (row.original.app ? <Link href={applicationHref(row.original.app)} className="mono">{row.original.app.transactionNumber}</Link> : <span className="mut">—</span>) },
    { id: "detail", header: "Owner / detail", accessorFn: (r) => r.detail },
    { id: "result", header: "Result", enableSorting: false, cell: ({ row }) => row.original.result },
  ];

  const ownershipCols: ColumnDef<OwnershipPeriod, unknown>[] = [
    { id: "owner", header: "Owner", accessorFn: (p) => p.ownerName, cell: ({ row }) => <span className="font-semibold">{ownerName(row.original.ownerId) !== "—" ? ownerName(row.original.ownerId) : row.original.ownerName}{!row.original.to && row.original.ownerId === v.ownerId && <Badge tone="ok" className="ml-2">Current</Badge>}</span> },
    { id: "from", header: "From", accessorFn: (p) => p.from, cell: ({ row }) => <span className="mono">{formatDate(row.original.from)}</span> },
    { id: "to", header: "To", accessorFn: (p) => p.to ?? "", cell: ({ row }) => <span className="mono">{row.original.to ? formatDate(row.original.to) : "Present"}</span> },
    { id: "reason", header: "How acquired", accessorFn: (p) => OWNERSHIP_REASON[p.reason] ?? p.reason },
    { id: "txn", header: "Transaction", accessorFn: (p) => p.transactionNumber ?? "", cell: ({ row }) => (row.original.applicationId ? <Link href={`/registrations/${row.original.applicationId}`} className="mono">{row.original.transactionNumber ?? "View"}</Link> : <span className="mono">{row.original.transactionNumber ?? "—"}</span>) },
  ];

  const inspCols: ColumnDef<Inspection, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (i) => i.inspectionDate ?? i.createdAt, cell: ({ row }) => <span className="mono">{formatDate(row.original.inspectionDate ?? row.original.createdAt)}</span> },
    { id: "ref", header: "Reference", accessorFn: (i) => i.reference ?? "", cell: ({ row }) => <span className="mono">{row.original.reference ?? "—"}</span> },
    { id: "txn", header: "Transaction", accessorFn: (i) => appById(i.applicationId)?.transactionNumber ?? "", cell: ({ row }) => { const a = appById(row.original.applicationId); return a ? <Link href={`/inspections/${a.id}`} className="mono">{a.transactionNumber}</Link> : "—"; } },
    { id: "center", header: "Location", accessorFn: (i) => i.location ?? centerName(i.centerId) },
    { id: "attempt", header: "Attempt", accessorFn: (i) => i.attempt, meta: { align: "right" } },
    { id: "status", header: "Result", accessorFn: (i) => i.status, cell: ({ row }) => <StatusBadge kind="inspection" status={row.original.status} /> },
    { id: "cert", header: "Certificate", accessorFn: (i) => i.certificateNumber ?? "", cell: ({ row }) => (row.original.certificateNumber ? <span className="mono text-[12.5px]">{row.original.certificateNumber} · exp. {formatDate(row.original.certificateExpiry)}</span> : row.original.failureReason ?? "—") },
  ];

  const payCols: ColumnDef<Payment, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (p) => p.completedAt ?? p.createdAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.completedAt ?? row.original.createdAt)}</span> },
    { id: "receipt", header: "Receipt", accessorFn: (p) => p.receiptNumber ?? "", cell: ({ row }) => <Link href={`/payments/${row.original.id}`} className="mono font-semibold">{row.original.receiptNumber ?? row.original.reference}</Link> },
    { id: "txn", header: "Transaction", accessorFn: (p) => appById(p.applicationId)?.transactionNumber ?? "", cell: ({ row }) => { const a = appById(row.original.applicationId); return a ? <span>{transactionLabel(a.type, true)}<span className="mono mut block text-[12px]">{a.transactionNumber}</span></span> : "—"; } },
    { id: "method", header: "Method", accessorFn: (p) => PAYMENT_METHOD_LABELS[p.method] ?? p.method },
    { id: "status", header: "Status", accessorFn: (p) => p.status, cell: ({ row }) => <StatusBadge kind="payment" status={row.original.status} /> },
    { id: "amount", header: "Amount", accessorFn: (p) => p.amount, meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.amount) },
  ];

  type DocRow = { doc: ApplicationDocument; app: RegistrationApplication };
  const docCols: ColumnDef<DocRow, unknown>[] = [
    { id: "file", header: "File", accessorFn: (r) => r.doc.file?.name ?? "", cell: ({ row }) => <span className="mono text-[12.5px] break-all">{row.original.doc.file?.name ?? "—"}</span> },
    { id: "type", header: "Type", accessorFn: (r) => documentLabel(r.doc.type) },
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`}>{transactionLabel(row.original.app.type, true)}<span className="mono mut block text-[12px]">{row.original.app.transactionNumber}</span></Link> },
    { id: "uploaded", header: "Uploaded", accessorFn: (r) => r.doc.file?.uploadedAt ?? "", cell: ({ row }) => <span className="mono">{formatDate(row.original.doc.file?.uploadedAt)}</span> },
    { id: "status", header: "Status", accessorFn: (r) => r.doc.status, cell: ({ row }) => <StatusBadge kind="document" status={row.original.doc.status} /> },
  ];

  const auditCols: ColumnDef<AuditEvent, unknown>[] = [
    { id: "ts", header: "Time", accessorFn: (e) => e.timestamp, cell: ({ row }) => <span className="mono whitespace-nowrap">{formatDateTime(row.original.timestamp)}</span> },
    { id: "desc", header: "Action", accessorFn: (e) => e.description },
    { id: "record", header: "Record", accessorFn: (e) => e.recordLabel ?? "", cell: ({ row }) => <span className="mono">{row.original.recordLabel ?? "—"}</span> },
    { id: "user", header: "User", accessorFn: (e) => e.userName },
  ];

  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: "overview", label: "Overview" },
    { value: "vehicle", label: "Vehicle Details" },
    { value: "owner", label: "Registered Owner" },
    { value: "history", label: "Registration History", count: historyRows.length },
    { value: "inspections", label: "Inspections", count: d.inspections.length },
    { value: "payments", label: "Payments", count: d.payments.length },
    { value: "documents", label: "Documents", count: docs.length },
    { value: "audit", label: "Audit Trail", count: d.audit.length },
  ];

  const regTile = (() => {
    if (state === "active") return <Tile tone="ok" title="Registration" detail={`Valid · ${expiryText(days)}`} />;
    if (state === "expiring_soon") return <Tile tone="warn" title="Registration" detail={`Expires in ${days} day${days === 1 ? "" : "s"}`} />;
    if (state === "expired") return <Tile tone="bad" title="Registration" detail={expiryText(days)} />;
    return <Tile tone={state === "unregistered" ? "warn" : "bad"} title="Registration" detail={getStatusLabel("vehicle", state)} />;
  })();
  const inspTile = latestInsp
    ? <Tile tone={latestInsp.status === "passed" ? "ok" : latestInsp.status === "failed" || latestInsp.status === "reinspection_required" ? "bad" : "warn"} title="Inspection" detail={`${getStatusLabel("inspection", latestInsp.status)} · ${formatDate(latestInsp.inspectionDate ?? latestInsp.createdAt)}`} />
    : <Tile tone="warn" title="Inspection" detail="No inspection on record" />;
  const insTile = latestIns
    ? <Tile tone={insured ? "ok" : "bad"} title={insured ? "Insured" : "Insurance"} detail={insured ? `to ${formatDate(latestIns.coverageExpiry)}` : `${getStatusLabel("insurance", latestIns.status)} · exp. ${formatDate(latestIns.coverageExpiry)}`} />
    : <Tile tone="warn" title="Insurance" detail="No insurance on record" />;
  const arrearsTile = openApp && (openPayment === "unpaid" || openPayment === "failed")
    ? <Tile tone="bad" title="Amount due" detail={`${openApp.assessment ? formatMoney(openApp.assessment.total) : "Assessment"} · ${openApp.transactionNumber}`} />
    : <Tile tone="ok" title="No arrears" detail="No outstanding balance" />;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Motor Vehicle Registry", href: "/registry" }, { label: v.plateNumber ?? v.registrationNumber ?? vehicleLabel(v) }]} />

      <section className="card flex flex-wrap items-center gap-6 p-6 max-[760px]:p-4" aria-label="Vehicle summary">
        <PlateChip plate={v.plateNumber} size="lg" />
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="row gap-2.5">
            <h1 className="h1 break-words">{vehicleLabel(v)} · {v.color}</h1>
            <RegistrationStatusBadge vehicle={v} />
          </div>
          <p className="mut m-0 mt-1.5 text-[14px]">
            {vehicleTypeLabel(v.vehicleType)} · {vehicleClassLabel(v.vehicleType, v.vehicleClass)} · {vehicleUsageLabel(v.vehicleUsage)}
            {v.registrationNumber && <> · <span className="mono">{v.registrationNumber}</span></>}
            {" "}· owner <strong className="text-[#0b0b0f]">{fullName(owner)}</strong>
            {v.registrationExpiry && <> · expires {formatDate(v.registrationExpiry)}</>}
          </p>
          <p className="mut m-0 mt-1 text-[13px]">
            Current transaction:{" "}
            {openApp ? (
              <>
                <Link href={applicationHref(openApp)} className="mono font-semibold">{openApp.transactionNumber}</Link> · {transactionLabel(openApp.type, true)} <StatusBadge kind="registration" status={openApp.status} />
              </>
            ) : "None in progress"}
          </p>
        </div>
        <div className="row no-print gap-2">
          {canRenew && (
            <button type="button" className="btn btn-p" disabled={!!txn.busy} onClick={() => txn.start("renewal", v.id)}>
              <RefreshCw size={16} aria-hidden="true" className={busyType === "renewal" ? "animate-spin" : ""} />
              {busyType === "renewal" ? "Starting renewal…" : "Renew"}
            </button>
          )}
          {canTransfer && <Link href={`/transfers?vehicle=${v.id}`} className="btn btn-s"><ArrowLeftRight size={16} aria-hidden="true" />Transfer ownership</Link>}
          {canOther && <button type="button" className="btn btn-s" onClick={() => setOtherOpen(true)}><FilePlus2 size={16} aria-hidden="true" />Other transaction</button>}
          {certificate && <button type="button" className="btn btn-s" onClick={() => setPrintOpen(true)}><Award size={16} aria-hidden="true" />Print certificate</button>}
          {openApp && <Link href={applicationHref(openApp)} className="btn btn-g"><ExternalLink size={16} aria-hidden="true" />Open transaction</Link>}
          {canSuspend && (
            <>
              <button type="button" className="btn btn-g" onClick={() => setStatusAction("suspended")}><PauseCircle size={16} aria-hidden="true" />Suspend</button>
              <button type="button" className="btn btn-g" onClick={() => setStatusAction("cancelled")}><Ban size={16} aria-hidden="true" />Cancel registration</button>
            </>
          )}
        </div>
      </section>

      {state === "expired" && (
        <Alert tone="bad" title="Vehicle registration expired" action={canRenew ? <button type="button" className="btn btn-s btn-sm min-h-[44px]" disabled={!!txn.busy} onClick={() => txn.start("renewal", v.id)}>Renew now</button> : undefined}>
          The registration expired on {formatDate(v.registrationExpiry)} ({expiryText(days)}). Late renewal penalties may apply.
        </Alert>
      )}
      {state === "deregistered" && (
        <Alert tone="bad" title="Vehicle deregistered">
          This vehicle has been removed from the active registry{v.statusReason ? ` — ${v.statusReason}` : ""}. Its history is kept for reference; no further transactions can be started.
        </Alert>
      )}
      {(state === "suspended" || state === "cancelled") && (
        <Alert tone="warn" title={`Registration ${state}`}>
          {v.statusReason ? `Reason: ${v.statusReason}. ` : ""}Start a Registration Reinstatement once the cause has been resolved.
        </Alert>
      )}
      {state === "unregistered" && <Alert tone="info" title="Not yet registered">This vehicle has been captured but no registration has been completed.</Alert>}

      <div className="g4" role="list" aria-label="Compliance indicators">
        <div role="listitem">{regTile}</div>
        <div role="listitem">{inspTile}</div>
        <div role="listitem">{insTile}</div>
        <div role="listitem">{arrearsTile}</div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Vehicle record sections" />

      <div role="tabpanel" aria-label={tabs.find((t) => t.value === tab)?.label}>
        {tab === "overview" && (
          <div className="flex flex-col gap-4">
            <div className="g2">
              <Section title="Registration">
                <DescriptionList items={[
                  ["Registration No.", v.registrationNumber ? <span key="r" className="mono">{v.registrationNumber}</span> : "Not registered"],
                  ["Plate", v.plateNumber ? <span key="p" className="mono">{v.plateNumber} · {plateCategoryLabel(v.plateCategory)}</span> : "—"],
                  ["Status", <RegistrationStatusBadge key="s" vehicle={v} />],
                  ["First registered", formatDate(firstRegistered)],
                  ["Current period", v.registrationDate ? `${formatDate(v.registrationDate)} – ${formatDate(v.registrationExpiry)}` : "—"],
                  ["Previous registration No.", v.previousRegistrationNumber ? <span key="pr" className="mono">{v.previousRegistrationNumber}</span> : undefined],
                  ["Open transaction", openApp ? <Link key="o" href={applicationHref(openApp)} className="mono">{openApp.transactionNumber}</Link> : "None"],
                  ["Payment", openPayment ? <StatusBadge key="pay" kind="application-payment" status={openPayment} /> : "—"],
                ]} />
              </Section>
              <Section title="Classification & owner">
                <DescriptionList items={[
                  ["Vehicle type", vehicleTypeLabel(v.vehicleType)],
                  ["Class", vehicleClassLabel(v.vehicleType, v.vehicleClass)],
                  ["Use", vehicleUsageLabel(v.vehicleUsage)],
                  ["Registered owner", `${fullName(owner)}${ownerSince ? ` (since ${formatDate(ownerSince.from)})` : ""}`],
                  ["Province of operation", v.provinceOfOperation],
                  ["Office", officeName(v.officeId)],
                  ["Renewal inspection", inspectionRuleText(v.vehicleType, "renewal")],
                ]} />
              </Section>
            </div>
            {d.insurance.length > 0 && (
              <Section title="Insurance">
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {d.insurance.slice(0, 3).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edeff3] pb-2 last:border-0 last:pb-0">
                      <span className="min-w-0"><span className="font-semibold">{r.provider}</span> · <span className="mono">{r.policyNumber}</span><span className="mut block text-[12.5px]">{formatDate(r.coverageStart)} – {formatDate(r.coverageExpiry)}</span></span>
                      <StatusBadge kind="insurance" status={r.status} />
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}

        {tab === "vehicle" && (
          <div className="flex flex-col gap-4">
            <VehicleCard vehicle={v} />
            <Section title="Identification & import">
              <DescriptionList items={[
                ["VIN", <span key="v" className="mono">{v.vin || "—"}</span>],
                ["Chassis number", <span key="c" className="mono">{v.chassisNumber}</span>],
                ["Engine number", v.engineNumber ? <span key="e" className="mono">{v.engineNumber}</span> : "Not applicable (no engine)"],
                ["Year / model year", `${v.year}${v.modelYear ? ` / ${v.modelYear}` : ""}`],
                ["Country of manufacture", v.countryOfManufacture],
              ]} />
              <SpecList vehicle={v} title="Type-specific specifications" />
            </Section>
          </div>
        )}

        {tab === "owner" && (
          <div className="flex flex-col gap-4">
            {owner ? <OwnerCard owner={owner} title={`Registered owner${ownerSince ? ` since ${formatDate(ownerSince.from)}` : ""}`} /> : <EmptyState title="Owner not found" message="The owner record linked to this vehicle could not be found." />}
            <Section title="Ownership history" description="Every owner of this vehicle is kept — previous owners are never overwritten or deleted.">
              <div className="-mx-6 -mb-[22px] max-[760px]:-mx-4 max-[760px]:-mb-[18px]">
                <DataTable storageKey="vehicle-owners" data={[...v.ownershipHistory].reverse()} columns={ownershipCols}
                  mobileCard={(p) => <MobileCard title={p.transactionNumber ?? OWNERSHIP_REASON[p.reason]} badge={!p.to && p.ownerId === v.ownerId ? <Badge tone="ok">Current</Badge> : <Badge tone="draft">Previous</Badge>} lines={[ownerName(p.ownerId) !== "—" ? ownerName(p.ownerId) : p.ownerName, `${formatDate(p.from)} – ${p.to ? formatDate(p.to) : "Present"} · ${OWNERSHIP_REASON[p.reason]}`]} />}
                  empty={{ title: "No ownership history", message: "Ownership periods are recorded when a registration or transfer is completed." }} />
              </div>
            </Section>
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-3">
            <p className="mut m-0 text-[13px]">New registrations, renewals, transfers, reclassifications, replacements, suspensions, cancellations and deregistration — each is kept as its own record.</p>
            <DataTable storageKey="vehicle-history" data={historyRows} columns={historyCols}
              mobileCard={(r) => <MobileCard href={r.app ? applicationHref(r.app) : undefined} title={r.app?.transactionNumber ?? formatDate(r.date)} badge={r.result} lines={[r.label, r.detail]} footer={<span className="mut text-[12px]">{formatDate(r.date)}</span>} />}
              empty={{ title: "No registration history", message: "No transactions have been recorded for this vehicle." }} />
          </div>
        )}

        {tab === "inspections" && (
          <DataTable storageKey="vehicle-insp" data={d.inspections} columns={inspCols}
            mobileCard={(i) => <MobileCard href={`/inspections/${i.applicationId}`} title={i.reference ?? appById(i.applicationId)?.transactionNumber ?? "Inspection"} badge={<StatusBadge kind="inspection" status={i.status} />} lines={[`Attempt ${i.attempt} · ${formatDate(i.inspectionDate ?? i.createdAt)}`, i.location ?? centerName(i.centerId)]} footer={i.certificateNumber ? <span className="mono text-[12px]">{i.certificateNumber} · exp. {formatDate(i.certificateExpiry)}</span> : i.failureReason ? <span className="text-[12px]">{i.failureReason}</span> : undefined} />}
            empty={{ title: "No inspections", message: "No roadworthiness inspections have been recorded for this vehicle." }} />
        )}

        {tab === "payments" && (
          <DataTable storageKey="vehicle-pay" data={d.payments} columns={payCols}
            mobileCard={(p) => <MobileCard href={`/payments/${p.id}`} title={p.receiptNumber ?? p.reference} badge={<StatusBadge kind="payment" status={p.status} />} lines={[formatMoney(p.amount), `${PAYMENT_METHOD_LABELS[p.method] ?? p.method} · ${transactionLabel(appById(p.applicationId)?.type, true)}`]} footer={<span className="mut text-[12px]">{formatDateTime(p.completedAt ?? p.createdAt)}</span>} />}
            empty={{ title: "No payments", message: "No payments have been recorded for this vehicle." }} />
        )}

        {tab === "documents" && (
          <DataTable storageKey="vehicle-docs" data={docs} columns={docCols}
            mobileCard={(r) => <MobileCard href={`/registrations/${r.app.id}`} title={r.app.transactionNumber} badge={<StatusBadge kind="document" status={r.doc.status} />} lines={[documentLabel(r.doc.type), r.doc.file?.name ?? "—"]} footer={r.doc.rejectionReason ? <span className="text-[12px] text-[#a3111a]">{r.doc.rejectionReason}</span> : undefined} />}
            empty={{ title: "No documents", message: "No documents have been uploaded for this vehicle's transactions." }} />
        )}

        {tab === "audit" && (
          <DataTable storageKey="vehicle-audit" data={d.audit} columns={auditCols}
            mobileCard={(e) => <MobileCard title={e.recordLabel ?? e.entity} lines={[e.description, e.userName]} footer={<span className="mut text-[12px]">{formatDateTime(e.timestamp)}</span>} />}
            empty={{ title: "No audit events", message: "No audit events have been recorded for this vehicle." }} />
        )}
      </div>

      <Modal open={otherOpen} onClose={() => setOtherOpen(false)} title="Start another transaction" description={`${vehicleLabel(v)} · ${v.registrationNumber ?? v.vin}`} size="md">
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {TRANSACTION_TYPES.filter((t) => OTHER_TRANSACTIONS.includes(t.key) && otherAllowed(t.key)).map((t) => (
            <li key={t.key}>
              <button
                type="button"
                className="opt w-full text-left"
                disabled={!!txn.busy}
                onClick={async () => {
                  const r = await txn.start(t.key, v.id);
                  if (r.app) setOtherOpen(false);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t.label}</span>
                  <span className="mut block text-[13px]">{t.description}</span>
                </span>
                {busyType === t.key && <span className="spin" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <ConfirmDialog
        open={statusAction !== null}
        onClose={() => setStatusAction(null)}
        onConfirm={changeStatus}
        busy={statusBusy}
        tone="danger"
        requireReason
        reasonLabel={statusAction === "suspended" ? "Reason for suspension" : "Reason for cancellation"}
        title={statusAction === "suspended" ? "Suspend registration" : "Cancel registration"}
        confirmLabel={statusAction === "suspended" ? "Suspend registration" : "Cancel registration"}
        message={<>This {statusAction === "suspended" ? "suspends" : "cancels"} registration <span className="mono font-semibold">{v.registrationNumber ?? v.vin}</span>. The vehicle cannot be renewed or transferred until it is reinstated. The change is kept in the registration history.</>}
      />

      {certificate && (
        <PrintPreview open={printOpen} onClose={() => setPrintOpen(false)} title="Motor Vehicle Registration Certificate (A4)" page="A4" elementId={`cert-${certificate.application.id}`} naturalWidth={794} audit={{ applicationId: certificate.application.id, what: "certificate" }}>
          <CertificateOfRegistration data={certificate} id={`cert-${certificate.application.id}`} />
        </PrintPreview>
      )}
    </div>
  );
}
