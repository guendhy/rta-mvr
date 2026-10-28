"use client";

import { registrationService } from "@/services/registration.service";
import { useServiceQuery } from "@/hooks/use-service";
import { documentsChecklist } from "@/lib/workflow";
import { formatDate } from "@/lib/formatting";
import { documentLabel } from "@/config/document-requirements";
import { Alert } from "@/components/ui/feedback";
import { DescriptionList, Section } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import { TransactionSummary } from "../transaction-summary";
import { CheckRow, OwnerCard, VehicleCard } from "../cards";
import type { RegistrationDetail } from "@/services/interfaces";

/** Step 8 — everything captured so far, checked before payment. */
export function ReviewStep({ detail, onProceed }: { detail: RegistrationDetail; onProceed: () => void }) {
  const app = detail.application;
  const { data: checklist } = useServiceQuery(() => registrationService.approvalChecklist(app.id), [app.id, app.updatedAt]);
  const docs = documentsChecklist(app);
  const prePayment = (checklist ?? []).filter((c) => c.key !== "payment");

  if (!app.assessment) return <Alert tone="info" title="Review not yet reached">Generate the fee assessment first (Step 7).</Alert>;

  return (
    <div className="split">
      <div className="l">
        <TransactionSummary detail={detail} />
        <div className="g2">
          {detail.owner && <OwnerCard owner={detail.owner} title={detail.newOwner ? "Current owner (seller)" : "Registered owner"} compact />}
          {detail.newOwner && <OwnerCard owner={detail.newOwner} title="New owner (buyer)" compact />}
        </div>
        {detail.vehicle && <VehicleCard vehicle={detail.vehicle} title="Vehicle" />}
        {app.changeRequest && (
          <Section title="Requested changes" description={app.changeRequest.summary}>
            {app.changeRequest.changes.length > 0 && <DescriptionList items={app.changeRequest.changes.map((c) => [c.label, <span key={c.field}>{c.from ?? "—"} → <strong>{c.to}</strong></span>])} />}
            {app.closureReason && <p className="m-0 text-[13.5px]"><strong>Reason:</strong> {app.closureReason}</p>}
          </Section>
        )}
        <Section title="Supporting documents">
          {app.documents.length === 0 ? <p className="mut m-0">No documents required.</p> : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {app.documents.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                  <span>{documentLabel(d.type)}{d.required && <span className="req" aria-label="required">*</span>}</span>
                  <StatusBadge kind="document" status={d.status === "missing" ? (d.required ? "required" : "optional") : d.status} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <div className="g2">
          <Section title="Inspection" actions={detail.inspection && <StatusBadge kind="inspection" status={detail.inspection.status} />}>
            {app.inspectionRequired ? <DescriptionList items={[["Reference", <span key="r" className="mono">{detail.inspection?.reference ?? "—"}</span>], ["Certificate", <span key="c" className="mono">{detail.inspection?.certificateNumber ?? "—"}</span>], ["Date", formatDate(detail.inspection?.inspectionDate)]]} /> : <p className="mut m-0">Not required for this transaction.</p>}
          </Section>
          <Section title="Insurance" actions={detail.insurance && <StatusBadge kind="insurance" status={detail.insurance.status} />}>
            {app.insuranceRequired ? <DescriptionList items={[["Provider", detail.insurance?.provider], ["Policy", <span key="p" className="mono">{detail.insurance?.policyNumber ?? "—"}</span>], ["Cover to", formatDate(detail.insurance?.coverageExpiry)]]} /> : <p className="mut m-0">Not required for this transaction.</p>}
          </Section>
        </div>
      </div>
      <div className="r">
        <Section title="Fee assessment">
          <FeeBreakdown assessment={app.assessment} compact showBasis={false} />
        </Section>
        <Section title="Pre-payment checks">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {prePayment.map((c) => <CheckRow key={c.key} ok={c.ok} label={c.label} detail={c.detail} />)}
          </ul>
          {!docs.verified && <Alert tone="warn" title="Documents still to verify">Payment can be taken now, but the supervisor cannot approve until every required document is verified.</Alert>}
          {app.status === "payment_required" ? (
            <button type="button" className="btn btn-p btn-lg w-full" onClick={onProceed}>Proceed to Payment →</button>
          ) : <Alert tone="ok" title="Payment stage passed">This application is {app.status === "for_approval" ? "awaiting approval" : "past the payment stage"}.</Alert>}
        </Section>
      </div>
    </div>
  );
}
