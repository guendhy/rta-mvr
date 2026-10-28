"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, ShieldCheck, ShieldOff } from "lucide-react";
import { insuranceService } from "@/services/insurance.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { settingsService } from "@/services/settings.service";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { vehicleUsageLabel } from "@/config/vehicle-usage";
import { INSURANCE_PROVIDERS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { insuranceSchema, type InsuranceFormValues } from "@/lib/validation/schemas";
import { Field, Input, Select } from "@/components/ui/form";
import { FileDrop } from "@/components/ui/file-upload";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { DescriptionList, Section } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RegistrationDetail } from "@/services/interfaces";
import type { FileMeta, InsuranceRecord } from "@/types";

function InsuranceSummary({ rec, vehicleIds }: { rec: InsuranceRecord; vehicleIds?: string[] }) {
  const v = rec.vinOrChassis.replace(/\W/g, "").toUpperCase();
  const matches = vehicleIds?.length ? vehicleIds.some((id) => id && id.replace(/\W/g, "").toUpperCase() === v) : undefined;
  return (
    <DescriptionList items={[
      ["Insurance provider", rec.provider],
      ["Policy number", <span key="p" className="mono">{rec.policyNumber}</span>],
      ["Policy holder", rec.policyHolder],
      ["Coverage", `${formatDate(rec.coverageStart)} – ${formatDate(rec.coverageExpiry)}`],
      ["Premium", formatMoney(rec.premium)],
      ["VIN / chassis on policy", <span key="v" className="flex flex-wrap items-center gap-2"><span className="mono">{rec.vinOrChassis}</span>{matches !== undefined && <span className={`badge ${matches ? "s-ok" : "s-bad"}`}>{matches ? "Matches vehicle" : "Does not match vehicle"}</span>}</span>],
      ["Certificate", rec.certificate?.name ?? "Not attached"],
      ["Verified", rec.verifiedAt ? `${rec.verifiedBy} · ${formatDateTime(rec.verifiedAt)}` : "—"],
      ["Remarks", rec.remarks],
    ]} />
  );
}

/** Third-party insurance capture + simulated provider verification for any motor vehicle. */
export function InsurancePanel({ detail }: { detail: RegistrationDetail }) {
  const { can } = useDemoUser();
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const app = detail.application;
  const rec = detail.insurance;
  const vehicle = detail.vehicle;
  const vehicleIds = vehicle ? [vehicle.vin, vehicle.chassisNumber] : undefined;
  const notRequired = !app.insuranceRequired || settings?.registration.requireInsuranceVerification === false;
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
      vinOrChassis: vehicle?.vin || vehicle?.chassisNumber || "",
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

  const vehicleLine = vehicle && (
    <p className="mut m-0 text-[13.5px]">{vehicleLabel(vehicle)} · {vehicleTypeLabel(vehicle.vehicleType)} · {vehicleUsageLabel(vehicle.vehicleUsage)} · VIN <span className="mono">{vehicle.vin || "—"}</span>{vehicle.chassisNumber && vehicle.chassisNumber !== vehicle.vin ? <> · chassis <span className="mono">{vehicle.chassisNumber}</span></> : null}</p>
  );

  if (!vehicle) {
    return <EmptyState title="Insurance record missing" message="This transaction has no vehicle record yet, so a policy cannot be matched to a VIN or chassis number." icon={<ShieldOff size={36} />} />;
  }

  if (!atStage) {
    if (rec?.status === "verified") {
      return <Section title="Third-party insurance" description={vehicleLine} actions={<StatusBadge kind="insurance" status={rec.status} />}><InsuranceSummary rec={rec} vehicleIds={vehicleIds} /></Section>;
    }
    if (notRequired) {
      return <Alert tone="ok" title="Insurance verification not required for this transaction">No third-party policy needs to be verified for this {vehicleTypeLabel(vehicle.vehicleType).toLowerCase()} transaction. The transaction continues without an insurance check.</Alert>;
    }
    const notReached = ["draft", "pending", "returned", "for_inspection", "inspection_failed"].includes(app.status);
    return notReached
      ? <Alert tone="info" title="Insurance verification not yet reached">{app.inspectionRequired ? "The vehicle inspection must be completed first." : "The transaction must be submitted first."}</Alert>
      : <EmptyState title="Insurance record missing" message="This transaction has passed insurance verification but no verified policy is on file." icon={<ShieldOff size={36} />} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {notRequired && <Alert tone="info" title="Insurance verification optional">Rules do not require insurance verification for this transaction, but it is waiting at the insurance stage.</Alert>}
      {error && <Alert tone="bad" title="Verification problem">{error}</Alert>}
      {rec && rec.status !== "pending" && (
        <Alert tone="warn" title={`Current policy is ${rec.status}`}>{rec.remarks ?? "Capture a valid third-party policy to continue."} Policy {rec.policyNumber} · coverage {formatDate(rec.coverageStart)} – {formatDate(rec.coverageExpiry)}.</Alert>
      )}
      {rec && !editing && (
        <Section title="Policy awaiting verification" description={vehicleLine} actions={<StatusBadge kind="insurance" status={rec.status} />}>
          <InsuranceSummary rec={rec} vehicleIds={vehicleIds} />
          {canVerify ? (
            <div className="row">
              <button type="button" className="btn btn-ok btn-lg" disabled={busy || rec.status !== "pending"} onClick={() => act(() => insuranceService.verify(rec.id), "Insurance verified with provider")}>
                {busy ? <span className="spin" aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}{busy ? "Contacting provider…" : "Verify with Insurance Provider"}
              </button>
              <button type="button" className="btn btn-do" disabled={busy} onClick={() => setFlag("invalid")}>Mark Invalid</button>
              <button type="button" className="btn btn-do" disabled={busy} onClick={() => setFlag("expired")}>Mark Expired</button>
              <button type="button" className="btn btn-d" disabled={busy} onClick={() => setFlag("rejected")}>Reject</button>
              <button type="button" className="btn btn-g" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" />Edit / new policy</button>
            </div>
          ) : <Alert tone="info" title="Waiting for verification">An officer with insurance verification permission must verify this policy.</Alert>}
          <p className="help m-0" aria-live="polite">{busy ? "Contacting the insurance provider…" : "Verification is simulated: the prototype checks coverage dates and that the VIN / chassis number on the policy matches the vehicle."}</p>
        </Section>
      )}
      {(editing || !rec) && canVerify && (
        <form className="card sec" noValidate onSubmit={form.handleSubmit(async (v) => {
          if (await act(() => insuranceService.capture(app.id, { ...v, certificate: cert }), "Policy captured — ready to verify")) setEditing(false);
        })}>
          <div className="sechd"><div className="min-w-0"><h2 className="h2">Third-party insurance policy</h2>{vehicleLine}</div>{rec && <button type="button" className="btn btn-g btn-sm" onClick={() => setEditing(false)}>Cancel</button>}</div>
          <div className="form">
            <Field label="Insurance Provider" required htmlFor="ip" error={errors.provider?.message}><Select id="ip" placeholder="Select provider" options={INSURANCE_PROVIDERS} invalid={!!errors.provider} {...register("provider")} /></Field>
            <Field label="Policy Number" required htmlFor="pn" error={errors.policyNumber?.message}><Input id="pn" mono invalid={!!errors.policyNumber} {...register("policyNumber")} /></Field>
            <Field label="Policy Holder" required htmlFor="ph" error={errors.policyHolder?.message}><Input id="ph" invalid={!!errors.policyHolder} {...register("policyHolder")} /></Field>
            <Field label="Coverage Start" required htmlFor="cs" error={errors.coverageStart?.message}><Input id="cs" type="date" invalid={!!errors.coverageStart} {...register("coverageStart")} /></Field>
            <Field label="Coverage Expiry" required htmlFor="cx" error={errors.coverageExpiry?.message}><Input id="cx" type="date" invalid={!!errors.coverageExpiry} {...register("coverageExpiry")} /></Field>
            <Field label="Premium (PGK)" required htmlFor="pr" error={errors.premium?.message}><Input id="pr" type="number" step="0.01" inputMode="decimal" invalid={!!errors.premium} {...register("premium")} /></Field>
            <Field label="VIN / Chassis Number on Policy" required htmlFor="vc" error={errors.vinOrChassis?.message} help={`Vehicle VIN: ${vehicle.vin || "—"}${vehicle.chassisNumber && vehicle.chassisNumber !== vehicle.vin ? ` · chassis: ${vehicle.chassisNumber}` : ""}`}><Input id="vc" mono invalid={!!errors.vinOrChassis} {...register("vinOrChassis")} /></Field>
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
