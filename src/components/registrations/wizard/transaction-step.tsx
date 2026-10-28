"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { registrationService } from "@/services/registration.service";
import type { VehicleRecord } from "@/services/interfaces";
import { useDemoUser } from "@/hooks/use-demo-user";
import { friendlyError } from "@/lib/errors";
import { fullName, vehicleLabel } from "@/lib/formatting";
import { getTransactionType, TRANSACTION_TYPES, type TransactionTypeDef } from "@/config/transaction-types";
import { Alert } from "@/components/ui/feedback";
import { VehicleLookup } from "@/components/vehicles/vehicle-lookup";
import type { Permission, RegistrationApplication, TransactionType } from "@/types";

function permitted(def: TransactionTypeDef, can: (p: Permission) => boolean) {
  if (def.key === "renewal") return can("renewal.create");
  if (def.key === "transfer") return can("transfer.create");
  return can("registration.create");
}

/** Plan panel: the steps that follow for the chosen transaction. */
export function TransactionPlan({ type, footer }: { type: TransactionType; footer?: React.ReactNode }) {
  const def = getTransactionType(type);
  return (
    <section className="card sec gap-3.5">
      <p className="eb">Steps for this transaction</p>
      <p className="h2">{def.label}</p>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {def.steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2.5 text-[14px]"><span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[#eeeefe] text-[12px] font-extrabold text-[#1010a8]" aria-hidden="true">{i + 1}</span>{s}</li>
        ))}
      </ol>
      <div className="rounded-lg bg-[#f4f5f8] px-3.5 py-3 text-[12.5px] leading-normal text-[#3a3f4a]">Documents, inspection and fees are resolved from the rules in Vehicle Configuration and Requirements once the vehicle classification is known.</div>
      {footer}
    </section>
  );
}

/**
 * Step 1 — Transaction Type. New registrations create an application straight away; every
 * other transaction starts from an existing registry record found by lookup.
 */
export function TransactionStep({ initialType, drafts }: { initialType?: TransactionType; drafts: RegistrationApplication[] }) {
  const router = useRouter();
  const { user, office, can } = useDemoUser();
  const [type, setType] = useState<TransactionType>(initialType ?? "new");
  const [record, setRecord] = useState<VehicleRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const def = getTransactionType(type);
  const allowed = permitted(def, can);

  const start = async () => {
    if (def.route && !def.capturesNewVehicle && type !== "new") {
      router.push(record ? `${def.route}?vehicle=${record.vehicle.id}` : def.route);
      return;
    }
    setBusy(true);
    try {
      const app = type === "new"
        ? await registrationService.create({ type: "new", officeId: office?.id ?? user?.officeId ?? "" })
        : await registrationService.createForVehicle(type, record!.vehicle.id);
      router.replace(`/registrations/new?id=${app.id}`);
    } catch (e) {
      toast.error(friendlyError(e));
      setBusy(false);
    }
  };

  const needsVehicle = def.needsExistingVehicle && !def.route;
  return (
    <div className="split">
      <div className="l">
        <section className="card sec">
          <h2 className="h2">What does the applicant need?</h2>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]" role="radiogroup" aria-label="Transaction type">
            {TRANSACTION_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={type === t.key}
                className={`opt min-h-[86px] flex-col !items-start gap-1 text-left ${type === t.key ? "opt-on" : ""}`}
                onClick={() => { setType(t.key); setRecord(null); }}
              >
                <span className="text-[14.5px] font-bold">{t.label}</span>
                <span className="text-[12px] leading-snug font-medium text-[#5a606c]">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
        {needsVehicle && (
          <VehicleLookup onSelect={setRecord} selectedId={record?.vehicle.id} actionLabel="Select vehicle" />
        )}
        {needsVehicle && record && (
          <Alert tone={record.openApplication ? "warn" : "ok"} title={`${vehicleLabel(record.vehicle)} · ${record.vehicle.registrationNumber ?? "Unregistered"}`}>
            Registered owner {fullName(record.owner)}.{record.openApplication && <> An application is already open: <Link href={`/registrations/${record.openApplication.id}`} className="mono">{record.openApplication.transactionNumber}</Link>.</>}
          </Alert>
        )}
        {drafts.length > 0 && (
          <section className="card sec">
            <h2 className="h3">Resume a draft</h2>
            <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
              {drafts.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="mono m-0 text-[13.5px] font-semibold">{d.transactionNumber}</p>
                    <p className="mut m-0 text-[12.5px]">{getTransactionType(d.type).label} · {d.draft.owner?.organizationName ?? (d.draft.owner?.firstName ? `${d.draft.owner.firstName} ${d.draft.owner.lastName ?? ""}` : "Owner not entered")} · step {d.currentStep} of 10</p>
                  </div>
                  <Link href={`/registrations/new?id=${d.id}`} className="btn btn-p btn-sm">Resume</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className="r">
        <TransactionPlan
          type={type}
          footer={
            <>
              {!allowed && <Alert tone="warn" title="Not available for your role">Switch to a role that can process this transaction.</Alert>}
              <button type="button" className="btn btn-p btn-lg w-full" disabled={!allowed || busy || (needsVehicle && !record) || !!record?.openApplication} onClick={start}>
                {busy && <span className="spin" aria-hidden="true" />}
                {def.route && type !== "new" ? `Open ${def.shortLabel}` : `Start ${def.shortLabel}`} →
              </button>
              {needsVehicle && !record && <p className="help m-0">Find the existing vehicle record first.</p>}
            </>
          }
        />
      </div>
    </div>
  );
}
