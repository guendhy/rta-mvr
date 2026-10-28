"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Check, CloudOff } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { LAST_CAPTURE_STEP, WIZARD_STEPS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, fullName, vehicleLabel } from "@/lib/formatting";
import { isEditable, maxReachableStep, stepForStatus } from "@/lib/workflow";
import { getTransactionType, TRANSACTION_TYPES, transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { Breadcrumbs, PageHeader } from "@/components/ui/layout-bits";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { Stepper } from "@/components/ui/stepper";
import { TransactionPlan, TransactionStep } from "@/components/registrations/wizard/transaction-step";
import { OwnerStep } from "@/components/registrations/wizard/owner-step";
import { ClassificationStep } from "@/components/registrations/wizard/classification-step";
import { VehicleStep } from "@/components/registrations/wizard/vehicle-step";
import { DocumentsStep } from "@/components/registrations/wizard/documents-step";
import { ReviewStep } from "@/components/registrations/wizard/review-step";
import type { SaveState, StepApi } from "@/components/registrations/wizard/types";
import { InspectionPanel } from "@/components/inspections/inspection-panel";
import { InsurancePanel } from "@/components/insurance/insurance-panel";
import { AssessmentPanel } from "@/components/registrations/assessment-panel";
import { PaymentCollector } from "@/components/payments/payment-collector";
import { ApprovalPanel } from "@/components/registrations/approval-panel";
import type { TransactionType } from "@/types";

const PAYMENT_STEP = 9;

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#474d59]" role="status"><span className="spin" aria-hidden="true" />Saving...</span>;
  if (state === "error") return <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#a3111a]" role="status"><AlertCircle size={16} aria-hidden="true" />Save failed — retry with Save Draft</span>;
  return <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0d6630]" role="status"><Check size={16} strokeWidth={2.6} aria-hidden="true" />Saved locally</span>;
}

/** Step 1: choose the transaction (or resume one of my drafts). */
function StartScreen() {
  const params = useSearchParams();
  const { user, can } = useDemoUser();
  const { data: drafts, loading } = useServiceQuery(() => registrationService.list({ status: "draft" }), []);
  const wanted = params.get("type") as TransactionType | null;
  const initial = wanted && TRANSACTION_TYPES.some((t) => t.key === wanted) ? wanted : params.get("start") === "existing" ? "replacement_certificate" : undefined;

  if (!can("registration.create") && !can("renewal.create") && !can("transfer.create")) return <EmptyState title="Not available" message="Your role cannot start motor vehicle transactions." />;
  if (loading && !drafts) return <PageSkeleton />;
  const mine = (drafts ?? []).filter((d) => d.createdBy === user?.id);
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Applications", href: "/registrations" }, { label: "New transaction" }]} />
      <PageHeader title="Start a motor vehicle transaction" badge={<StatusBadge kind="registration" status="draft" />} description="The steps, documents, inspection and fees that follow depend on the transaction you choose." />
      <Stepper current={1} maxReachable={1} completedThrough={0} />
      <TransactionStep key={initial ?? "default"} initialType={initial} drafts={mine} />
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
      if (target > step && step !== PAYMENT_STEP) setStep(target);
    }
    lastStatus.current = s;
  }, [detail, step]);

  const advance = useCallback(async () => {
    await reload(true);
    setStep((s) => Math.min((s ?? 1) + 1, WIZARD_STEPS.length));
  }, [reload]);

  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !detail) return <PageSkeleton />;
  if (!detail) return <EmptyState title="Application not found" message="This application does not exist or was removed." action={{ label: "All applications", href: "/registrations" }} />;
  const app = detail.application;
  const def = getTransactionType(app.type);
  const current = step ?? stepForStatus(app);
  const editable = isEditable(app) && (can("registration.edit") || can("transfer.create"));
  const max = maxReachableStep(app);
  const completedThrough = Math.max(1, stepForStatus(app) - (app.status === "registered" ? 0 : 1));
  const closed = ["cancelled", "rejected"].includes(app.status);
  const skipped = [...(!app.inspectionRequired && !app.insuranceRequired ? [6] : []), ...(app.assessment?.total === 0 ? [PAYMENT_STEP] : [])];
  void apiVersion;

  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onContinue = async () => {
    if (current > LAST_CAPTURE_STEP) {
      go(Math.min(current + 1, WIZARD_STEPS.length));
      return;
    }
    if (current === 1) {
      go(2);
      return;
    }
    const api = apiRef.current;
    setBusy(true);
    try {
      const ok = api ? await api.continue() : true;
      if (ok) {
        const fresh = await registrationService.getDetail(id);
        // Wait for the refreshed record so the next step renders with the saved data.
        await reload(true);
        if (current === LAST_CAPTURE_STEP && fresh) go(stepForStatus(fresh.application));
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

  const reviewReady = current === 8 && app.status === "payment_required";
  const stepDone = current > LAST_CAPTURE_STEP && (stepForStatus(app) > current || reviewReady);
  const continueLabel =
    current === 1 ? "Continue" :
    current <= LAST_CAPTURE_STEP ? apiRef.current?.continueLabel ?? "Continue" :
    current === WIZARD_STEPS.length ? "" :
    current === 8 ? "Continue to Payment" :
    `Continue to ${WIZARD_STEPS[current].label}`;
  const stepProps = { detail, editable, registerApi, onSaveState: setSaveState, advance };
  const noVehicleYet = app.type === "new" && !detail.vehicle;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Applications", href: "/registrations" }, { label: transactionLabel(app.type) }]} />
      <PageHeader
        title={def.label}
        badge={<StatusBadge kind="registration" status={app.status} />}
        description={<>Application <span className="mono font-semibold text-[#0b0b0f]">{app.transactionNumber}</span> · started {formatDateTime(app.createdAt)} by {app.createdByName}{detail.owner ? ` · ${fullName(detail.owner)}` : ""}{detail.vehicle ? ` · ${vehicleLabel(detail.vehicle)} (${vehicleTypeLabel(detail.vehicle.vehicleType)})` : ""}</>}
        actions={
          <>
            <SaveIndicator state={saveState} />
            <Link href={`/registrations/${app.id}`} className="btn btn-s btn-sm">Record view</Link>
          </>
        }
      />
      {app.scenario && <Alert tone="info" title={app.scenario}>Seeded UAT scenario record.</Alert>}
      {closed && <Alert tone="bad" title={`This application is ${app.status}`}>{app.rejectReason ?? "No further changes can be made."}</Alert>}
      {app.status === "returned" && app.returnReason && current !== 5 && <Alert tone="warn" title="Returned for correction">{app.returnReason}</Alert>}
      <div className="sticky top-[68px] z-20 -mx-1 bg-[#f4f5f8]/95 px-1 py-1 backdrop-blur md:static md:bg-transparent md:p-0">
        <Stepper current={current} maxReachable={max} completedThrough={completedThrough} onSelect={go} skipped={skipped} />
      </div>

      <div key={current}>
        {current === 1 && <div className="split"><div className="l"><TransactionPlan type={app.type} /></div><div className="r"><Alert tone="info" title="Transaction selected">Started as <strong>{def.label}</strong>. To start a different transaction, cancel this draft and begin again.</Alert></div></div>}
        {current === 2 && <OwnerStep {...stepProps} />}
        {current === 3 && (detail.owner ? <ClassificationStep {...stepProps} /> : <Alert tone="warn" title="Owner required">Complete Step 2 (Registered Owner) first.</Alert>)}
        {current === 4 && (detail.owner ? <VehicleStep {...stepProps} /> : <Alert tone="warn" title="Owner required">Complete Step 2 (Registered Owner) first.</Alert>)}
        {current === 5 && (noVehicleYet ? <Alert tone="warn" title="Application incomplete">Capture the vehicle details (Step 4) before documents.</Alert> : <DocumentsStep {...stepProps} />)}
        {current === 6 && (
          <div className="flex flex-col gap-6">
            <InspectionPanel detail={detail} />
            {(!app.insuranceRequired || ["for_insurance_verification", "for_assessment", "payment_required", "paid", "for_approval", "approved", "registered", "returned"].includes(app.status)) && <InsurancePanel detail={detail} />}
          </div>
        )}
        {current === 7 && <AssessmentPanel detail={detail} onProceed={() => go(8)} />}
        {current === 8 && <ReviewStep detail={detail} onProceed={() => go(PAYMENT_STEP)} />}
        {current === PAYMENT_STEP && (app.assessment?.total === 0 ? <Alert tone="ok" title="No amount due">This transaction has a zero assessment and goes straight to approval.</Alert> : <PaymentCollector detail={detail} onPaid={() => reload(true)} />)}
        {current === 10 && <ApprovalPanel detail={detail} />}
      </div>

      <div className="foot no-print !flex-nowrap">
        <div className="row !flex-nowrap gap-2">
          {current > 1 ? <button type="button" className="btn btn-s" onClick={() => go(current - 1)}>Back</button> : <Link href="/registrations" className="btn btn-s">Back to list</Link>}
          {editable && app.status === "draft" && <button type="button" className="btn btn-g hidden !text-[#a3111a] sm:inline-flex" onClick={() => setCancelOpen(true)}>Cancel</button>}
        </div>
        <div className="row !flex-nowrap gap-2">
          {editable && current >= 2 && current <= 4 && <button type="button" className="btn btn-s" onClick={onSaveDraft}>{saveState === "error" ? <CloudOff size={16} aria-hidden="true" /> : null}<span className="sm:hidden">Save</span><span className="hidden sm:inline">Save Draft</span></button>}
          {continueLabel && !closed && (
            <button type="button" className="btn btn-p btn-lg !px-4 sm:!px-6" disabled={busy || (current > LAST_CAPTURE_STEP && !stepDone) || (current >= 3 && current <= 4 && !detail.owner)} onClick={onContinue}>
              {busy && <span className="spin" aria-hidden="true" />}<span className="sm:hidden">Continue</span><span className="hidden sm:inline">{continueLabel}</span> →
            </button>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancel this application?"
        tone="danger"
        confirmLabel="Cancel Application"
        requireReason
        message={<>Application <span className="mono">{app.transactionNumber}</span> will be cancelled. The transaction number is never reused.</>}
        onConfirm={async (reason) => {
          try {
            await registrationService.cancel(app.id, reason);
            toast.success("Application cancelled");
            router.push("/registrations");
          } catch (e) {
            toast.error(friendlyError(e));
          }
        }}
      />
    </div>
  );
}

function NewTransaction() {
  const params = useSearchParams();
  const id = params.get("id");
  return id ? <Wizard key={id} id={id} /> : <StartScreen />;
}

export default function NewRegistrationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewTransaction />
    </Suspense>
  );
}
