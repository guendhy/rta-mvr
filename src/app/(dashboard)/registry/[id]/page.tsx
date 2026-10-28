"use client";

import { use, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, ExternalLink, RefreshCw } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { DOCUMENT_TYPES, FUEL_TYPES, IDENTIFICATION_TYPES, IMPORT_STATUSES, INTENDED_USES, PAYMENT_METHOD_LABELS, GENDERS } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { motorcycleService } from "@/services/motorcycle.service";
import { ownerService } from "@/services/owner.service";
import { registrationService } from "@/services/registration.service";
import { inspectionService } from "@/services/inspection.service";
import { insuranceService } from "@/services/insurance.service";
import { paymentService } from "@/services/payment.service";
import { plateService } from "@/services/plate.service";
import { auditService } from "@/services/audit.service";
import { settingsService } from "@/services/settings.service";
import { userService } from "@/services/user.service";
import { Breadcrumbs, DescriptionList, Section, Tabs } from "@/components/ui/layout-bits";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { PlateChip, daysToExpiry, expiryText, isOpen, useStartRenewal } from "@/components/registry/renewal";
import type { ApplicationDocument, AuditEvent, Inspection, InsuranceRecord, Payment, Plate, RegistrationApplication } from "@/types";

type TabKey = "overview" | "owner" | "history" | "inspection" | "insurance" | "payments" | "documents" | "plates" | "audit";

const label = <T extends string>(list: { value: T; label: string }[], v: T | undefined) => list.find((x) => x.value === v)?.label ?? v ?? "—";

function Indicator({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  const Icon = ok ? CircleCheck : CircleX;
  return (
    <div className={`card flex items-start gap-3 p-3.5 ${ok ? "!border-[#59b27a] !bg-[#f1faf4]" : "!border-[#e58a8f] !bg-[#fdf3f3]"}`}>
      <Icon size={24} className={`mt-0.5 flex-none ${ok ? "text-[#137a3b]" : "text-[#c4141b]"}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="m-0 text-[14px] font-bold">{title}: <span className={ok ? "text-[#0d6630]" : "text-[#a3111a]"}>{ok ? "Yes" : "No"}</span></p>
        <p className="mut m-0 mt-0.5 text-[12.5px]">{detail}</p>
      </div>
    </div>
  );
}

export default function MotorcycleProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useDemoUser();
  const [tab, setTab] = useState<TabKey>("overview");
  const renewal = useStartRenewal();

  const q = useServiceQuery(async () => {
    const moto = await motorcycleService.getById(id);
    if (!moto) return null;
    const [owner, allApps, inspections, insurance, payments, plates, audit, offices, users, centers] = await Promise.all([
      ownerService.getById(moto.ownerId),
      registrationService.list(),
      inspectionService.list(),
      insuranceService.list(),
      paymentService.list(),
      plateService.list(),
      auditService.list(),
      settingsService.listOffices(),
      userService.list(),
      inspectionService.listCenters(),
    ]);
    const apps = allApps.filter((a) => a.motorcycleId === moto.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const appIds = new Set(apps.map((a) => a.id));
    return {
      moto,
      owner,
      apps,
      inspections: inspections.filter((i) => i.motorcycleId === moto.id).sort((a, b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt)),
      insurance: insurance.filter((r) => r.motorcycleId === moto.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      payments: payments.filter((p) => appIds.has(p.applicationId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      plates: plates.filter((p) => p.motorcycleId === moto.id),
      audit: audit.filter((e) => e.recordId && (appIds.has(e.recordId) || e.recordId === moto.id)),
      offices,
      users,
      centers,
    };
  }, [id]);

  if (q.error) return <ErrorState message={q.error} onRetry={() => q.reload()} />;
  if (q.data === undefined) return <PageSkeleton />;
  if (q.data === null) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumbs items={[{ label: "Registry", href: "/registry" }, { label: "Not found" }]} />
        <EmptyState title="Motorcycle not found" message="This motorcycle record does not exist or has been removed." action={{ label: "Back to registry", href: "/registry" }} />
      </div>
    );
  }

  const d = q.data;
  const { moto, owner } = d;
  const now = Date.now();
  const appById = (appId: string) => d.apps.find((a) => a.id === appId);
  const userName = (uid?: string) => { const u = d.users.find((x) => x.id === uid); return u ? `${u.firstName} ${u.lastName}` : "—"; };
  const centerName = (cid?: string) => d.centers.find((c) => c.id === cid)?.name ?? "—";
  const officeName = (oid?: string) => d.offices.find((o) => o.id === oid)?.name ?? "—";

  const openApp = d.apps.find(isOpen);
  const latestApp = d.apps[0];
  const currentApp = (moto.currentApplicationId && appById(moto.currentApplicationId)) || openApp || latestApp;
  const latestInsp = d.inspections.find((i) => i.status === "passed" || i.status === "failed") ?? d.inspections[0];
  const latestIns = d.insurance[0];
  const days = daysToExpiry(moto);

  const registered = moto.registrationStatus === "registered";
  const roadworthy = !!latestInsp && latestInsp.status === "passed" && (!latestInsp.certificateExpiry || new Date(latestInsp.certificateExpiry).getTime() >= now);
  const insured = !!latestIns && latestIns.status === "verified" && new Date(latestIns.coverageExpiry).getTime() >= now;
  const paidPayment = latestApp ? d.payments.find((p) => p.applicationId === latestApp.id && p.status === "successful") : undefined;
  const canRenew = can("renewal.create") && (moto.registrationStatus === "registered" || moto.registrationStatus === "expired") && !openApp;

  const docs = d.apps.flatMap((a) => a.documents.filter((doc) => doc.status !== "missing").map((doc) => ({ doc, app: a })));

  const appCols: ColumnDef<RegistrationApplication, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (a) => a.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.id}`} className="mono font-semibold">{row.original.transactionNumber}</Link> },
    { id: "type", header: "Type", accessorFn: (a) => a.type, cell: ({ row }) => (row.original.type === "renewal" ? "Renewal" : "New registration") },
    { id: "status", header: "Status", accessorFn: (a) => a.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.status} /> },
    { id: "regno", header: "Registration No.", accessorFn: (a) => a.registrationNumber ?? "", cell: ({ row }) => <span className="mono">{row.original.registrationNumber ?? "—"}</span> },
    { id: "period", header: "Valid", accessorFn: (a) => a.expiryDate ?? "", cell: ({ row }) => (row.original.registrationDate ? <span className="mono">{formatDate(row.original.registrationDate)} – {formatDate(row.original.expiryDate)}</span> : "—") },
    { id: "office", header: "Office", accessorFn: (a) => officeName(a.officeId) },
    { id: "created", header: "Started", accessorFn: (a) => a.createdAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.createdAt)}</span> },
  ];

  const inspCols: ColumnDef<Inspection, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (i) => appById(i.applicationId)?.transactionNumber ?? "", cell: ({ row }) => <Link href={`/inspections/${row.original.applicationId}`} className="mono font-semibold">{appById(row.original.applicationId)?.transactionNumber ?? "—"}</Link> },
    { id: "attempt", header: "Attempt", accessorFn: (i) => i.attempt, meta: { align: "right" } },
    { id: "date", header: "Date", accessorFn: (i) => i.inspectionDate ?? "", cell: ({ row }) => <span className="mono">{formatDate(row.original.inspectionDate)}</span> },
    { id: "center", header: "Centre", accessorFn: (i) => centerName(i.centerId) },
    { id: "inspector", header: "Inspector", accessorFn: (i) => userName(i.inspectorId) },
    { id: "status", header: "Result", accessorFn: (i) => i.status, cell: ({ row }) => <StatusBadge kind="inspection" status={row.original.status} /> },
    { id: "cert", header: "Certificate", accessorFn: (i) => i.certificateNumber ?? "", cell: ({ row }) => (row.original.certificateNumber ? <span className="mono">{row.original.certificateNumber} · exp. {formatDate(row.original.certificateExpiry)}</span> : row.original.failureReason ?? "—") },
  ];

  const insCols: ColumnDef<InsuranceRecord, unknown>[] = [
    { id: "provider", header: "Provider", accessorFn: (r) => r.provider },
    { id: "policy", header: "Policy No.", accessorFn: (r) => r.policyNumber, cell: ({ row }) => <span className="mono">{row.original.policyNumber}</span> },
    { id: "cover", header: "Coverage", accessorFn: (r) => r.coverageExpiry, cell: ({ row }) => <span className="mono">{formatDate(row.original.coverageStart)} – {formatDate(row.original.coverageExpiry)}</span> },
    { id: "premium", header: "Premium", accessorFn: (r) => r.premium, meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.premium) },
    { id: "status", header: "Status", accessorFn: (r) => r.status, cell: ({ row }) => <StatusBadge kind="insurance" status={row.original.status} /> },
    { id: "txn", header: "Transaction", accessorFn: (r) => appById(r.applicationId)?.transactionNumber ?? "", cell: ({ row }) => <Link href={`/insurance/${row.original.applicationId}`} className="mono">{appById(row.original.applicationId)?.transactionNumber ?? "—"}</Link> },
  ];

  const payCols: ColumnDef<Payment, unknown>[] = [
    { id: "date", header: "Date", accessorFn: (p) => p.completedAt ?? p.createdAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.completedAt ?? row.original.createdAt)}</span> },
    { id: "ref", header: "Reference", accessorFn: (p) => p.reference, cell: ({ row }) => <Link href={`/payments/${row.original.id}`} className="mono font-semibold">{row.original.reference}</Link> },
    { id: "receipt", header: "Receipt", accessorFn: (p) => p.receiptNumber ?? "", cell: ({ row }) => <span className="mono">{row.original.receiptNumber ?? "—"}</span> },
    { id: "txn", header: "Transaction", accessorFn: (p) => appById(p.applicationId)?.transactionNumber ?? "", cell: ({ row }) => <span className="mono">{appById(row.original.applicationId)?.transactionNumber ?? "—"}</span> },
    { id: "method", header: "Method", accessorFn: (p) => PAYMENT_METHOD_LABELS[p.method] },
    { id: "status", header: "Status", accessorFn: (p) => p.status, cell: ({ row }) => <StatusBadge kind="payment" status={row.original.status} /> },
    { id: "amount", header: "Amount", accessorFn: (p) => p.amount, meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.amount) },
  ];

  type DocRow = { doc: ApplicationDocument; app: RegistrationApplication };
  const docCols: ColumnDef<DocRow, unknown>[] = [
    { id: "type", header: "Document", accessorFn: (r) => DOCUMENT_TYPES.find((t) => t.type === r.doc.type)?.label ?? r.doc.type },
    { id: "file", header: "File", accessorFn: (r) => r.doc.file?.name ?? "", cell: ({ row }) => <span className="mono text-[12.5px] break-all">{row.original.doc.file?.name ?? "—"}</span> },
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="mono">{row.original.app.transactionNumber}</Link> },
    { id: "status", header: "Status", accessorFn: (r) => r.doc.status, cell: ({ row }) => <StatusBadge kind="document" status={row.original.doc.status} /> },
    { id: "verified", header: "Verified", accessorFn: (r) => r.doc.verifiedAt ?? "", cell: ({ row }) => (row.original.doc.verifiedBy ? `${row.original.doc.verifiedBy} · ${formatDate(row.original.doc.verifiedAt)}` : row.original.doc.rejectionReason ?? "—") },
  ];

  const plateCols: ColumnDef<Plate, unknown>[] = [
    { id: "plate", header: "Plate", accessorFn: (p) => p.plateNumber, cell: ({ row }) => <PlateChip plate={row.original.plateNumber} size="sm" /> },
    { id: "status", header: "Status", accessorFn: (p) => p.status, cell: ({ row }) => <StatusBadge kind="plate" status={row.original.status} /> },
    { id: "office", header: "Office", accessorFn: (p) => officeName(p.officeId) },
    { id: "assigned", header: "Assigned", accessorFn: (p) => p.assignedDate ?? "", cell: ({ row }) => <span className="mono">{formatDate(row.original.assignedDate)}</span> },
    { id: "txn", header: "Transaction", accessorFn: (p) => (p.applicationId ? appById(p.applicationId)?.transactionNumber ?? "" : ""), cell: ({ row }) => (row.original.applicationId ? <Link href={`/registrations/${row.original.applicationId}`} className="mono">{appById(row.original.applicationId)?.transactionNumber ?? "—"}</Link> : "—") },
    { id: "notes", header: "Notes", accessorFn: (p) => p.notes ?? "", cell: ({ row }) => row.original.notes ?? "—" },
  ];

  const auditCols: ColumnDef<AuditEvent, unknown>[] = [
    { id: "ts", header: "Date", accessorFn: (e) => e.timestamp, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.timestamp)}</span> },
    { id: "desc", header: "Action", accessorFn: (e) => e.description },
    { id: "record", header: "Record", accessorFn: (e) => e.recordLabel ?? "", cell: ({ row }) => <span className="mono">{row.original.recordLabel ?? "—"}</span> },
    { id: "user", header: "User", accessorFn: (e) => e.userName },
  ];

  const tabs: { value: TabKey; label: string; count?: number }[] = [
    { value: "overview", label: "Overview" },
    { value: "owner", label: "Owner" },
    { value: "history", label: "Registration History", count: d.apps.length },
    { value: "inspection", label: "Inspection", count: d.inspections.length },
    { value: "insurance", label: "Insurance", count: d.insurance.length },
    { value: "payments", label: "Payments", count: d.payments.length },
    { value: "documents", label: "Documents", count: docs.length },
    { value: "plates", label: "Plates", count: d.plates.length },
    { value: "audit", label: "Audit History", count: d.audit.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Registry", href: "/registry" }, { label: moto.plateNumber ?? moto.registrationNumber ?? motorcycleLabel(moto) }]} />

      <section className="card sec" aria-label="Motorcycle summary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <PlateChip plate={moto.plateNumber} size="lg" />
            <div className="min-w-0">
              <div className="row gap-2.5">
                <h1 className="h1 break-words">{motorcycleLabel(moto)}</h1>
                <StatusBadge kind="motorcycle" status={moto.registrationStatus} />
              </div>
              <p className="mut m-0 mt-1 text-[14px]">
                Owner: <span className="font-semibold text-[#0b0b0f]">{fullName(owner)}</span>
                {moto.registrationNumber && <> · Reg. <span className="mono">{moto.registrationNumber}</span></>}
              </p>
              <p className="mut m-0 mt-0.5 text-[13px]">
                {moto.registrationExpiry ? <>Expiry <span className="mono">{formatDate(moto.registrationExpiry)}</span> · {expiryText(days)}</> : "Not yet registered"}
              </p>
            </div>
          </div>
          <div className="row no-print">
            {currentApp && <Link href={`/registrations/${currentApp.id}`} className="btn btn-s"><ExternalLink size={16} aria-hidden="true" />View current application</Link>}
            {canRenew && (
              <button type="button" className="btn btn-p" disabled={renewal.busyId === moto.id} onClick={() => renewal.start(moto.id)}>
                <RefreshCw size={16} aria-hidden="true" className={renewal.busyId === moto.id ? "animate-spin" : ""} />
                {renewal.busyId === moto.id ? "Starting renewal…" : "Renew Registration"}
              </button>
            )}
          </div>
        </div>
        {openApp && (
          <p className="mut m-0 text-[13px]">
            Open application: <Link href={openApp.type === "renewal" ? `/registrations/new?id=${openApp.id}` : `/registrations/${openApp.id}`} className="mono font-semibold">{openApp.transactionNumber}</Link> <StatusBadge kind="registration" status={openApp.status} />
          </p>
        )}
        <div className="g4" role="list" aria-label="Compliance indicators">
          <div role="listitem"><Indicator ok={registered} title="Registered" detail={registered ? `Valid until ${formatDate(moto.registrationExpiry)}` : moto.registrationStatus === "expired" ? `Expired ${formatDate(moto.registrationExpiry)}` : "No current registration"} /></div>
          <div role="listitem"><Indicator ok={roadworthy} title="Roadworthy" detail={latestInsp ? (latestInsp.status === "passed" ? `Certificate ${latestInsp.certificateNumber ?? ""} · exp. ${formatDate(latestInsp.certificateExpiry)}` : `Latest inspection: ${latestInsp.status.replace(/_/g, " ")}`) : "No inspection on record"} /></div>
          <div role="listitem"><Indicator ok={insured} title="Insured" detail={latestIns ? `${latestIns.provider.split(" (")[0]} · exp. ${formatDate(latestIns.coverageExpiry)}` : "No insurance on record"} /></div>
          <div role="listitem"><Indicator ok={!!paidPayment} title="Paid" detail={paidPayment ? `${formatMoney(paidPayment.amount)} · ${paidPayment.receiptNumber ?? paidPayment.reference}` : latestApp ? `No successful payment on ${latestApp.transactionNumber}` : "No applications"} /></div>
        </div>
      </section>

      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Motorcycle record sections" />

      <div role="tabpanel" aria-label={tabs.find((t) => t.value === tab)?.label}>
        {tab === "overview" && (
          <div className="g2">
            <Section title="Motorcycle">
              <DescriptionList items={[
                ["Make / Model", `${moto.make} ${moto.model}${moto.variant ? ` ${moto.variant}` : ""}`],
                ["Year", moto.year],
                ["Body type", moto.bodyType],
                ["Colour", moto.color],
                ["Engine number", <span key="e" className="mono">{moto.engineNumber}</span>],
                ["Chassis number", <span key="c" className="mono">{moto.chassisNumber}</span>],
                ["VIN", <span key="v" className="mono">{moto.vin}</span>],
                ["Engine capacity", `${moto.engineCapacityCc} cc`],
                ["Fuel", label(FUEL_TYPES, moto.fuelType)],
                ["Sidecar", moto.sidecar ? "Yes" : "No"],
                ["Country of manufacture", moto.countryOfManufacture],
                ["Import status", label(IMPORT_STATUSES, moto.importStatus)],
                ["Intended use", label(INTENDED_USES, moto.intendedUse)],
              ]} />
            </Section>
            <Section title="Registration">
              <DescriptionList items={[
                ["Status", <StatusBadge key="s" kind="motorcycle" status={moto.registrationStatus} />],
                ["Registration No.", moto.registrationNumber ? <span key="r" className="mono">{moto.registrationNumber}</span> : "—"],
                ["Plate", moto.plateNumber ? <PlateChip key="p" plate={moto.plateNumber} size="sm" /> : "—"],
                ["Registered", formatDate(moto.registrationDate)],
                ["Expiry", moto.registrationExpiry ? `${formatDate(moto.registrationExpiry)} (${expiryText(days)})` : "—"],
                ["Province of operation", moto.provinceOfOperation],
                ["Office", officeName(moto.officeId)],
                ["Applications", d.apps.length],
              ]} />
            </Section>
          </div>
        )}

        {tab === "owner" && (
          owner ? (
            <Section title={fullName(owner)} description="Registered owner">
              <DescriptionList items={[
                ["Date of birth", formatDate(owner.dateOfBirth)],
                ["Gender", label(GENDERS, owner.gender)],
                ["Nationality", owner.nationality],
                ["Identification", `${label(IDENTIFICATION_TYPES, owner.identificationType)} · ${owner.identificationNumber}`],
                ["Mobile", <span key="m" className="mono">{owner.mobile}</span>],
                ["Email", owner.email ?? "—"],
                ["Province", owner.province],
                ["District / LLG", `${owner.district} · ${owner.llg}`],
                ["Ward", owner.ward ?? "—"],
                ["Street address", owner.street],
                ["Postal address", owner.postalAddress ?? "—"],
              ]} />
            </Section>
          ) : <EmptyState title="Owner not found" message="The owner record linked to this motorcycle could not be found." />
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-3">
            <p className="mut m-0 text-[13px]">Each registration and renewal is kept as its own transaction — renewals never overwrite history.</p>
            <DataTable storageKey="moto-apps" data={d.apps} columns={appCols}
              mobileCard={(a) => <MobileCard href={`/registrations/${a.id}`} title={a.transactionNumber} badge={<StatusBadge kind="registration" status={a.status} />} lines={[a.type === "renewal" ? "Renewal" : "New registration", a.registrationDate ? `${formatDate(a.registrationDate)} – ${formatDate(a.expiryDate)}` : `Started ${formatDate(a.createdAt)}`]} footer={<span className="mut text-[12px]">{officeName(a.officeId)}</span>} />}
              empty={{ title: "No applications", message: "No registration applications exist for this motorcycle." }} />
          </div>
        )}

        {tab === "inspection" && (
          <DataTable storageKey="moto-insp" data={d.inspections} columns={inspCols}
            mobileCard={(i) => <MobileCard href={`/inspections/${i.applicationId}`} title={appById(i.applicationId)?.transactionNumber ?? "—"} badge={<StatusBadge kind="inspection" status={i.status} />} lines={[`Attempt ${i.attempt} · ${formatDate(i.inspectionDate)}`, `${centerName(i.centerId)} · ${userName(i.inspectorId)}`]} footer={i.certificateNumber ? <span className="mono text-[12px]">{i.certificateNumber} · exp. {formatDate(i.certificateExpiry)}</span> : i.failureReason ? <span className="text-[12px]">{i.failureReason}</span> : undefined} />}
            empty={{ title: "No inspections", message: "No roadworthiness inspections have been recorded for this motorcycle." }} />
        )}

        {tab === "insurance" && (
          <DataTable storageKey="moto-ins" data={d.insurance} columns={insCols}
            mobileCard={(r) => <MobileCard href={`/insurance/${r.applicationId}`} title={r.policyNumber} badge={<StatusBadge kind="insurance" status={r.status} />} lines={[r.provider, `${formatDate(r.coverageStart)} – ${formatDate(r.coverageExpiry)}`]} footer={<span className="font-bold">{formatMoney(r.premium)}</span>} />}
            empty={{ title: "No insurance records", message: "No insurance has been captured for this motorcycle." }} />
        )}

        {tab === "payments" && (
          <DataTable storageKey="moto-pay" data={d.payments} columns={payCols}
            mobileCard={(p) => <MobileCard href={`/payments/${p.id}`} title={p.reference} badge={<StatusBadge kind="payment" status={p.status} />} lines={[formatMoney(p.amount), `${PAYMENT_METHOD_LABELS[p.method]} · ${appById(p.applicationId)?.transactionNumber ?? ""}`]} footer={<span className="mut text-[12px]">{formatDateTime(p.completedAt ?? p.createdAt)}</span>} />}
            empty={{ title: "No payments", message: "No payments have been recorded for this motorcycle." }} />
        )}

        {tab === "documents" && (
          <DataTable storageKey="moto-docs" data={docs} columns={docCols}
            mobileCard={(r) => <MobileCard href={`/registrations/${r.app.id}`} title={r.app.transactionNumber} badge={<StatusBadge kind="document" status={r.doc.status} />} lines={[DOCUMENT_TYPES.find((t) => t.type === r.doc.type)?.label ?? r.doc.type, r.doc.file?.name ?? "—"]} footer={r.doc.rejectionReason ? <span className="text-[12px] text-[#a3111a]">{r.doc.rejectionReason}</span> : undefined} />}
            empty={{ title: "No documents", message: "No documents have been uploaded for this motorcycle." }} />
        )}

        {tab === "plates" && (
          <DataTable storageKey="moto-plates" data={d.plates} columns={plateCols}
            mobileCard={(p) => <MobileCard title={p.plateNumber} badge={<StatusBadge kind="plate" status={p.status} />} lines={[officeName(p.officeId), p.assignedDate ? `Assigned ${formatDate(p.assignedDate)}` : "Not assigned"]} />}
            empty={{ title: "No plates", message: "No number plate has been assigned to this motorcycle yet." }} />
        )}

        {tab === "audit" && (
          <DataTable storageKey="moto-audit" data={d.audit} columns={auditCols}
            mobileCard={(e) => <MobileCard title={e.recordLabel ?? e.entity} lines={[e.description, e.userName]} footer={<span className="mut text-[12px]">{formatDateTime(e.timestamp)}</span>} />}
            empty={{ title: "No audit events", message: "No audit events have been recorded for this motorcycle's applications." }} />
        )}
      </div>
    </div>
  );
}
