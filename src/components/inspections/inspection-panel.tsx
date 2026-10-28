"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ClipboardCheck, Play, RotateCcw } from "lucide-react";
import { inspectionService } from "@/services/inspection.service";
import { userService } from "@/services/user.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { CHECKLIST_KEYS, FAILURE_REASONS, INSPECTION_CHECKLIST, INSPECTION_STATUS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/formatting";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { DescriptionList, Section } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RegistrationDetail } from "@/services/interfaces";
import type { ChecklistValue, Inspection } from "@/types";

function ChecklistView({ checklist, onChange, readOnly }: { checklist: Record<string, ChecklistValue | undefined>; onChange?: (key: string, v: ChecklistValue) => void; readOnly?: boolean }) {
  return (
    <div className="g2">
      {INSPECTION_CHECKLIST.map((cat) => (
        <fieldset key={cat.key} className="m-0 rounded-[10px] border border-[#e1e4ea] p-3.5">
          <legend className="px-1 text-[13px] font-bold">{cat.label}</legend>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {cat.items.map((item) => {
              const v = checklist[item.key];
              return (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px]">{item.label}</span>
                  {readOnly ? (
                    <span className={`badge ${v === "pass" ? "s-ok" : v === "fail" ? "s-bad" : "s-draft"}`}>{v === "pass" ? "Pass" : v === "fail" ? "Fail" : v === "na" ? "N/A" : "—"}</span>
                  ) : (
                    <div className="pf" role="radiogroup" aria-label={item.label}>
                      {(["pass", "fail", "na"] as const).map((opt) => (
                        <button key={opt} type="button" role="radio" aria-checked={v === opt} className={v === opt ? (opt === "pass" ? "p" : opt === "fail" ? "f" : "n") : ""} onClick={() => onChange?.(item.key, opt)}>
                          {opt === "pass" ? "Pass" : opt === "fail" ? "Fail" : "N/A"}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
    </div>
  );
}

function ResultSummary({ insp, centerName, inspectorName }: { insp: Inspection; centerName?: string; inspectorName?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={`flex flex-wrap items-center gap-4 rounded-[10px] p-4 ${insp.result === "pass" ? "bg-[#e9f7ef]" : "bg-[#fdecec]"}`}>
        <span className={`grid h-12 w-12 place-items-center rounded-full text-[20px] font-extrabold text-white ${insp.result === "pass" ? "bg-[#137a3b]" : "bg-[#c4141b]"}`} aria-hidden="true">{insp.result === "pass" ? "✓" : "✕"}</span>
        <div>
          <p className="m-0 text-[22px] font-extrabold" style={{ color: insp.result === "pass" ? "#0b4f25" : "#7a0c13" }}>{insp.result === "pass" ? "PASS — Roadworthy" : "FAIL — Not roadworthy"}</p>
          <p className="m-0 text-[13px]">Attempt {insp.attempt} · submitted {formatDateTime(insp.submittedAt)}</p>
        </div>
      </div>
      <DescriptionList items={[
        ["Inspection station", centerName],
        ["Inspector", inspectorName],
        ["Inspection date", formatDate(insp.inspectionDate)],
        ["Certificate number", insp.certificateNumber ? <span key="c" className="mono">{insp.certificateNumber}</span> : "—"],
        ["Certificate date", formatDate(insp.certificateDate)],
        ["Certificate expiry", formatDate(insp.certificateExpiry)],
        ...(insp.result === "fail" ? [["Failure reason", insp.failureReason] as [string, React.ReactNode]] : []),
        ["Notes", insp.notes],
      ]} />
      <ChecklistView checklist={insp.checklist} readOnly />
    </div>
  );
}

/** Roadworthiness inspection workflow for one application (spec §21). */
export function InspectionPanel({ detail }: { detail: RegistrationDetail }) {
  const { can, user } = useDemoUser();
  const app = detail.application;
  const canSubmit = can("inspection.submit");
  const { data: centers } = useServiceQuery(() => inspectionService.listCenters(), []);
  const { data: users } = useServiceQuery(() => userService.list(), []);
  const current = detail.inspection;
  const active = current && ["scheduled", "in_progress"].includes(current.status) && app.status === "for_inspection" ? current : null;
  const latestDone = detail.inspections.find((i) => i.status === "passed" || i.status === "failed") ?? null;

  const [centerId, setCenterId] = useState(active?.centerId ?? "");
  const [inspectorId, setInspectorId] = useState(active?.inspectorId ?? "");
  const [date, setDate] = useState(active?.inspectionDate ?? new Date().toISOString().slice(0, 10));
  const [checklist, setChecklist] = useState<Record<string, ChecklistValue | undefined>>(active?.checklist ?? {});
  const [result, setResult] = useState<"pass" | "fail" | "">("");
  const [failureReason, setFailureReason] = useState("");
  const [notes, setNotes] = useState(active?.notes ?? "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (active) {
      setCenterId((c) => c || active.centerId || "");
      setInspectorId((i) => i || active.inspectorId || "");
      setChecklist((c) => (Object.keys(c).length ? c : active.checklist));
    }
  }, [active]);
  useEffect(() => {
    if (!centerId && centers?.length) setCenterId(centers.find((c) => c.status === "active")?.id ?? "");
  }, [centers, centerId]);
  useEffect(() => {
    if (!inspectorId && user) setInspectorId(user.id);
  }, [user, inspectorId]);

  const answered = CHECKLIST_KEYS.filter((k) => checklist[k]).length;
  const anyFail = CHECKLIST_KEYS.some((k) => checklist[k] === "fail");
  const suggested = answered === CHECKLIST_KEYS.length ? (anyFail ? "fail" : "pass") : "";
  const effectiveResult = result || suggested;
  const inspectors = useMemo(() => (users ?? []).filter((u) => u.role === "inspection_officer" || u.id === user?.id), [users, user]);
  const centerName = (id?: string) => centers?.find((c) => c.id === id)?.name;
  const userName = (id?: string) => {
    const u = users?.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : undefined;
  };

  // Persist checklist progress so an inspection can be resumed.
  useEffect(() => {
    if (!active || active.status !== "in_progress") return;
    const t = setTimeout(() => inspectionService.saveProgress(active.id, { checklist, centerId, inspectorId, inspectionDate: date, notes }).catch(() => undefined), 1200);
    return () => clearTimeout(t);
  }, [active, checklist, centerId, inspectorId, date, notes]);

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

  const history = detail.inspections.length > 0 && (
    <Section title="Inspection history" description="Every attempt is kept — reinspections never overwrite earlier results.">
      <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
        {detail.inspections.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[13.5px]">
            <span>Attempt {i.attempt} · {formatDate(i.inspectionDate)} · {centerName(i.centerId) ?? "—"}{i.failureReason ? ` · ${i.failureReason}` : ""}</span>
            <span className="row gap-2">{i.certificateNumber && <span className="mono text-[12.5px]">{i.certificateNumber}</span>}<StatusBadge kind="inspection" status={i.status} /></span>
          </li>
        ))}
      </ul>
    </Section>
  );

  // Already past inspection: show the passed result.
  if (!["for_inspection", "inspection_failed"].includes(app.status)) {
    return (
      <div className="flex flex-col gap-5">
        {latestDone ? <Section title="Roadworthiness inspection"><ResultSummary insp={latestDone} centerName={centerName(latestDone.centerId)} inspectorName={userName(latestDone.inspectorId)} /></Section>
          : <Alert tone="info" title="Inspection not yet reached">The application must be submitted before the roadworthiness inspection.</Alert>}
        {history}
      </div>
    );
  }

  if (app.status === "inspection_failed") {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="bad" title="Inspection failed — reinspection required" action={canSubmit ? (
          <button type="button" className="btn btn-p" disabled={busy} onClick={() => act(() => inspectionService.requestReinspection(app.id), "Reinspection scheduled")}><RotateCcw size={16} aria-hidden="true" />Request Reinspection</button>
        ) : undefined}>
          Repairs must be completed before the motorcycle is inspected again.{!canSubmit && " An Inspection Officer will schedule the reinspection."}
        </Alert>
        {latestDone && <Section title="Failed inspection result"><ResultSummary insp={latestDone} centerName={centerName(latestDone.centerId)} inspectorName={userName(latestDone.inspectorId)} /></Section>}
        {history}
      </div>
    );
  }

  const status = active?.status ?? "not_inspected";
  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Roadworthiness inspection"
        description={`Status: ${INSPECTION_STATUS[status].label}${active?.attempt && active.attempt > 1 ? ` · Reinspection (attempt ${active.attempt})` : ""}`}
        actions={<StatusBadge kind="inspection" status={status} />}
      >
        {!canSubmit && <Alert tone="info" title="Waiting for an Inspection Officer">This application is in the inspection queue. Switch to the Inspection Officer role in Demo Tools to perform it.</Alert>}
        {error && <Alert tone="bad" title="Inspection could not be saved">{error}</Alert>}
        <div className="form">
          <Field label="Inspection Station" required htmlFor="ic"><Select id="ic" value={centerId} onChange={(e) => setCenterId(e.target.value)} disabled={!canSubmit} options={(centers ?? []).filter((c) => c.status === "active").map((c) => ({ value: c.id, label: c.name }))} placeholder="Select station" /></Field>
          <Field label="Inspector" required htmlFor="io"><Select id="io" value={inspectorId} onChange={(e) => setInspectorId(e.target.value)} disabled={!canSubmit} options={inspectors.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} placeholder="Select inspector" /></Field>
          <Field label="Inspection Date" required htmlFor="idt"><Input id="idt" type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} disabled={!canSubmit} /></Field>
          <Field label="Certificate Number" htmlFor="cn" help="Generated automatically when the inspection passes."><Input id="cn" value="Issued on PASS" readOnly /></Field>
          <Field label="Certificate Date" htmlFor="cd"><Input id="cd" value={effectiveResult === "pass" ? formatDate(date) : "—"} readOnly /></Field>
          <Field label="Certificate Expiry" htmlFor="ce" help="Valid for 3 months."><Input id="ce" value={effectiveResult === "pass" ? formatDate(new Date(new Date(date).setMonth(new Date(date).getMonth() + 3))) : "—"} readOnly /></Field>
        </div>
        {canSubmit && status !== "in_progress" && (
          <div className="row">
            <button type="button" className="btn btn-p btn-lg" disabled={busy} onClick={() => act(() => inspectionService.start(app.id), "Inspection started")}>{busy ? <span className="spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}Start Inspection</button>
            <button type="button" className="btn btn-s" onClick={() => setSchedule(true)}><CalendarClock size={16} aria-hidden="true" />{status === "scheduled" ? "Reschedule" : "Schedule"}</button>
            {active?.status === "scheduled" && <span className="mut text-[13px]">Scheduled {formatDate(active.inspectionDate)} at {centerName(active.centerId)}</span>}
          </div>
        )}
      </Section>

      {status === "in_progress" && canSubmit && (
        <>
          <Section title="Checklist" description={`${answered} of ${CHECKLIST_KEYS.length} items recorded · progress saves automatically`} actions={
            <button type="button" className="btn btn-s btn-sm" onClick={() => setChecklist(Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, checklist[k] ?? "pass"])))}><ClipboardCheck size={14} aria-hidden="true" />Mark remaining as Pass</button>
          }>
            <ChecklistView checklist={checklist} onChange={(k, v) => setChecklist((c) => ({ ...c, [k]: v }))} />
          </Section>
          <Section title="Overall result">
            <div className="grid grid-cols-2 gap-3">
              {(["pass", "fail"] as const).map((r) => (
                <button key={r} type="button" aria-pressed={effectiveResult === r} onClick={() => setResult(r)} className={`opt justify-center !text-[18px] !font-extrabold ${effectiveResult === r ? (r === "pass" ? "!border-2 !border-[#137a3b] !bg-[#e9f7ef] !text-[#0b4f25]" : "!border-2 !border-[#c4141b] !bg-[#fdecec] !text-[#7a0c13]") : ""}`}>
                  {r === "pass" ? "PASS" : "FAIL"}
                </button>
              ))}
            </div>
            {effectiveResult === "pass" && anyFail && <Alert tone="warn" title="Failed items recorded">A motorcycle with failed checklist items cannot pass. Correct the checklist or select FAIL.</Alert>}
            {effectiveResult === "fail" && (
              <div className="form">
                <Field label="Failure Reason" required htmlFor="fr"><Select id="fr" value={failureReason} onChange={(e) => setFailureReason(e.target.value)} placeholder="Select reason" options={FAILURE_REASONS} invalid={!failureReason && confirm} /></Field>
                <Field label="Notes" required htmlFor="fn" className="full"><Textarea id="fn" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Describe defects and required repairs" /></Field>
              </div>
            )}
            {effectiveResult === "pass" && <Field label="Notes" htmlFor="pn"><Textarea id="pn" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>}
            <div className="flex justify-end">
              <button type="button" className={`btn btn-lg ${effectiveResult === "fail" ? "btn-d" : "btn-ok"}`} disabled={busy || !effectiveResult || answered < CHECKLIST_KEYS.length} onClick={() => {
                if (effectiveResult === "fail" && (!failureReason || !notes.trim())) {
                  toast.error("Failure reason and notes are required.");
                  return;
                }
                setConfirm(true);
              }}>Submit Inspection</button>
            </div>
            {answered < CHECKLIST_KEYS.length && <p className="help m-0 text-right">Record all {CHECKLIST_KEYS.length} checklist items to submit.</p>}
          </Section>
        </>
      )}
      {history}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        busy={busy}
        title={effectiveResult === "pass" ? "Submit PASS result?" : "Submit FAIL result?"}
        tone={effectiveResult === "pass" ? "success" : "danger"}
        confirmLabel="Submit Inspection"
        message={effectiveResult === "pass" ? "A roadworthiness certificate number is generated and the application moves to insurance verification." : `The application is marked Inspection Failed (${failureReason}). The owner must repair the motorcycle before reinspection.`}
        onConfirm={async () => {
          if (!active) return;
          const ok = await act(() => inspectionService.submit(active.id, { centerId, inspectorId, inspectionDate: date, checklist, result: effectiveResult as "pass" | "fail", failureReason: failureReason || undefined, notes }), effectiveResult === "pass" ? "Inspection passed" : "Inspection failed — recorded");
          if (ok) setConfirm(false);
        }}
      />
      <Modal open={schedule} onClose={() => setSchedule(false)} title="Schedule inspection" size="sm" footer={
        <>
          <button type="button" className="btn btn-s" onClick={() => setSchedule(false)}>Cancel</button>
          <button type="button" className="btn btn-p" disabled={!centerId || busy} onClick={async () => { if (await act(() => inspectionService.schedule(app.id, { centerId, inspectionDate: date }), "Inspection scheduled")) setSchedule(false); }}>Schedule</button>
        </>
      }>
        <div className="flex flex-col gap-4">
          <Field label="Inspection Station" required htmlFor="sc"><Select id="sc" value={centerId} onChange={(e) => setCenterId(e.target.value)} options={(centers ?? []).filter((c) => c.status === "active").map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Date" required htmlFor="sd"><Input id="sd" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
