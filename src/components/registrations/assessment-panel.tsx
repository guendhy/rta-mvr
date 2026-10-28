"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { assessmentService } from "@/services/assessment.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/formatting";
import { Alert } from "@/components/ui/feedback";
import { Section } from "@/components/ui/layout-bits";
import { CheckRow } from "./cards";
import type { RegistrationDetail } from "@/services/interfaces";
import type { Assessment, FeeCode } from "@/types";

export function AssessmentTable({ assessment }: { assessment: Assessment }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-[#e1e4ea]">
      <table className="tbl">
        <thead><tr><th>Fee</th><th className="num">Amount (PGK)</th></tr></thead>
        <tbody>
          {assessment.lines.map((l) => <tr key={l.feeCode}><td>{l.name}</td><td className="num font-semibold">{formatMoney(l.amount)}</td></tr>)}
          <tr><td className="!bg-[#0b0b0f] text-[15px] font-extrabold !text-white">TOTAL</td><td className="num !bg-[#0b0b0f] text-[18px] font-extrabold !text-[#ffd21a]">{formatMoney(assessment.total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** Fee assessment + pre-payment validation checklist (spec §24–25). Fees come from configuration. */
export function AssessmentPanel({ detail, onProceed }: { detail: RegistrationDetail; onProceed?: () => void }) {
  const { can } = useDemoUser();
  const app = detail.application;
  const [optional, setOptional] = useState<FeeCode[]>([]);
  const [busy, setBusy] = useState(false);
  const { data: fees } = useServiceQuery(() => assessmentService.listFees(), []);
  const { data: checklist } = useServiceQuery(() => assessmentService.checklist(app.id), [app.id, app.status, app.updatedAt]);
  const { data: preview, loading } = useServiceQuery(() => assessmentService.preview(app.id, optional), [app.id, optional.join(",")]);
  const atStage = app.status === "for_assessment";
  const prereqs = (checklist ?? []).filter((c) => c.key !== "assessment");
  const ready = prereqs.length > 0 && prereqs.every((c) => c.ok);
  const shown = atStage ? preview : app.assessment;

  if (!atStage && !app.assessment) {
    return <Alert tone="info" title="Assessment not yet reached">Inspection and insurance verification must be completed first.</Alert>;
  }

  return (
    <div className="split">
      <div className="l">
        <Section title="Registration assessment" description={atStage ? "Fees are read from the configured fee schedule (Administration → Fees)." : `Generated ${formatDateTime(app.assessment?.generatedAt)} by ${app.assessment?.generatedBy}`}>
          {detail.motorcycle && (
            <p className="m-0 text-[13.5px]">{app.type === "renewal" ? "Renewal" : "New registration"} · {detail.motorcycle.sidecar ? <strong>With sidecar</strong> : "Without sidecar"} · {detail.motorcycle.engineCapacityCc} cc</p>
          )}
          {shown ? <AssessmentTable assessment={shown} /> : loading ? <div className="sk h-40" /> : null}
          {atStage && fees && (
            <details className="rounded-[10px] border border-[#e1e4ea] p-3.5">
              <summary className="cursor-pointer text-[13.5px] font-semibold">Optional fees (demo mode)</summary>
              <div className="mt-3 flex flex-col gap-1">
                {fees.filter((f) => f.optional && f.active).map((f) => (
                  <label key={f.code} className="flex min-h-[40px] items-center justify-between gap-3 rounded-md px-2 hover:bg-[#f4f5f8]">
                    <span className="row gap-2.5"><input type="checkbox" className="chk" checked={optional.includes(f.code)} onChange={(e) => setOptional((o) => (e.target.checked ? [...o, f.code] : o.filter((c) => c !== f.code)))} />{f.name}</span>
                    <span className="num font-semibold">{formatMoney(f.amount)}</span>
                  </label>
                ))}
              </div>
            </details>
          )}
        </Section>
      </div>
      <div className="r">
        <Section title="Ready for payment?">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {(checklist ?? []).map((c) => <CheckRow key={c.key} ok={c.key === "assessment" && atStage ? false : c.ok} label={c.label} detail={c.key === "assessment" && atStage ? "Generate to continue" : c.detail} />)}
          </ul>
          {atStage ? (
            can("assessment.generate") ? (
              <button type="button" className="btn btn-p btn-lg w-full" disabled={!ready || busy} onClick={async () => {
                setBusy(true);
                try {
                  await assessmentService.generate(app.id, optional);
                  toast.success("Assessment generated");
                  onProceed?.();
                } catch (e) {
                  toast.error(friendlyError(e));
                } finally {
                  setBusy(false);
                }
              }}>
                {busy ? <span className="spin" aria-hidden="true" /> : <Calculator size={18} aria-hidden="true" />}Generate &amp; Proceed to Payment
              </button>
            ) : <Alert tone="info" title="Waiting for assessment">A registration officer generates the assessment.</Alert>
          ) : onProceed && app.status === "payment_required" ? (
            <button type="button" className="btn btn-p btn-lg w-full" onClick={onProceed}>Proceed to Payment</button>
          ) : null}
          {atStage && !ready && <p className="help m-0">Proceed to Payment is disabled until every requirement is met.</p>}
        </Section>
      </div>
    </div>
  );
}
