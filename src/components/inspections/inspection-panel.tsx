"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ClipboardCheck, ClipboardList, Paperclip, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { inspectionService } from "@/services/inspection.service";
import { settingsService } from "@/services/settings.service";
import { userService } from "@/services/user.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { FAILURE_REASONS, checklistKeysFor, inspectionChecklistFor, inspectionProfileFor, inspectionRuleText } from "@/config/inspection-checklists";
import { INSPECTION_STATUS } from "@/config/statuses";
import { getVehicleType, vehicleTypeLabel } from "@/config/vehicle-types";
import { friendlyError } from "@/lib/errors";
import { formatBytes, formatDate } from "@/lib/formatting";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FileDrop } from "@/components/ui/file-upload";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Section } from "@/components/ui/layout-bits";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { ChecklistEditor, ChecklistReadOnly, checklistLabel, InspectionResultSummary, SEVERITY_OPTIONS } from "./inspection-checklist";
import type { InspectionSubmitInput, RegistrationDetail } from "@/services/interfaces";
import type { ChecklistValue, FileMeta, Inspection, InspectionDefect } from "@/types";

type ResultChoice = "pass" | "conditional" | "fail" | "reinspection";
const RESULT_OPTIONS: { value: ResultChoice; label: string; sub: string }[] = [
  { value: "pass", label: "Passed", sub: "Roadworthy — certificate issued" },
  { value: "conditional", label: "Conditional Approval", sub: "Minor defects — repairs due by a date" },
  { value: "fail", label: "Failed", sub: "Not roadworthy — owner requests reinspection later" },
  { value: "reinspection", label: "Requires Reinspection", sub: "Failed — reinspection is scheduled now" },
];
const RESULT_ON: Record<ResultChoice, string> = {
  pass: "!border-2 !border-[#137a3b] !bg-[#e9f7ef] !text-[#0b4f25]",
  conditional: "!border-2 !border-[#c25a00] !bg-[#fff8d6] !text-[#4d3900]",
  fail: "!border-2 !border-[#c4141b] !bg-[#fdecec] !text-[#7a0c13]",
  reinspection: "!border-2 !border-[#8a4100] !bg-[#ffe7cc] !text-[#5c2c00]",
};
const DONE_STATUSES = ["passed", "failed", "conditional", "reinspection_required"];

type DefectMeta = Record<string, { severity: InspectionDefect["severity"]; note: string }>;
type ExtraDefect = InspectionDefect & { note: string };

const today = () => new Date().toISOString().slice(0, 10);

/** Motor vehicle inspection for one transaction: vehicle-aware checklist, findings and result. */
export function InspectionPanel({ detail }: { detail: RegistrationDetail }) {
  const { can, user } = useDemoUser();
  const app = detail.application;
  const vehicle = detail.vehicle;
  const vehicleType = vehicle?.vehicleType;
  const canSubmit = can("inspection.submit");
  const { data: centers } = useServiceQuery(() => inspectionService.listCenters(), []);
  const { data: users } = useServiceQuery(() => userService.list(), []);
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);

  const defs = useMemo(() => inspectionChecklistFor(vehicleType), [vehicleType]);
  const keys = useMemo(() => checklistKeysFor(vehicleType), [vehicleType]);
  const profile = inspectionProfileFor(vehicleType);
  const hasEngine = getVehicleType(vehicleType).hasEngine;

  const current = detail.inspection;
  const active = current && ["scheduled", "in_progress"].includes(current.status) && app.status === "for_inspection" ? current : null;
  const done = detail.inspections.filter((i) => DONE_STATUSES.includes(i.status));
  const latestDone = done[0] ?? null;

  const [centerId, setCenterId] = useState(active?.centerId ?? "");
  const [inspectorId, setInspectorId] = useState(active?.inspectorId ?? "");
  const [date, setDate] = useState(() => (active?.inspectionDate && active.inspectionDate <= today() ? active.inspectionDate : today()));
  const [location, setLocation] = useState(active?.location ?? "");
  const [odometer, setOdometer] = useState(active?.odometerKm !== undefined ? String(active.odometerKm) : "");
  const [checklist, setChecklist] = useState<Record<string, ChecklistValue | undefined>>(active?.checklist ?? {});
  const [defectMeta, setDefectMeta] = useState<DefectMeta>({});
  const [extraDefects, setExtraDefects] = useState<ExtraDefect[]>([]);
  const [newDefect, setNewDefect] = useState("");
  const [attachments, setAttachments] = useState<FileMeta[]>(active?.attachments ?? []);
  const [result, setResult] = useState<ResultChoice | "">("");
  const [failureReason, setFailureReason] = useState("");
  const [conditions, setConditions] = useState("");
  const [conditionDue, setConditionDue] = useState("");
  const [notes, setNotes] = useState(active?.notes ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(today());
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  // Load the saved draft whenever a different attempt becomes active (a reinspection starts clean).
  const activeId = active?.id;
  useEffect(() => {
    if (!active) return;
    const known = new Set(keys);
    setCenterId((c) => active.centerId || c);
    setInspectorId((i) => active.inspectorId || i);
    setLocation((l) => active.location || l);
    setOdometer((o) => (active.odometerKm !== undefined ? String(active.odometerKm) : o));
    setNotes(active.notes ?? "");
    setChecklist(active.checklist ?? {});
    setAttachments(active.attachments ?? []);
    setDefectMeta(Object.fromEntries((active.defects ?? []).filter((d) => known.has(d.itemKey)).map((d) => [d.itemKey, { severity: d.severity, note: d.note ?? "" }])));
    setExtraDefects((active.defects ?? []).filter((d) => !known.has(d.itemKey)).map((d) => ({ ...d, note: d.note ?? "" })));
    setResult("");
    setFailureReason("");
    setConditions("");
    setConditionDue("");
    setTried(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);
  useEffect(() => {
    if (!centerId && centers?.length) setCenterId(centers.find((c) => c.status === "active")?.id ?? "");
  }, [centers, centerId]);
  useEffect(() => {
    if (!inspectorId && user) setInspectorId(user.id);
  }, [user, inspectorId]);

  const answered = keys.filter((k) => checklist[k]).length;
  const failedKeys = keys.filter((k) => checklist[k] === "fail");
  const failCount = failedKeys.length;
  const defects: InspectionDefect[] = [
    ...failedKeys.map((k) => ({ itemKey: k, label: checklistLabel(defs, k), severity: defectMeta[k]?.severity ?? "major", note: defectMeta[k]?.note || undefined })),
    ...extraDefects.map((d) => ({ itemKey: d.itemKey, label: d.label, severity: d.severity, note: d.note || undefined })),
  ];
  const dangerous = defects.some((d) => d.severity === "dangerous");
  const suggested: ResultChoice | "" = answered < keys.length ? "" : dangerous ? "fail" : failCount || extraDefects.length ? "reinspection" : "pass";
  // A manual "Passed" choice no longer applies once a defect is recorded.
  const effectiveResult: ResultChoice | "" = (result === "pass" && (failCount || extraDefects.length) ? "" : result) || suggested;
  const activeCenters = (centers ?? []).filter((c) => c.status === "active");
  const center = centers?.find((c) => c.id === centerId);
  const inspectors = useMemo(() => (users ?? []).filter((u) => u.role === "inspection_officer" || u.id === user?.id), [users, user]);
  const centerName = (id?: string) => centers?.find((c) => c.id === id)?.name;
  const userName = (id?: string) => {
    const u = users?.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}${u.employeeNumber ? ` (${u.employeeNumber})` : ""}` : undefined;
  };
  const odometerNum = odometer.trim() === "" ? undefined : Number(odometer);
  const odometerInvalid = odometerNum !== undefined && (!Number.isFinite(odometerNum) || odometerNum < 0);

  // Persist progress so an inspection can be resumed (keyed on id/status to avoid a save loop on reload).
  const activeStatus = active?.status;
  useEffect(() => {
    if (!activeId || activeStatus !== "in_progress") return;
    const t = setTimeout(() => {
      inspectionService.saveProgress(activeId, {
        checklist, centerId, inspectorId, inspectionDate: date, location: location.trim() || undefined,
        odometerKm: odometerInvalid ? undefined : odometerNum, defects, attachments, notes,
      }).catch(() => undefined);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activeStatus, checklist, centerId, inspectorId, date, location, odometer, defectMeta, extraDefects, attachments, notes]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      toast.success(ok);
      return true;
    } catch (e) {
      const msg = friendlyError(e);
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const notRequired = !app.inspectionRequired || settings?.registration.requireInspection === false;
  const header = vehicle && (
    <div className="card sec gap-3">
      <div className="sechd">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-[10px] bg-[#f4f5f8]"><VehicleIcon type={vehicleType} size={24} /></span>
          <div className="min-w-0">
            <p className="eb">Checklist profile {profile.code}</p>
            <p className="h3">Checklist for {profile.label.toLowerCase()} · {vehicleTypeLabel(vehicleType)}</p>
          </div>
        </div>
        <Badge tone={notRequired ? "draft" : "insp"}>{notRequired ? "Not required" : "Required"}</Badge>
      </div>
      <p className="mut m-0 text-[13.5px]">{inspectionRuleText(vehicleType, app.type)}. {profile.note} {keys.length} checklist items.</p>
    </div>
  );

  const history = detail.inspections.length > 0 && (
    <Section title="Inspection history" description="Every attempt is kept — reinspections never overwrite earlier results.">
      <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
        {detail.inspections.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13.5px]">
            <span className="min-w-0">
              <span className="mono font-semibold">{i.reference ?? `Attempt ${i.attempt}`}</span>
              <span className="mut block text-[12.5px]">Attempt {i.attempt} · {formatDate(i.inspectionDate)} · {i.location || centerName(i.centerId) || "—"}{i.failureReason ? ` · ${i.failureReason}` : ""}</span>
            </span>
            <span className="row gap-2">{i.certificateNumber && <span className="mono text-[12.5px]">{i.certificateNumber}</span>}<StatusBadge kind="inspection" status={i.status} /></span>
          </li>
        ))}
      </ul>
    </Section>
  );

  const summaryFor = (insp: Inspection) => (
    <InspectionResultSummary insp={insp} vehicleType={vehicleType} centerName={centerName(insp.centerId)} inspectorName={userName(insp.inspectorId)}
      reinspectionScheduled={insp.status === "failed" && detail.inspections.some((x) => x.attempt > insp.attempt)} />
  );

  if (!vehicle) {
    return <EmptyState title="Inspection record missing" message="This transaction has no vehicle record yet, so no inspection checklist can be prepared." icon={<ClipboardList size={36} />} />;
  }

  const atStage = ["for_inspection", "inspection_failed"].includes(app.status);

  if (notRequired && !atStage) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Alert tone="ok" title="Inspection not required for this transaction">{inspectionRuleText(vehicleType, app.type)}. The transaction continues without a vehicle inspection.</Alert>
        {latestDone && <Section title="Most recent inspection">{summaryFor(latestDone)}</Section>}
        {history}
      </div>
    );
  }

  if (!atStage) {
    const notReached = ["draft", "pending", "returned"].includes(app.status);
    return (
      <div className="flex flex-col gap-5">
        {header}
        {latestDone ? <Section title="Motor vehicle inspection" actions={<StatusBadge kind="inspection" status={latestDone.status} />}>{summaryFor(latestDone)}</Section>
          : notReached ? <Alert tone="info" title="Inspection not yet reached">The transaction must be submitted before the vehicle inspection.</Alert>
            : <EmptyState title="Inspection record missing" message="This transaction has passed the inspection stage but no inspection result is on file. Check the inspection history or contact a supervisor." icon={<ClipboardList size={36} />} />}
        {history}
      </div>
    );
  }

  if (app.status === "inspection_failed") {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <Alert tone="bad" title="Requires Reinspection" action={canSubmit ? (
          <button type="button" className="btn btn-p" disabled={busy} onClick={() => act(() => inspectionService.requestReinspection(app.id), "Reinspection scheduled")}>{busy ? <span className="spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}Request Reinspection</button>
        ) : undefined}>
          The vehicle failed inspection. Repairs must be completed before it is inspected again.{!canSubmit && " A vehicle inspector will schedule the reinspection."}
        </Alert>
        {error && <Alert tone="bad" title="Reinspection could not be scheduled">{error}</Alert>}
        {latestDone && <Section title="Failed inspection result">{summaryFor(latestDone)}</Section>}
        {history}
      </div>
    );
  }

  const status = active?.status ?? "not_inspected";
  const inProgress = status === "in_progress";
  const reinspection = !!active && active.attempt > 1;
  const resultLabel = RESULT_OPTIONS.find((r) => r.value === effectiveResult)?.label ?? "";

  const validate = (): string | null => {
    if (!centerId || !inspectorId || !date) return "Select the inspection centre, inspector and date.";
    if (hasEngine && odometerNum === undefined) return "Enter the odometer reading.";
    if (odometerInvalid) return "The odometer reading must be a positive number.";
    if (answered < keys.length) return `Record all ${keys.length} checklist items (${keys.length - answered} remaining).`;
    if (!effectiveResult) return "Select the inspection result.";
    if (effectiveResult === "pass" && (failCount || extraDefects.length)) return "A vehicle with failed items or recorded defects cannot pass. Select Conditional Approval, Failed or Requires Reinspection.";
    if (effectiveResult === "conditional" && (!conditions.trim() || !conditionDue)) return "Record the conditions and the repair due date for a conditional approval.";
    if ((effectiveResult === "fail" || effectiveResult === "reinspection") && (!failureReason || !notes.trim())) return "A failure reason and inspector notes are required when the vehicle fails.";
    return null;
  };

  const submit = async () => {
    if (!active) return;
    const serviceResult = effectiveResult === "reinspection" ? "fail" : (effectiveResult as "pass" | "conditional" | "fail");
    const input: InspectionSubmitInput = {
      centerId,
      inspectorId,
      inspectionDate: date,
      location: location.trim() || (center ? `${center.name}, ${center.district}` : undefined),
      odometerKm: odometerNum,
      checklist: Object.fromEntries(keys.map((k) => [k, checklist[k]])),
      defects,
      attachments,
      result: serviceResult,
      failureReason: serviceResult === "fail" ? failureReason : undefined,
      conditions: effectiveResult === "conditional" ? `${conditions.trim()} — repairs due by ${formatDate(conditionDue)}` : undefined,
      notes: notes.trim() || undefined,
    };
    const ok = await act(() => inspectionService.submit(active.id, input), effectiveResult === "pass" ? "Inspection passed" : effectiveResult === "conditional" ? "Conditional approval recorded" : "Inspection failed — recorded");
    if (!ok) return;
    setConfirm(false);
    if (effectiveResult === "reinspection") await act(() => inspectionService.requestReinspection(app.id), "Reinspection scheduled");
  };

  return (
    <div className="flex flex-col gap-5">
      {header}
      {notRequired && <Alert tone="info" title="Inspection optional">Rules do not require an inspection for this transaction, but the transaction is waiting at the inspection stage.</Alert>}
      <Section
        title={reinspection ? `Reinspection · attempt ${active?.attempt}` : "Inspection information"}
        description={`Status: ${INSPECTION_STATUS[status].label}`}
        actions={<StatusBadge kind="inspection" status={reinspection && status === "scheduled" ? "reinspection_required" : status} />}
      >
        {!canSubmit && <Alert tone="info" title="Waiting for a vehicle inspector">This transaction is in the inspection queue. Switch to the Vehicle Inspector role in Demo Tools to perform it.</Alert>}
        {error && <Alert tone="bad" title="Inspection could not be saved">{error}</Alert>}
        <div className="form">
          <Field label="Inspection Reference" htmlFor="iref" help={active?.reference ? undefined : "Assigned when the inspection is scheduled or started."}><Input id="iref" mono value={active?.reference ?? "—"} readOnly /></Field>
          <Field label="Inspection Date" required htmlFor="idt"><Input id="idt" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} disabled={!canSubmit} /></Field>
          <Field label="Inspection Centre" required htmlFor="ic"><Select id="ic" value={centerId} onChange={(e) => setCenterId(e.target.value)} disabled={!canSubmit} options={activeCenters.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select centre" invalid={tried && !centerId} /></Field>
          <Field label="Inspection Location" htmlFor="iloc" help="Defaults to the centre. Record a site or mobile-inspection address if different."><Input id="iloc" value={location} placeholder={center ? `${center.name}, ${center.district}` : ""} onChange={(e) => setLocation(e.target.value)} disabled={!canSubmit} /></Field>
          <Field label="Inspector" required htmlFor="io"><Select id="io" value={inspectorId} onChange={(e) => setInspectorId(e.target.value)} disabled={!canSubmit} options={inspectors.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}${u.employeeNumber ? ` (${u.employeeNumber})` : ""}` }))} placeholder="Select inspector" invalid={tried && !inspectorId} /></Field>
          <Field label={hasEngine ? "Odometer Reading (km)" : "Hubodometer Reading (km)"} required={hasEngine} htmlFor="odo" error={odometerInvalid ? "Enter a positive number." : tried && hasEngine && odometerNum === undefined ? "Enter the odometer reading." : undefined} help={hasEngine ? undefined : "Optional for towed vehicles."}>
            <Input id="odo" type="number" inputMode="numeric" min={0} step={1} value={odometer} onChange={(e) => setOdometer(e.target.value)} disabled={!canSubmit} invalid={odometerInvalid || (tried && hasEngine && odometerNum === undefined)} />
          </Field>
        </div>
        {canSubmit && !inProgress && (
          <div className="row">
            <button type="button" className="btn btn-p btn-lg" disabled={busy} onClick={() => act(() => inspectionService.start(app.id), reinspection ? "Reinspection started" : "Inspection started")}>{busy ? <span className="spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{reinspection ? "Start Reinspection" : "Start Inspection"}</button>
            <button type="button" className="btn btn-s" onClick={() => setSchedule(true)}><CalendarClock size={16} aria-hidden="true" />{status === "scheduled" ? "Reschedule" : "Schedule"}</button>
            {active?.status === "scheduled" && <span className="mut text-[13px]">Scheduled {formatDate(active.inspectionDate)} at {centerName(active.centerId)}</span>}
          </div>
        )}
      </Section>

      {inProgress && !canSubmit && (
        <Section title="Checklist progress" description={`${answered} of ${keys.length} items recorded by the inspector`}>
          <ChecklistReadOnly vehicleType={vehicleType} checklist={active?.checklist ?? {}} />
        </Section>
      )}

      {inProgress && canSubmit && (
        <>
          <Section
            title="Inspection checklist"
            description={<span aria-live="polite">{answered} of {keys.length} items recorded · {failCount} failed · progress saves automatically</span>}
            actions={<button type="button" className="btn btn-s btn-sm" onClick={() => setChecklist(Object.fromEntries(keys.map((k) => [k, checklist[k] ?? "pass"])))}><ClipboardCheck size={14} aria-hidden="true" />Mark remaining as Pass</button>}
          >
            <ChecklistEditor vehicleType={vehicleType} checklist={checklist} onChange={(k, v) => setChecklist((c) => ({ ...c, [k]: v }))} />
          </Section>

          <Section title="Findings" description="Failed checklist items are suggested as defects automatically — set the severity and describe the repair.">
            <div className="flex flex-col gap-3">
              <p className="lbl m-0">Defects ({defects.length})</p>
              {defects.length === 0 && <p className="mut m-0 text-[13.5px]">No defects — mark an item as Fail or add another defect below.</p>}
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {failedKeys.map((k) => {
                  const meta = defectMeta[k] ?? { severity: "major" as const, note: "" };
                  const label = checklistLabel(defs, k);
                  return (
                    <li key={k} className="rounded-[10px] border border-[#f4c3c5] bg-[#fffafa] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{label} <span className="mut text-[12px] font-normal">· from failed checklist item</span></span>
                      </div>
                      <div className="form mt-2">
                        <Field label="Severity" htmlFor={`sev-${k}`}><Select id={`sev-${k}`} value={meta.severity} options={SEVERITY_OPTIONS} onChange={(e) => setDefectMeta((m) => ({ ...m, [k]: { ...meta, severity: e.target.value as InspectionDefect["severity"] } }))} /></Field>
                        <Field label="Defect note / required repair" htmlFor={`note-${k}`}><Input id={`note-${k}`} value={meta.note} onChange={(e) => setDefectMeta((m) => ({ ...m, [k]: { ...meta, note: e.target.value } }))} /></Field>
                      </div>
                    </li>
                  );
                })}
                {extraDefects.map((d, i) => (
                  <li key={d.itemKey} className="rounded-[10px] border border-[#e1e4ea] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{d.label}</span>
                      <button type="button" className="btn btn-g btn-sm" aria-label={`Remove defect ${d.label}`} onClick={() => setExtraDefects((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} aria-hidden="true" />Remove</button>
                    </div>
                    <div className="form mt-2">
                      <Field label="Severity" htmlFor={`sev-x-${i}`}><Select id={`sev-x-${i}`} value={d.severity} options={SEVERITY_OPTIONS} onChange={(e) => setExtraDefects((x) => x.map((y, j) => (j === i ? { ...y, severity: e.target.value as InspectionDefect["severity"] } : y)))} /></Field>
                      <Field label="Defect note / required repair" htmlFor={`note-x-${i}`}><Input id={`note-x-${i}`} value={d.note} onChange={(e) => setExtraDefects((x) => x.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))} /></Field>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Other defect" htmlFor="newdef" className="min-w-[220px] flex-1"><Input id="newdef" value={newDefect} placeholder="e.g. Cracked tail-light lens" onChange={(e) => setNewDefect(e.target.value)} /></Field>
                <button type="button" className="btn btn-s" disabled={!newDefect.trim()} onClick={() => { setExtraDefects((x) => [...x, { itemKey: `other-${Date.now()}`, label: newDefect.trim(), severity: "minor", note: "" }]); setNewDefect(""); }}><Plus size={16} aria-hidden="true" />Add defect</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="lbl m-0">Photos & attachments ({attachments.length})</p>
              <p className="help m-0">VIN plate, odometer and any defects. Files stay on this device in the prototype.</p>
              {attachments.length > 0 && (
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {attachments.map((a, i) => (
                    <li key={`${a.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#e1e4ea] py-1 pr-1 pl-2.5 text-[12.5px]">
                      <Paperclip size={13} aria-hidden="true" />{a.name} <span className="mut">· {formatBytes(a.size)}</span>
                      <button type="button" className="btn btn-g btn-sm !min-h-[32px] !px-2" aria-label={`Remove ${a.name}`} onClick={() => setAttachments((x) => x.filter((_, j) => j !== i))}><Trash2 size={13} aria-hidden="true" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <FileDrop compact label="Add photo or attachment — drop file or browse" onFile={(_f, meta) => setAttachments((x) => [...x, meta])} />
            </div>
            <Field label="Inspector notes" required={effectiveResult === "fail" || effectiveResult === "reinspection"} htmlFor="inotes"><Textarea id="inotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Condition of the vehicle, identification checks, repairs required" invalid={tried && (effectiveResult === "fail" || effectiveResult === "reinspection") && !notes.trim()} /></Field>
          </Section>

          <Section title="Inspection result">
            <div className="g4" role="group" aria-label="Inspection result">
              {RESULT_OPTIONS.map((r) => {
                const blocked = r.value === "pass" && (failCount > 0 || extraDefects.length > 0);
                const on = effectiveResult === r.value;
                return (
                  <button key={r.value} type="button" aria-pressed={on} aria-disabled={blocked || undefined} aria-describedby={blocked ? "pass-blocked" : undefined}
                    onClick={() => { if (!blocked) setResult(r.value); }}
                    className={`opt flex-col !items-start ${on ? RESULT_ON[r.value] : ""} ${blocked ? "cursor-not-allowed opacity-55" : ""}`}>
                    <span className="text-[16px] font-extrabold">{on ? "● " : ""}{r.label}</span>
                    <span className="text-[12px] font-medium opacity-80">{r.sub}</span>
                    {!result && suggested === r.value && <span className="badge s-insp mt-1">Suggested</span>}
                  </button>
                );
              })}
            </div>
            {(failCount > 0 || extraDefects.length > 0) && <p id="pass-blocked" className="help m-0" role="note">{failCount + extraDefects.length} defect(s) recorded — Passed is not allowed.{suggested ? ` Suggested: ${RESULT_OPTIONS.find((r) => r.value === suggested)?.label}.` : ""}</p>}
            {effectiveResult === "conditional" && (
              <div className="form">
                <Field label="Conditions" required htmlFor="cond" className="full" error={tried && !conditions.trim() ? "Record the conditions." : undefined}><Textarea id="cond" value={conditions} onChange={(e) => setConditions(e.target.value)} rows={2} placeholder="Repairs the owner must complete" invalid={tried && !conditions.trim()} /></Field>
                <Field label="Repairs due by" required htmlFor="cdue" error={tried && !conditionDue ? "Select the due date." : undefined}><Input id="cdue" type="date" min={today()} value={conditionDue} onChange={(e) => setConditionDue(e.target.value)} invalid={tried && !conditionDue} /></Field>
              </div>
            )}
            {(effectiveResult === "fail" || effectiveResult === "reinspection") && (
              <div className="form">
                <Field label="Failure Reason" required htmlFor="fr" error={tried && !failureReason ? "Select the failure reason." : undefined}><Select id="fr" value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Select reason" options={FAILURE_REASONS} invalid={tried && !failureReason} /></Field>
              </div>
            )}
            <p className="help m-0">An inspection certificate is issued on Passed or Conditional Approval and attached to the transaction documents.</p>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {answered < keys.length && <p className="help m-0">Record all {keys.length} checklist items to submit.</p>}
              <button type="button" className={`btn btn-lg ${effectiveResult === "pass" ? "btn-ok" : effectiveResult === "conditional" ? "btn-k" : "btn-d"}`} disabled={busy || !effectiveResult || answered < keys.length} onClick={() => {
                setTried(true);
                const problem = validate();
                if (problem) {
                  setError(problem);
                  toast.error(problem);
                  return;
                }
                setError(null);
                setConfirm(true);
              }}>Record result{resultLabel ? ` — ${resultLabel}` : ""}</button>
            </div>
          </Section>
        </>
      )}
      {history}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={busy}
        title={`Record ${resultLabel || "inspection"} result?`}
        tone={effectiveResult === "pass" ? "success" : effectiveResult === "conditional" ? "dark" : "danger"}
        confirmLabel="Record result"
        message={
          effectiveResult === "pass" ? "An inspection certificate number is generated and the transaction moves to the next stage."
            : effectiveResult === "conditional" ? `A certificate is issued with conditions (repairs due by ${formatDate(conditionDue)}) and the transaction moves to the next stage.`
              : effectiveResult === "reinspection" ? `The inspection is recorded as failed (${failureReason}) and a reinspection is scheduled immediately.`
                : `The transaction is marked Requires Reinspection (${failureReason}). The owner must repair the vehicle before a reinspection is requested.`
        }
        onConfirm={submit}
      />
      <Modal open={schedule} onClose={() => setSchedule(false)} title="Schedule inspection" size="sm" footer={
        <>
          <button type="button" className="btn btn-s" onClick={() => setSchedule(false)}>Cancel</button>
          <button type="button" className="btn btn-p" disabled={!centerId || busy} onClick={async () => { if (await act(() => inspectionService.schedule(app.id, { centerId, inspectionDate: scheduleDate }), "Inspection scheduled")) setSchedule(false); }}>Schedule</button>
        </>
      }>
        <div className="flex flex-col gap-4">
          <Field label="Inspection Centre" required htmlFor="sc"><Select id="sc" value={centerId} onChange={(e) => setCenterId(e.target.value)} options={activeCenters.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Date" required htmlFor="sd"><Input id="sd" type="date" value={scheduleDate} min={today()} onChange={(e) => setScheduleDate(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
