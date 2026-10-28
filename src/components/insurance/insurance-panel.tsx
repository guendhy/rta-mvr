"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, ShieldCheck } from "lucide-react";
import { insuranceService } from "@/services/insurance.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { INSURANCE_PROVIDERS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney, fullName } from "@/lib/formatting";
import { insuranceSchema, type InsuranceFormValues } from "@/lib/validation/schemas";
import { Field, Input, Select } from "@/components/ui/form";
import { FileDrop } from "@/components/ui/file-upload";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { DescriptionList, Section } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RegistrationDetail } from "@/services/interfaces";
import type { FileMeta, InsuranceRecord } from "@/types";

function InsuranceSummary({ rec }: { rec: InsuranceRecord }) {
  return (
    <DescriptionList items={[
      ["Insurance provider", rec.provider],
      ["Policy number", <span key="p" className="mono">{rec.policyNumber}</span>],
      ["Policy holder", rec.policyHolder],
      ["Coverage", `${formatDate(rec.coverageStart)} – ${formatDate(rec.coverageExpiry)}`],
      ["Premium", formatMoney(rec.premium)],
      ["VIN / Chassis on policy", <span key="v" className="mono">{rec.vinOrChassis}</span>],
      ["Certificate", rec.certificate?.name ?? "Not attached"],
      ["Verified", rec.verifiedAt ? `${rec.verifiedBy} · ${formatDateTime(rec.verifiedAt)}` : "—"],
      ["Remarks", rec.remarks],
    ]} />
  );
}

/** Third-party insurance capture + simulated provider verification (spec §23). */
export function InsurancePanel({ detail }: { detail: RegistrationDetail }) {
  const { can } = useDemoUser();
  const app = detail.application;
  const rec = detail.insurance;
  const canVerify = can("insurance.verify");
  const atStage = app.status === "for_insurance_verification";
  const [editing, setEditing] = useState(atStage && (!rec || rec.status !== "pending"));
  const [cert, setCert] = useState<FileMeta | undefined>(rec?.certificate);
  const [busy, setBusy] = useState(false);
  const [flag, setFlag] = useState<null | "invalid" | "expired" | "rejected">(null);
  const [error, setError] = useState<string | null>(null);
  const isFresh = !rec || rec.status !== "pending";

  const form = useForm<InsuranceFormValues>({
    resolver: zodResolver(insuranceSchema),
    defaultValues: {
      provider: rec?.provider ?? "",
      policyNumber: isFresh ? "" : rec?.policyNumber ?? "",
      policyHolder: rec?.policyHolder ?? fullName(detail.owner),
      coverageStart: isFresh ? new Date().toISOString().slice(0, 10) : rec?.coverageStart ?? "",
      coverageExpiry: isFresh ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10) : rec?.coverageExpiry ?? "",
      premium: rec?.premium ?? 110,
      vinOrChassis: detail.motorcycle?.vin ?? "",
    },
    mode: "onTouched",
  });
  const { register, formState: { errors } } = form;

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

  if (!atStage) {
    return rec?.status === "verified"
      ? <Section title="Third-party insurance" actions={<StatusBadge kind="insurance" status={rec.status} />}><InsuranceSummary rec={rec} /></Section>
      : <Alert tone="info" title="Insurance verification not yet reached">The motorcycle must pass the roadworthiness inspection first.</Alert>;
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <Alert tone="bad" title="Verification problem">{error}</Alert>}
      {rec && rec.status !== "pending" && (
        <Alert tone="warn" title={`Current policy is ${rec.status}`}>{rec.remarks ?? "Capture a valid third-party policy to continue."} Policy {rec.policyNumber} · coverage {formatDate(rec.coverageStart)} – {formatDate(rec.coverageExpiry)}.</Alert>
      )}
      {rec && !editing && (
        <Section title="Policy awaiting verification" actions={<StatusBadge kind="insurance" status={rec.status} />}>
          <InsuranceSummary rec={rec} />
          {canVerify ? (
            <div className="row">
              <button type="button" className="btn btn-ok btn-lg" disabled={busy || rec.status !== "pending"} onClick={() => act(() => insuranceService.verify(rec.id), "Insurance verified with provider")}>
                {busy ? <span className="spin" aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}{busy ? "Checking with provider…" : "Verify"}
              </button>
              <button type="button" className="btn btn-do" disabled={busy} onClick={() => setFlag("invalid")}>Mark Invalid</button>
              <button type="button" className="btn btn-do" disabled={busy} onClick={() => setFlag("expired")}>Mark Expired</button>
              <button type="button" className="btn btn-d" disabled={busy} onClick={() => setFlag("rejected")}>Reject</button>
              <button type="button" className="btn btn-g" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />Edit / new policy</button>
            </div>
          ) : <Alert tone="info" title="Waiting for verification">An officer with insurance verification permission must verify this policy.</Alert>}
          <p className="help m-0">Verification is simulated: the prototype checks coverage dates and that the VIN / chassis on the policy matches the motorcycle.</p>
        </Section>
      )}
      {(editing || !rec) && canVerify && (
        <form className="card sec" noValidate onSubmit={form.handleSubmit(async (v) => {
          if (await act(() => insuranceService.capture(app.id, { ...v, certificate: cert }), "Policy captured — ready to verify")) setEditing(false);
        })}>
          <div className="sechd"><h2 className="h2">Third-party insurance policy</h2>{rec && <button type="button" className="btn btn-g btn-sm" onClick={() => setEditing(false)}>Cancel</button>}</div>
          <div className="form">
            <Field label="Insurance Provider" required htmlFor="ip" error={errors.provider?.message}><Select id="ip" placeholder="Select provider" options={INSURANCE_PROVIDERS} invalid={!!errors.provider} {...register("provider")} /></Field>
            <Field label="Policy Number" required htmlFor="pn" error={errors.policyNumber?.message}><Input id="pn" mono invalid={!!errors.policyNumber} {...register("policyNumber")} /></Field>
            <Field label="Policy Holder" required htmlFor="ph" error={errors.policyHolder?.message}><Input id="ph" invalid={!!errors.policyHolder} {...register("policyHolder")} /></Field>
            <Field label="Coverage Start" required htmlFor="cs" error={errors.coverageStart?.message}><Input id="cs" type="date" invalid={!!errors.coverageStart} {...register("coverageStart")} /></Field>
            <Field label="Coverage Expiry" required htmlFor="cx" error={errors.coverageExpiry?.message}><Input id="cx" type="date" invalid={!!errors.coverageExpiry} {...register("coverageExpiry")} /></Field>
            <Field label="Premium (PGK)" required htmlFor="pr" error={errors.premium?.message}><Input id="pr" type="number" step="0.01" inputMode="decimal" invalid={!!errors.premium} {...register("premium")} /></Field>
            <Field label="Motorcycle VIN / Chassis" required htmlFor="vc" error={errors.vinOrChassis?.message} help={`Motorcycle VIN: ${detail.motorcycle?.vin ?? "—"}`}><Input id="vc" mono invalid={!!errors.vinOrChassis} {...register("vinOrChassis")} /></Field>
            <div className="full">
              <p className="lbl">Certificate</p>
              {cert && <p className="help mb-2">Attached: {cert.name}</p>}
              <FileDrop compact label={cert ? "Replace certificate — drop file or browse" : "Attach certificate — drop file or browse"} onFile={(_f, meta) => setCert(meta)} />
            </div>
          </div>
          <div className="flex justify-end"><button type="submit" className="btn btn-p btn-lg" disabled={busy}>{busy && <span className="spin" aria-hidden="true" />}Save Policy</button></div>
        </form>
      )}
      {!rec && !canVerify && <Alert tone="info" title="Awaiting insurance details">An authorised officer will capture and verify the third-party insurance.</Alert>}

      <ConfirmDialog
        open={!!flag}
        onClose={() => setFlag(null)}
        busy={busy}
        tone="danger"
        requireReason
        title={flag === "invalid" ? "Mark insurance invalid" : flag === "expired" ? "Mark insurance expired" : "Reject insurance"}
        confirmLabel={flag === "invalid" ? "Mark Invalid" : flag === "expired" ? "Mark Expired" : "Reject"}
        message="The application stays at insurance verification until a valid policy is verified."
        onConfirm={async (reason) => {
          if (!rec || !flag) return;
          const fn = flag === "invalid" ? insuranceService.markInvalid : flag === "expired" ? insuranceService.markExpired : insuranceService.reject;
          if (await act(() => fn.call(insuranceService, rec.id, reason), `Insurance marked ${flag}`)) {
            setFlag(null);
            setEditing(true);
          }
        }}
      />
    </div>
  );
}
