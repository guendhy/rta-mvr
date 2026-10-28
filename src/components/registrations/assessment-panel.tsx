"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { assessmentService } from "@/services/assessment.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/formatting";
import { monthsOverdue, optionalFeeRules } from "@/lib/fees";
import { REGISTRATION_PERIODS } from "@/config/fee-rules";
import { getTransactionType, transactionLabel } from "@/config/transaction-types";
import { vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { plateCategoryFor, plateCategoryLabel, vehicleUsageLabel } from "@/config/vehicle-usage";
import { formatSpecValue } from "@/config/vehicle-fields";
import { ownershipTypeLabel } from "@/config/ownership-types";
import { Alert } from "@/components/ui/feedback";
import { DescriptionList, Section } from "@/components/ui/layout-bits";
import { Segmented } from "@/components/ui/form";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import { CheckRow } from "./cards";
import type { RegistrationDetail } from "@/services/interfaces";
import type { Assessment } from "@/types";

/** @deprecated use FeeBreakdown — kept for existing imports. */
export function AssessmentTable({ assessment }: { assessment: Assessment }) {
  return <FeeBreakdown assessment={assessment} />;
}

/** Fee assessment + pre-payment validation checklist. Every amount comes from the fee rules. */
export function AssessmentPanel({ detail, onProceed }: { detail: RegistrationDetail; onProceed?: () => void }) {
  const { can } = useDemoUser();
  const app = detail.application;
  const v = detail.vehicle;
  const def = getTransactionType(app.type);
  const [optional, setOptional] = useState<string[]>([]);
  const [period, setPeriod] = useState("12");
  const [busy, setBusy] = useState(false);
  const atStage = app.status === "for_assessment";
  const options = useMemo(() => ({ optionalCodes: optional, periodMonths: Number(period) }), [optional, period]);
  const { data: rules } = useServiceQuery(() => assessmentService.listFeeRules(), []);
  const { data: checklist } = useServiceQuery(() => assessmentService.checklist(app.id), [app.id, app.status, app.updatedAt]);
  const { data: preview, loading } = useServiceQuery(() => assessmentService.preview(app.id, options), [app.id, optional.join(","), period]);
  const prereqs = (checklist ?? []).filter((c) => c.key !== "assessment");
  const ready = prereqs.length > 0 && prereqs.every((c) => c.ok);
  const shown = atStage ? preview : app.assessment;
  const cls = app.type === "reclassification" ? { ...v, ...app.draft.classification } : v;
  const optionalRules = useMemo(
    () => (rules && cls?.vehicleType ? optionalFeeRules({ transactionType: app.type, vehicleType: cls.vehicleType, vehicleUsage: cls.vehicleUsage!, specifications: v?.specifications, rules }) : []),
    [rules, cls?.vehicleType, cls?.vehicleUsage, app.type, v?.specifications],
  );

  if (!atStage && !app.assessment) {
    return <Alert tone="info" title="Assessment not yet reached">Verification, inspection and insurance (where required) must be completed first.</Alert>;
  }

  const overdue = monthsOverdue(v?.registrationExpiry);
  const specs = v?.specifications ?? {};
  return (
    <div className="split">
      <div className="l">
        <Section title="Fee assessment" description={atStage ? "Calculated by the fee engine from the configured fee rules (Administration → Fees & Penalties)." : `Generated ${formatDateTime(app.assessment?.generatedAt)} by ${app.assessment?.generatedBy} · rule set ${app.assessment?.ruleSet}`}>
          {atStage && def.renewsPeriod && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="lbl !mb-0">Registration period</span>
              <Segmented label="Registration period" value={period} onChange={setPeriod} options={REGISTRATION_PERIODS.map((p) => ({ value: String(p.months), label: p.label }))} />
            </div>
          )}
          {shown ? <FeeBreakdown assessment={shown} /> : loading ? <div className="sk h-40" /> : null}
          {atStage && optionalRules.length > 0 && (
            <details className="rounded-[10px] border border-[#e1e4ea] p-3.5">
              <summary className="cursor-pointer text-[13.5px] font-semibold">Optional charges</summary>
              <div className="mt-3 flex flex-col gap-1">
                {optionalRules.map((f) => (
                  <label key={f.code} className="flex min-h-[40px] items-center justify-between gap-3 rounded-md px-2 hover:bg-[#f4f5f8]">
                    <span className="row gap-2.5"><input type="checkbox" className="chk" checked={optional.includes(f.code)} onChange={(e) => setOptional((o) => (e.target.checked ? [...o, f.code] : o.filter((c) => c !== f.code)))} />{f.name}</span>
                    <span className="num font-semibold">{formatMoney(f.amount)}</span>
                  </label>
                ))}
              </div>
            </details>
          )}
        </Section>
        {cls?.vehicleType && (
          <Section title="Assessment inputs" description="The values the fee engine used. Changing them re-runs the assessment.">
            <DescriptionList items={[
              ["Transaction", transactionLabel(app.type)],
              ["Vehicle type", vehicleTypeLabel(cls.vehicleType)],
              ["Classification", vehicleClassLabel(cls.vehicleType, cls.vehicleClass)],
              ["Vehicle use", vehicleUsageLabel(cls.vehicleUsage)],
              ["Engine capacity", formatSpecValue("engineCapacityCc", specs.engineCapacityCc)],
              ["Gross vehicle mass", formatSpecValue("grossVehicleMassKg", specs.grossVehicleMassKg)],
              ["Seating", formatSpecValue("seatingCapacity", specs.seatingCapacity)],
              ["Inspection", app.inspectionRequired ? "Required" : "Not required"],
              ["Plate", app.plateRequired ? `New ${plateCategoryLabel(plateCategoryFor(cls.vehicleType, cls.vehicleUsage))} plate` : "Existing plate retained"],
              ["Penalties", overdue > 0 && (app.type === "renewal" || app.type === "reinstatement") ? `${overdue} month(s) past expiry` : "None"],
              ["Ownership", ownershipTypeLabel(detail.owner?.ownershipType)],
            ]} />
          </Section>
        )}
      </div>
      <div className="r">
        <Section title="Ready for review &amp; payment?">
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {(checklist ?? []).map((c) => <CheckRow key={c.key} ok={c.key === "assessment" && atStage ? false : c.ok} label={c.label} detail={c.key === "assessment" && atStage ? "Generate to continue" : c.detail} />)}
          </ul>
          {atStage ? (
            can("assessment.generate") ? (
              <button type="button" className="btn btn-p btn-lg w-full" disabled={!ready || busy} onClick={async () => {
                setBusy(true);
                try {
                  await assessmentService.generate(app.id, options);
                  toast.success("Assessment generated");
                  onProceed?.();
                } catch (e) {
                  toast.error(friendlyError(e));
                } finally {
                  setBusy(false);
                }
              }}>
                {busy ? <span className="spin" aria-hidden="true" /> : <Calculator size={18} aria-hidden="true" />}Generate Assessment &amp; Review
              </button>
            ) : <Alert tone="info" title="Waiting for assessment">A registration officer generates the assessment.</Alert>
          ) : onProceed && app.status === "payment_required" ? (
            <button type="button" className="btn btn-p btn-lg w-full" onClick={onProceed}>Review Application</button>
          ) : null}
          {atStage && !ready && <p className="help m-0">Generate is disabled until every requirement is met.</p>}
        </Section>
      </div>
    </div>
  );
}
