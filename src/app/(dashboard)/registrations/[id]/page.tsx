"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { auditService } from "@/services/audit.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { PAYMENT_METHOD_LABELS, REGISTRATION_STATUS, WIZARD_STEPS } from "@/lib/constants";
import { transactionLabel } from "@/config/transaction-types";
import { formatDateTime, formatMoney } from "@/lib/formatting";
import { isClosed, stepForStatus } from "@/lib/workflow";
import { AUDIT_ACTION_LABELS } from "@/data/mock/audit-logs";
import { Breadcrumbs, PageHeader, Section, Tabs } from "@/components/ui/layout-bits";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { OwnerCard, VehicleCard } from "@/components/registrations/cards";
import { DocumentsPanel } from "@/components/registrations/documents-panel";
import { ApprovalPanel } from "@/components/registrations/approval-panel";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import { DescriptionList } from "@/components/ui/layout-bits";
import { RegistrationSuccess } from "@/components/registrations/registration-success";
import { InspectionPanel } from "@/components/inspections/inspection-panel";
import { InsurancePanel } from "@/components/insurance/insurance-panel";
import { RegistrationDocButtons } from "@/components/registrations/registration-docs";

type Tab = "overview" | "documents" | "inspection" | "insurance" | "payments" | "history";

function RecordView({ id }: { id: string }) {
  const params = useSearchParams();
  const { canAny } = useDemoUser();
  const printParam = params.get("print");
  const autoPrint = printParam === "certificate" || printParam === "label" ? printParam : null;
  const [tab, setTab] = useState<Tab>("overview");
  const { data: detail, loading, error, reload } = useServiceQuery(() => registrationService.getDetail(id), [id]);
  const { data: events } = useServiceQuery(() => auditService.list({ recordId: id }), [id]);

  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !detail) return <PageSkeleton />;
  if (!detail) return <EmptyState title="Application not found" message="This application does not exist." action={{ label: "All applications", href: "/registrations" }} />;
  const app = detail.application;
  const step = stepForStatus(app);
  const decisionStage = ["for_approval", "approved", "registered", "returned", "rejected"].includes(app.status);
  const canWork = canAny(["registration.edit", "inspection.submit", "insurance.verify", "payment.process", "assessment.generate"]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Applications", href: "/registrations" }, { label: app.transactionNumber }]} />
      <PageHeader
        eyebrow={transactionLabel(app.type)}
        title={app.transactionNumber}
        badge={<StatusBadge kind="registration" status={app.status} />}
        description={<>{detail.office?.name} · created {formatDateTime(app.createdAt)} by {app.createdByName}{app.registrationNumber && <> · <span className="mono font-semibold text-[#0b0b0f]">{app.registrationNumber}</span></>}</>}
        actions={
          <>
            {app.status === "registered" && <RegistrationDocButtons detail={detail} autoOpen={autoPrint} />}
            {!isClosed(app.status) && canWork && <Link href={`/registrations/new?id=${app.id}`} className="btn btn-p">Open in workflow · Step {step} {WIZARD_STEPS[step - 1]?.label}<ArrowRight size={16} aria-hidden="true" /></Link>}
          </>
        }
      />
      {app.scenario && <Alert tone="info" title={app.scenario}>Seeded UAT scenario record.</Alert>}
      {app.previousApplicationId && detail.previous && <Alert tone="info" title="Follows an earlier transaction">Previous transaction <Link href={`/registrations/${detail.previous.id}`} className="mono">{detail.previous.transactionNumber}</Link> ({transactionLabel(detail.previous.type)}) — history is kept, never overwritten.</Alert>}

      {decisionStage && (app.status === "registered" ? <RegistrationSuccess detail={detail} /> : <ApprovalPanel detail={detail} />)}

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { value: "overview", label: "Overview" },
        { value: "documents", label: "Documents", count: app.documents.filter((d) => d.status !== "missing").length },
        { value: "inspection", label: "Inspection", count: detail.inspections.length },
        { value: "insurance", label: "Insurance" },
        { value: "payments", label: "Payments", count: detail.payments.length },
        { value: "history", label: "History" },
      ]} />

      {tab === "overview" && (
        <div className="split">
          <div className="l">
            {detail.owner ? <OwnerCard owner={detail.owner} title={detail.newOwner ? "Current owner (seller)" : "Registered owner"} /> : <Alert tone="warn" title="Owner not captured" />}
            {detail.newOwner && <OwnerCard owner={detail.newOwner} title="New owner (buyer)" />}
            {detail.vehicle ? <VehicleCard vehicle={detail.vehicle} title="Vehicle" /> : <Alert tone="warn" title="Vehicle not captured" />}
            {app.changeRequest && (
              <Section title="Requested changes" description={app.changeRequest.summary}>
                {app.changeRequest.changes.length > 0 && <DescriptionList items={app.changeRequest.changes.map((c) => [c.label, <span key={c.field}>{c.from ?? "—"} → <strong>{c.to}</strong></span>])} />}
                {app.closureReason && <p className="m-0 text-[13.5px]"><strong>Reason:</strong> {app.closureReason}</p>}
              </Section>
            )}
          </div>
          <div className="r">
            <Section title="Status timeline">
              <ol className="m-0 flex list-none flex-col gap-0 p-0">
                {[...app.history].reverse().map((h, i) => (
                  <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                    <span className="mt-1 h-2.5 w-2.5 flex-none rounded-full bg-[#1515e8]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="m-0 text-[13.5px] font-semibold">{REGISTRATION_STATUS[h.to].label}</p>
                      <p className="mut m-0 text-[12.5px]">{formatDateTime(h.at)} · {h.byName}</p>
                      {h.note && <p className="m-0 text-[12.5px]">{h.note}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>
            {app.assessment && <Section title="Fee assessment"><FeeBreakdown assessment={app.assessment} compact /></Section>}
          </div>
        </div>
      )}
      {tab === "documents" && <DocumentsPanel application={app} canUpload={false} />}
      {tab === "inspection" && <InspectionPanel detail={detail} />}
      {tab === "insurance" && <InsurancePanel detail={detail} />}
      {tab === "payments" && (
        detail.payments.length === 0 ? <EmptyState title="No Payments" message="No payment transactions found." /> : (
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Reference</th><th>Method</th><th>Status</th><th>Receipt</th><th className="num">Amount</th><th>Cashier</th><th>Date</th></tr></thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/payments/${p.id}`} className="mono font-semibold">{p.reference}</Link></td>
                    <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td><StatusBadge kind="payment" status={p.status} />{p.failureReason && <span className="mut block text-[12px]">{p.failureReason}</span>}</td>
                    <td className="mono">{p.receiptNumber ?? "—"}</td>
                    <td className="num">{formatMoney(p.amount)}</td>
                    <td>{p.cashierName}</td>
                    <td className="mono text-[12.5px]">{formatDateTime(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab === "history" && (
        <Section title="Audit history">
          {(events ?? []).length === 0 ? <p className="mut m-0">No audit events.</p> : (
            <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
              {(events ?? []).map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-[13.5px]">
                  <span><strong>{AUDIT_ACTION_LABELS[e.action]}</strong> — {e.description}</span>
                  <span className="mut text-[12.5px]">{e.userName} · {formatDateTime(e.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

export default function RegistrationRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RecordView id={id} />
    </Suspense>
  );
}
