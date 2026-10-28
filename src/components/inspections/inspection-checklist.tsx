"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, Paperclip, XCircle } from "lucide-react";
import { inspectionChecklistFor, inspectionProfileFor } from "@/config/inspection-checklists";
import { formatBytes, formatDate, formatDateTime } from "@/lib/formatting";
import { DescriptionList } from "@/components/ui/layout-bits";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import type { BadgeTone } from "@/config/statuses";
import type { ChecklistCategoryDef, ChecklistValue, Inspection, InspectionDefect, VehicleType } from "@/types";

export const SEVERITY_OPTIONS: { value: InspectionDefect["severity"]; label: string }[] = [
  { value: "minor", label: "Minor" },
  { value: "major", label: "Major" },
  { value: "dangerous", label: "Dangerous" },
];
export const SEVERITY_TONE: Record<InspectionDefect["severity"], BadgeTone> = { minor: "pend", major: "payq", dangerous: "bad" };

const VALUE_LABEL: Record<ChecklistValue, string> = { pass: "Pass", fail: "Fail", na: "N/A" };
const VALUE_TONE: Record<ChecklistValue, BadgeTone> = { pass: "ok", fail: "bad", na: "draft" };

/** Label lookup across every checklist profile (for items saved under another vehicle type). */
export function checklistLabel(defs: ChecklistCategoryDef[], key: string): string {
  for (const c of defs) {
    const item = c.items.find((i) => i.key === key);
    if (item) return item.label;
  }
  return key.replace(/_/g, " ");
}

/**
 * Vehicle-aware checklist. Each item is a labelled group of toggle buttons (aria-pressed) —
 * keyboard operable with Tab / Space / Enter, 44 px targets on touch screens.
 */
export function ChecklistEditor({ vehicleType, checklist, onChange, disabled }: {
  vehicleType: VehicleType | string | undefined;
  checklist: Record<string, ChecklistValue | undefined>;
  onChange: (key: string, value: ChecklistValue) => void;
  disabled?: boolean;
}) {
  const defs = inspectionChecklistFor(vehicleType);
  const profile = inspectionProfileFor(vehicleType);
  return (
    <div className="g2">
      {defs.map((cat) => {
        const typeSpecific = profile.extra?.key === cat.key;
        const failed = cat.items.filter((i) => checklist[i.key] === "fail").length;
        return (
          <fieldset key={cat.key} className={`m-0 min-w-0 rounded-[10px] border p-3.5 ${typeSpecific ? "border-[#cfcffb] bg-[#fafaff]" : "border-[#e1e4ea]"}`}>
            <legend className="flex flex-wrap items-center gap-2 px-1 text-[13px] font-bold">
              {cat.label}
              {typeSpecific && <Badge tone="insp">{profile.label} only</Badge>}
              {failed > 0 && <Badge tone="bad">{failed} failed</Badge>}
            </legend>
            <ul className="m-0 flex list-none flex-col p-0">
              {cat.items.map((item) => {
                const v = checklist[item.key];
                const labelId = `ck-${item.key}`;
                return (
                  <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edeff3] py-2 last:border-0">
                    <span id={labelId} className="min-w-[150px] flex-1 text-[13.5px]">{item.label}</span>
                    <div className="pf" role="group" aria-labelledby={labelId}>
                      {(["pass", "fail", "na"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          aria-pressed={v === opt}
                          disabled={disabled}
                          className={`!min-h-[44px] sm:!min-h-[38px] ${v === opt ? (opt === "pass" ? "p" : opt === "fail" ? "f" : "n") : ""}`}
                          onClick={() => onChange(item.key, opt)}
                        >
                          {v === opt && <span aria-hidden="true">{opt === "pass" ? "✓ " : opt === "fail" ? "✕ " : ""}</span>}
                          {VALUE_LABEL[opt]}
                        </button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

export function ChecklistReadOnly({ vehicleType, checklist }: { vehicleType: VehicleType | string | undefined; checklist: Record<string, ChecklistValue | undefined> }) {
  const defs = inspectionChecklistFor(vehicleType);
  return (
    <div className="g2">
      {defs.map((cat) => (
        <div key={cat.key} className="rounded-[10px] border border-[#e1e4ea] p-3.5">
          <p className="m-0 mb-1.5 text-[13px] font-bold">{cat.label}</p>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {cat.items.map((item) => {
              const v = checklist[item.key];
              return (
                <li key={item.key} className="flex items-center justify-between gap-2 text-[13.5px]">
                  <span>{item.label}</span>
                  {v ? <Badge tone={VALUE_TONE[v]}>{VALUE_LABEL[v]}</Badge> : <span className="mut">Not recorded</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function DefectList({ defects }: { defects: InspectionDefect[] }) {
  if (!defects.length) return <p className="mut m-0 text-[13.5px]">No defects recorded.</p>;
  return (
    <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
      {defects.map((d) => (
        <li key={d.itemKey} className="flex flex-wrap items-start justify-between gap-2 py-2 text-[13.5px]">
          <span className="min-w-0"><span className="font-semibold">{d.label}</span>{d.note && <span className="mut block text-[12.5px]">{d.note}</span>}</span>
          <Badge tone={SEVERITY_TONE[d.severity]}>{SEVERITY_OPTIONS.find((s) => s.value === d.severity)?.label}</Badge>
        </li>
      ))}
    </ul>
  );
}

const RESULT_VIEW = {
  passed: { title: "Passed — Roadworthy", bg: "bg-[#e9f7ef]", fg: "text-[#0b4f25]", Icon: CheckCircle2, icon: "text-[#137a3b]" },
  conditional: { title: "Conditional Approval", bg: "bg-[#fff8d6]", fg: "text-[#4d3900]", Icon: AlertTriangle, icon: "text-[#c25a00]" },
  failed: { title: "Failed — Not roadworthy", bg: "bg-[#fdecec]", fg: "text-[#7a0c13]", Icon: XCircle, icon: "text-[#c4141b]" },
  reinspection_required: { title: "Requires Reinspection", bg: "bg-[#ffe7cc]", fg: "text-[#5c2c00]", Icon: XCircle, icon: "text-[#8a4100]" },
  other: { title: "Not completed", bg: "bg-[#f4f5f8]", fg: "text-[#0b0b0f]", Icon: CircleSlash, icon: "text-[#474d59]" },
} as const;

/** Read-only record of a submitted inspection. */
export function InspectionResultSummary({ insp, vehicleType, centerName, inspectorName, reinspectionScheduled }: {
  insp: Inspection;
  vehicleType: VehicleType | string | undefined;
  centerName?: string;
  inspectorName?: string;
  /** A later attempt exists for this failed inspection. */
  reinspectionScheduled?: boolean;
}) {
  const key = insp.status === "failed" && reinspectionScheduled ? "reinspection_required" : insp.status in RESULT_VIEW ? (insp.status as keyof typeof RESULT_VIEW) : "other";
  const view = RESULT_VIEW[key];
  const defects = insp.defects ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-wrap items-center gap-4 rounded-[10px] p-4 ${view.bg}`}>
        <view.Icon size={44} className={`flex-none ${view.icon}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className={`m-0 text-[20px] font-extrabold sm:text-[22px] ${view.fg}`}>{view.title}</p>
          <p className="m-0 text-[13px]">Attempt {insp.attempt} · submitted {formatDateTime(insp.submittedAt)}</p>
        </div>
        <StatusBadge kind="inspection" status={insp.status} />
      </div>
      <DescriptionList items={[
        ["Inspection reference", <span key="r" className="mono">{insp.reference ?? "—"}</span>],
        ["Inspector", inspectorName],
        ["Inspection date", formatDate(insp.inspectionDate)],
        ["Location", insp.location || centerName],
        ...(insp.location && centerName && insp.location !== centerName ? [["Inspection centre", centerName] as [string, React.ReactNode]] : []),
        ["Odometer", insp.odometerKm !== undefined ? `${insp.odometerKm.toLocaleString("en-PG")} km` : "Not recorded"],
        ["Certificate number", insp.certificateNumber ? <span key="c" className="mono">{insp.certificateNumber}</span> : "—"],
        ["Certificate validity", insp.certificateDate ? `${formatDate(insp.certificateDate)} – ${formatDate(insp.certificateExpiry)}` : "—"],
        ...(insp.failureReason ? [["Failure reason", insp.failureReason] as [string, React.ReactNode]] : []),
        ...(insp.conditions ? [["Conditions", insp.conditions] as [string, React.ReactNode]] : []),
        ["Notes", insp.notes],
      ]} />
      <div className="flex flex-col gap-2">
        <p className="lbl m-0">Defects</p>
        <DefectList defects={defects} />
      </div>
      {!!insp.attachments?.length && (
        <div className="flex flex-col gap-2">
          <p className="lbl m-0">Photos & attachments</p>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {insp.attachments.map((a, i) => (
              <li key={`${a.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1e4ea] px-2.5 py-1.5 text-[12.5px]"><Paperclip size={13} aria-hidden="true" />{a.name} <span className="mut">· {formatBytes(a.size)}</span></li>
            ))}
          </ul>
        </div>
      )}
      <ChecklistReadOnly vehicleType={vehicleType} checklist={insp.checklist} />
    </div>
  );
}
