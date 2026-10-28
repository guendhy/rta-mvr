"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, CloudOff, FilePlus2 } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { WIZARD_STEPS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, fullName, motorcycleLabel } from "@/lib/formatting";
import { isEditable, maxReachableStep, stepForStatus } from "@/lib/workflow";
import { Breadcrumbs, PageHeader } from "@/components/ui/layout-bits";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { Stepper } from "@/components/ui/stepper";
import { OwnerStep } from "@/components/registrations/wizard/owner-step";
import { MotorcycleStep } from "@/components/registrations/wizard/motorcycle-step";
import { DocumentsStep } from "@/components/registrations/wizard/documents-step";
import type { SaveState, StepApi } from "@/components/registrations/wizard/types";
import { InspectionPanel } from "@/components/inspections/inspection-panel";
import { InsurancePanel } from "@/components/insurance/insurance-panel";
import { AssessmentPanel } from "@/components/registrations/assessment-panel";
import { PaymentCollector } from "@/components/payments/payment-collector";
import { ApprovalPanel } from "@/components/registrations/approval-panel";

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#474d59]" role="status"><span className="spin" aria-hidden="true" />Saving...</span>;
  if (state === "error") return <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#a3111a]" role="status"><AlertCircle size={16} aria-hidden="true" />Save failed — retry with Save Draft</span>;
  return <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0d6630]" role="status"><Check size={16} strokeWidth={2.6} aria-hidden="true" />Saved locally</span>;
}

/** Start screen: resume one of my drafts or start a new application. */
function StartScreen() {
  const router = useRouter();
  const { user, office, can } = useDemoUser();
  const { data: drafts, loading } = useServiceQuery(() => registrationService.list({ status: "draft", type: "new" }), []);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const start = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    try {
      const app = await registrationService.create({ type: "new", officeId: office?.id ?? user?.officeId ?? "" });
      router.replace(`/registrations/new?id=${app.id}`);
    } catch (e) {
      toast.error(friendlyError(e));
      started.current = false;
      setBusy(false);
    }
  }, [office, user, router]);

  const mine = (drafts ?? []).filter((d) => d.createdBy === user?.id);
  useEffect(() => {
    if (!loading && drafts && mine.length === 0 && can("registration.create")) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, drafts]);

  if (!can("registration.create")) return <EmptyState title="Not available" message="Your role cannot start new registrations." />;
  if (loading || mine.length === 0) return <PageSkeleton />;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New Motorcycle Registration" description="You have saved drafts. Resume one or start a new application." />
      <div className="g2">
        <section className="card sec">
          <h2 className="h3">Resume a draft</h2>
          <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
            {mine.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="mono m-0 text-[13.5px] font-semibold">{d.transactionNumber}</p>
                  <p className="mut m-0 text-[12.5px]">{d.draft.owner?.firstName ? `${d.draft.owner.firstName} ${d.draft.owner.lastName ?? ""}` : "Owner not entered"} · step {d.currentStep} of 8 · saved {formatDateTime(d.updatedAt)}</p>
                </div>
                <Link href={`/registrations/new?id=${d.id}`} className="btn btn-p btn-sm">Resume</Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="card sec items-start">
          <h2 className="h3">Start a new application</h2>
          <p className="mut m-0 text-[13.5px]">A new transaction number is issued. Drafts are saved locally as you type.</p>
          <button type="button" className="btn btn-p btn-lg" disabled={busy} onClick={start}>{busy ? <span className="spin" aria-hidden="true" /> : <FilePlus2 size={18} aria-hidden="true" />}Start New Registration</button>
        </section>
      </div>
    </div>
  );
}

function Wizard({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const { data: detail, loading, error, reload } = useServiceQuery(() => registrationService.getDetail(id), [id]);
  const [step, setStep] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const apiRef = useRef<StepApi | null>(null);
  const [apiVersion, setApiVersion] = useState(0);
  const lastStatus = useRef<string | null>(null);

  const registerApi = useCallback((api: StepApi | null) => {
    apiRef.current = api;
    setApiVersion((v) => v + 1);
  }, []);

  // Initial step: ?step= or wherever the application currently sits.
  useEffect(() => {
    if (!detail || step !== null) return;
    const wanted = Number(params.get("step"));
    const max = maxReachableStep(detail.application);
    setStep(wanted >= 1 && wanted <= max ? wanted : stepForStatus(detail.application));
    lastStatus.current = detail.application.status;
  }, [detail, step, params]);

  // Auto-advance when an action moves the application to a later stage.
  useEffect(() => {
    if (!detail || step === null) return;
    const s = detail.application.status;
    if (lastStatus.current && lastStatus.current !== s) {
      const target = stepForStatus(detail.application);
      // Stay on Payment after a successful charge so the receipt can be printed first.
      if (target > step && step !== 7) setStep(target);
    }
    lastStatus.current = s;
  }, [detail, step]);

  const advance = useCallback(() => {
    reload(true);
    setStep((s) => Math.min((s ?? 1) + 1, 8));
  }, [reload]);

  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !detail) return <PageSkeleton />;
  if (!detail) return <EmptyState title="Application not found" message="This registration application does not exist or was removed." action={{ label: "All applications", href: "/registrations" }} />;
  const app = detail.application;
  const current = step ?? stepForStatus(app);
  const editable = isEditable(app) && can("registration.edit");
  const max = maxReachableStep(app);
  const completedThrough = Math.max(0, stepForStatus(app) - (app.status === "registered" ? 0 : 1));
  const closed = ["cancelled", "rejected"].includes(app.status);
  void apiVersion;

  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onContinue = async () => {
    if (current >= 4) {
      go(Math.min(current + 1, 8));
      return;
    }
    const api = apiRef.current;
    setBusy(true);
    try {
      const ok = api ? await api.continue() : true;
      if (ok) {
        const fresh = await registrationService.getDetail(id);
        reload(true);
        if (current === 3 && fresh) go(stepForStatus(fresh.application));
        else go(current + 1);
      }
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const onSaveDraft = async () => {
    setSaveState("saving");
    try {
      await apiRef.current?.saveDraft?.();
      await registrationService.saveDraft(id, {}, current);
      setSaveState("saved");
      toast.success("Draft saved locally");
    } catch (e) {
      setSaveState("error");
      toast.error(friendlyError(e));
    }
  };

  const stepDone = current >= 4 && stepForStatus(app) > current;
  const continueLabel = current <= 3 ? apiRef.current?.continueLabel ?? "Continue" : current === 8 ? "" : `Continue to ${WIZARD_STEPS[current].label}`;
  const stepProps = { detail, editable, registerApi, onSaveState: setSaveState, advance };

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Registrations", href: "/registrations" }, { label: app.type === "renewal" ? "Renewal" : "New Registration" }]} />
      <PageHeader
        title={app.type === "renewal" ? "Registration Renewal" : "New Motorcycle Registration"}
        badge={<StatusBadge kind="registration" status={app.status} />}
        description={<>Application <span className="mono font-semibold text-[#0b0b0f]">{app.transactionNumber}</span> · started {formatDateTime(app.createdAt)} by {app.createdByName}{detail.owner ? ` · ${fullName(detail.owner)}` : ""}{detail.motorcycle ? ` · ${motorcycleLabel(detail.motorcycle)}` : ""}</>}
        actions={
          <>
            <SaveIndicator state={saveState} />
            <Link href={`/registrations/${app.id}`} className="btn btn-s btn-sm">Record view</Link>
          </>
        }
      />
      {app.scenario && <Alert tone="info" title={app.scenario}>Seeded UAT scenario record.</Alert>}
      {closed && <Alert tone="bad" title={`This application is ${app.status}`}>{app.rejectReason ?? "No further changes can be made."}</Alert>}
      <Stepper current={current} maxReachable={max} completedThrough={completedThrough} onSelect={go} />

      <div key={current}>
        {current === 1 && <OwnerStep {...stepProps} />}
        {current === 2 && (detail.owner ? <MotorcycleStep {...stepProps} /> : <Alert tone="warn" title="Owner required">Complete step 1 (Owner) first.</Alert>)}
        {current === 3 && <DocumentsStep {...stepProps} />}
        {current === 4 && <InspectionPanel detail={detail} />}
        {current === 5 && <InsurancePanel detail={detail} />}
        {current === 6 && <AssessmentPanel detail={detail} onProceed={() => go(7)} />}
        {current === 7 && <PaymentCollector detail={detail} onPaid={() => reload(true)} />}
        {current === 8 && <ApprovalPanel detail={detail} />}
      </div>

      <div className="foot no-print !flex-nowrap">
        <div className="row !flex-nowrap gap-2">
          {current > 1 ? <button type="button" className="btn btn-s" onClick={() => go(current - 1)}>Back</button> : <Link href="/registrations" className="btn btn-s">Back to list</Link>}
          {editable && app.status === "draft" && <button type="button" className="btn btn-g hidden !text-[#a3111a] sm:inline-flex" onClick={() => setCancelOpen(true)}>Cancel</button>}
        </div>
        <div className="row !flex-nowrap gap-2">
          {editable && current <= 2 && <button type="button" className="btn btn-s" onClick={onSaveDraft}>{saveState === "error" ? <CloudOff size={16} aria-hidden="true" /> : null}<span className="sm:hidden">Save</span><span className="hidden sm:inline">Save Draft</span></button>}
          {continueLabel && !closed && (
            <button type="button" className="btn btn-p btn-lg !px-4 sm:!px-6" disabled={busy || (current >= 4 && !stepDone) || (current === 2 && !detail.owner)} onClick={onContinue}>
              {busy && <span className="spin" aria-hidden="true" />}<span className="sm:hidden">Continue</span><span className="hidden sm:inline">{continueLabel}</span> →
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this registration?"
        tone="danger"
        confirmLabel="Cancel Registration"
        requireReason
        message={<>Application <span className="mono">{app.transactionNumber}</span> will be cancelled. The transaction number is never reused.</>}
        onConfirm={async (reason) => {
          try {
            await registrationService.cancel(app.id, reason);
            toast.success("Registration cancelled");
            router.push("/registrations");
          } catch (e) {
            toast.error(friendlyError(e));
          }
        }}
      />
    </div>
  );
}

function NewRegistration() {
  const params = useSearchParams();
  const id = params.get("id");
  return id ? <Wizard key={id} id={id} /> : <StartScreen />;
}

export default function NewRegistrationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewRegistration />
    </Suspense>
  );
}
