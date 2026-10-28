"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BadgeCheck, Undo2, XCircle } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { friendlyError } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { Section } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import { CheckRow } from "./cards";
import { DocumentsPanel } from "./documents-panel";
import { AssessmentTable } from "./assessment-panel";
import { PlateAssignInline } from "./plate-assign-inline";
import { RegistrationSuccess } from "./registration-success";
import type { RegistrationDetail } from "@/services/interfaces";

/** Supervisor approval (spec §35–37): review everything, then Approve / Return / Reject. */
export function ApprovalPanel({ detail }: { detail: RegistrationDetail }) {
  const { can } = useDemoUser();
  const app = detail.application;
  const { data: checklist } = useServiceQuery(() => registrationService.approvalChecklist(app.id), [app.id, app.updatedAt]);
  const [dialog, setDialog] = useState<null | "approve" | "return" | "reject">(null);
  const [busy, setBusy] = useState(false);
  const failing = (checklist ?? []).filter((c) => !c.ok);
  const canDecide = can("approval.decide");

  if (app.status === "registered") return <RegistrationSuccess detail={detail} />;
  if (app.status === "approved") {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="ok" title={`Approved — registration ${app.registrationNumber}`}>Approved by {app.approval?.byName} on {formatDateTime(app.approval?.at)}. Certificate {app.certificateNumber} and label {app.labelNumber} are reserved. Assign a number plate to complete the registration.</Alert>
        <PlateAssignInline detail={detail} />
      </div>
    );
  }
  if (app.status === "returned" || app.status === "rejected") {
    return (
      <Alert tone={app.status === "rejected" ? "bad" : "warn"} title={app.status === "rejected" ? "Application rejected" : "Returned for correction"}>
        {app.approval?.reason} — {app.approval?.byName}, {formatDateTime(app.approval?.at)}.
        {app.status === "returned" && " The registration officer corrects the application and resubmits it."}
      </Alert>
    );
  }
  if (app.status !== "for_approval") {
    return <Alert tone="info" title="Approval not yet reached">The application reaches the supervisor after payment is successful.</Alert>;
  }

  const decide = async (kind: "approve" | "return" | "reject", reason: string) => {
    setBusy(true);
    try {
      if (kind === "approve") {
        const a = await registrationService.approve(app.id);
        toast.success("Registration approved", { description: `${a.registrationNumber}${a.status === "approved" ? " · assign a plate next" : ""}` });
      } else if (kind === "return") {
        await registrationService.returnForCorrection(app.id, reason);
        toast.success("Returned for correction");
      } else {
        await registrationService.reject(app.id, reason);
        toast.success("Application rejected");
      }
      setDialog(null);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const { owner, motorcycle, inspection, insurance, payment } = detail;
  return (
    <div className="split">
      <div className="l">
        <div className="g2">
          <Section title="Owner">
            <dl className="dl"><dt>Name</dt><dd>{fullName(owner)}</dd><dt>ID</dt><dd className="mono">{owner?.identificationNumber}</dd><dt>Mobile</dt><dd className="mono">{owner?.mobile}</dd><dt>Province</dt><dd>{owner?.province}</dd></dl>
          </Section>
          <Section title="Motorcycle">
            <dl className="dl"><dt>Vehicle</dt><dd>{motorcycleLabel(motorcycle)} · {motorcycle?.color}</dd><dt>VIN</dt><dd className="mono">{motorcycle?.vin}</dd><dt>Engine</dt><dd className="mono">{motorcycle?.engineNumber}</dd><dt>Sidecar</dt><dd>{motorcycle?.sidecar ? "Yes" : "No"}</dd></dl>
          </Section>
          <Section title="Inspection" actions={inspection && <StatusBadge kind="inspection" status={inspection.status} />}>
            <dl className="dl"><dt>Certificate</dt><dd className="mono">{inspection?.certificateNumber ?? "—"}</dd><dt>Date</dt><dd>{formatDate(inspection?.inspectionDate)}</dd><dt>Expiry</dt><dd>{formatDate(inspection?.certificateExpiry)}</dd></dl>
          </Section>
          <Section title="Insurance" actions={insurance && <StatusBadge kind="insurance" status={insurance.status} />}>
            <dl className="dl"><dt>Provider</dt><dd>{insurance?.provider ?? "—"}</dd><dt>Policy</dt><dd className="mono">{insurance?.policyNumber ?? "—"}</dd><dt>Cover to</dt><dd>{formatDate(insurance?.coverageExpiry)}</dd></dl>
          </Section>
          <Section title="Assessment">{app.assessment ? <AssessmentTable assessment={app.assessment} /> : <p className="mut m-0">No assessment.</p>}</Section>
          <Section title="Payment" actions={payment && <StatusBadge kind="payment" status={payment.status} />}>
            <dl className="dl"><dt>Amount</dt><dd>{formatMoney(payment?.amount)}</dd><dt>Method</dt><dd>{payment ? PAYMENT_METHOD_LABELS[payment.method] : "—"}</dd><dt>Receipt</dt><dd className="mono">{payment?.receiptNumber ?? "—"}</dd><dt>Reference</dt><dd className="mono">{payment ? <Link href={`/payments/${payment.id}`}>{payment.reference}</Link> : "—"}</dd></dl>
          </Section>
        </div>
        <Section title="Documents" description={app.type === "renewal" ? "Renewals reuse the documents from the original registration." : "Verify every required document before approval."}>
          <DocumentsPanel application={app} canUpload={false} />
        </Section>
      </div>
      <div className="r">
        <Section title="Approval rules">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {(checklist ?? []).map((c) => <CheckRow key={c.key} ok={c.ok} label={c.label} detail={c.detail} />)}
          </ul>
          {failing.length > 0 && <Alert tone="warn" title="Cannot approve yet">{failing.map((f) => f.label).join(" · ")}</Alert>}
          {canDecide ? (
            <div className="flex flex-col gap-2.5">
              <button type="button" className="btn btn-ok btn-lg" disabled={!checklist || failing.length > 0 || busy} onClick={() => setDialog("approve")}><BadgeCheck size={18} aria-hidden="true" />Approve Registration</button>
              <button type="button" className="btn btn-s" disabled={busy} onClick={() => setDialog("return")}><Undo2 size={16} aria-hidden="true" />Return for Correction</button>
              <button type="button" className="btn btn-do" disabled={busy} onClick={() => setDialog("reject")}><XCircle size={16} aria-hidden="true" />Reject</button>
            </div>
          ) : <Alert tone="info" title="Waiting for supervisor">Switch to the Supervisor role in Demo Tools to decide.</Alert>}
        </Section>
      </div>
      <ConfirmDialog open={dialog === "approve"} onClose={() => setDialog(null)} busy={busy} tone="success" title="Approve registration?" confirmLabel="Approve Registration"
        message={<>A registration number (<span className="mono">MC-{"{PROVINCE}"}-{new Date().getFullYear()}-NNNNNN</span>), certificate number and label number are generated for <strong>{motorcycleLabel(motorcycle)}</strong>.</>}
        onConfirm={() => decide("approve", "")} />
      <ConfirmDialog open={dialog === "return"} onClose={() => setDialog(null)} busy={busy} title="Return for correction" confirmLabel="Return Application" requireReason reasonLabel="What must be corrected?"
        message="The application goes back to the registration officer. Payment, inspection and insurance are kept." onConfirm={(r) => decide("return", r)} />
      <ConfirmDialog open={dialog === "reject"} onClose={() => setDialog(null)} busy={busy} tone="danger" title="Reject application" confirmLabel="Reject Application" requireReason reasonLabel="Rejection reason"
        message="Rejection is final. The applicant must start a new application." onConfirm={(r) => decide("reject", r)} />
    </div>
  );
}
