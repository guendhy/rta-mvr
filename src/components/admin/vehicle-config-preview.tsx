"use client";

import { useMemo, useState } from "react";
import { REGISTRATION_PERIODS } from "@/config/fee-rules";
import { documentLabel } from "@/config/document-requirements";
import { inspectionChecklistFor, inspectionProfileFor } from "@/config/inspection-checklists";
import { OWNERSHIP_TYPES } from "@/config/ownership-types";
import { TRANSACTION_TYPES, getTransactionType } from "@/config/transaction-types";
import { SPEC_FIELDS, vehicleFieldsFor } from "@/config/vehicle-fields";
import { FUEL_TYPES, IMPORT_STATUSES, VEHICLE_USAGES, plateCategoryFor, plateCategoryLabel, PLATE_CATEGORIES, vehicleUsageLabel } from "@/config/vehicle-usage";
import { VEHICLE_GROUPS, VEHICLE_TYPES, getVehicleType, suggestVehicleClass } from "@/config/vehicle-types";
import { useServiceQuery } from "@/hooks/use-service";
import { calculateVehicleFees } from "@/lib/fees";
import { resolveApplicationRequirements } from "@/lib/requirements";
import { assessmentService } from "@/services/assessment.service";
import { settingsService } from "@/services/settings.service";
import type { FuelType, ImportStatus, OwnershipType, TransactionType, VehicleGroup, VehicleSpecifications, VehicleType, VehicleUsage } from "@/types";
import { DescriptionList, Section } from "@/components/ui/layout-bits";
import { Field, Input, Select, Toggle } from "@/components/ui/form";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import { ChipList, YesNo } from "./config-bits";

/** Specification values the sample fee rules read (bands and `specEquals`). */
const FEE_SPEC_KEYS = ["engineCapacityCc", "grossVehicleMassKg", "seatingCapacity", "axleCount", "sidecar"];

/** Example values so banded rules resolve; the tester can change them. */
const EXAMPLE_SPECS: Record<VehicleGroup, VehicleSpecifications> = {
  two_wheeler: { engineCapacityCc: 125, sidecar: false },
  passenger: { engineCapacityCc: 2400, grossVehicleMassKg: 2500, seatingCapacity: 5, axleCount: 2 },
  passenger_transport: { engineCapacityCc: 4000, grossVehicleMassKg: 6500, seatingCapacity: 26, axleCount: 2 },
  commercial: { engineCapacityCc: 5200, grossVehicleMassKg: 9000, axleCount: 2 },
  towed: { grossVehicleMassKg: 2000, axleCount: 1 },
  special: { engineCapacityCc: 6000, grossVehicleMassKg: 8000, seatingCapacity: 2, axleCount: 2 },
};

const OVERDUE_TXN: TransactionType[] = ["renewal", "reinstatement"];

export function VehicleConfigPreview() {
  const rules = useServiceQuery(async () => {
    const [feeRules, documentRules] = await Promise.all([assessmentService.listFeeRules(), settingsService.listDocumentRules()]);
    return { feeRules, documentRules };
  }, []);

  const [transactionType, setTransactionType] = useState<TransactionType>("new");
  const [vehicleType, setVehicleType] = useState<VehicleType>("sedan");
  const [usage, setUsage] = useState<VehicleUsage>("private");
  const [fuel, setFuel] = useState<FuelType>("petrol");
  const [ownership, setOwnership] = useState<OwnershipType>("individual");
  const [importStatus, setImportStatus] = useState<ImportStatus>("used_import");
  const [period, setPeriod] = useState(REGISTRATION_PERIODS[0].months);
  const [overdue, setOverdue] = useState(0);
  const [specs, setSpecs] = useState<VehicleSpecifications>(EXAMPLE_SPECS.passenger);

  const def = getVehicleType(vehicleType);
  const txn = getTransactionType(transactionType);

  const pickType = (key: VehicleType) => {
    const next = getVehicleType(key);
    setVehicleType(key);
    setUsage(next.defaultUsage);
    if (!next.hasEngine) setFuel("none");
    else if (fuel === "none") setFuel("petrol");
    setSpecs(EXAMPLE_SPECS[next.group]);
  };

  const fields = vehicleFieldsFor(vehicleType, { fuelType: fuel });
  const feeFields = FEE_SPEC_KEYS.filter((k) => fields.some((f) => f.key === k)).map((k) => SPEC_FIELDS[k]);
  const plate = plateCategoryFor(vehicleType, usage);
  const plateDef = PLATE_CATEGORIES.find((p) => p.value === plate);
  const profile = inspectionProfileFor(vehicleType);
  const checklist = inspectionChecklistFor(vehicleType);
  const suggestedClass = suggestVehicleClass(vehicleType, specs);
  const monthsOverdue = OVERDUE_TXN.includes(transactionType) ? overdue : 0;

  const req = useMemo(
    () => resolveApplicationRequirements({ transactionType, vehicleType, vehicleUsage: usage, ownershipType: ownership, importStatus, technicalChange: transactionType === "change_vehicle" }, rules.data?.documentRules),
    [transactionType, vehicleType, usage, ownership, importStatus, rules.data],
  );

  const fees = useMemo(
    () =>
      rules.data
        ? calculateVehicleFees({
            transactionType,
            vehicleType,
            vehicleClass: suggestedClass,
            vehicleUsage: usage,
            specifications: specs,
            registrationPeriodMonths: period,
            inspectionRequired: req.inspectionRequired,
            newPlate: txn.issuesPlate,
            monthsOverdue,
            rules: rules.data.feeRules,
          })
        : null,
    [rules.data, transactionType, vehicleType, suggestedClass, usage, specs, period, req.inspectionRequired, txn.issuesPlate, monthsOverdue],
  );

  const fuelOptions = def.hasEngine ? FUEL_TYPES.filter((f) => f.value !== "none") : FUEL_TYPES.filter((f) => f.value === "none");

  return (
    <div className="split">
      <div className="r">
        <Section title="Scenario" description="Pick a vehicle and transaction to see what the registration screens will ask for.">
          <div className="form">
            <Field label="Transaction" htmlFor="pv-txn" className="full">
              <Select id="pv-txn" value={transactionType} onChange={(e) => setTransactionType(e.target.value as TransactionType)} options={TRANSACTION_TYPES.map((t) => ({ value: t.key, label: t.label }))} />
            </Field>
            <Field label="Vehicle type" htmlFor="pv-type" className="full">
              <select id="pv-type" className="inp" value={vehicleType} onChange={(e) => pickType(e.target.value as VehicleType)}>
                {VEHICLE_GROUPS.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {VEHICLE_TYPES.filter((t) => t.group === g.key).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Use" htmlFor="pv-use" help={usage === def.defaultUsage ? "Default use for this type." : undefined}>
              <Select id="pv-use" value={usage} onChange={(e) => setUsage(e.target.value as VehicleUsage)} options={VEHICLE_USAGES.map((u) => ({ value: u.value, label: u.label }))} />
            </Field>
            <Field label="Fuel type" htmlFor="pv-fuel">
              <Select id="pv-fuel" value={fuel} onChange={(e) => setFuel(e.target.value as FuelType)} options={fuelOptions} disabled={!def.hasEngine} />
            </Field>
            <Field label="Ownership" htmlFor="pv-own">
              <Select id="pv-own" value={ownership} onChange={(e) => setOwnership(e.target.value as OwnershipType)} options={OWNERSHIP_TYPES.map((o) => ({ value: o.value, label: o.label }))} />
            </Field>
            <Field label="Import status" htmlFor="pv-imp">
              <Select id="pv-imp" value={importStatus} onChange={(e) => setImportStatus(e.target.value as ImportStatus)} options={IMPORT_STATUSES} />
            </Field>
            {txn.renewsPeriod && (
              <Field label="Registration period" htmlFor="pv-period">
                <Select id="pv-period" value={String(period)} onChange={(e) => setPeriod(Number(e.target.value))} options={REGISTRATION_PERIODS.map((p) => ({ value: String(p.months), label: p.label }))} />
              </Field>
            )}
            {OVERDUE_TXN.includes(transactionType) && (
              <Field label="Months past expiry" htmlFor="pv-overdue" help="0 = renewed on time.">
                <Input id="pv-overdue" type="number" inputMode="numeric" min={0} max={36} value={overdue} onChange={(e) => setOverdue(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
              </Field>
            )}
          </div>
          {feeFields.length > 0 && (
            <fieldset className="m-0 min-w-0 border-0 border-t border-[#edeff3] p-0 pt-4">
              <legend className="h3 mb-1 text-[14px]">Specification (example values)</legend>
              <p className="help m-0 mb-3">Only the values the fee rules read. Change them to test fee bands.</p>
              <div className="form">
                {feeFields.map((f) =>
                  f.input === "boolean" ? (
                    <div key={f.key} className="full">
                      <Toggle label={f.label} description={f.help} checked={!!specs[f.key]} onChange={(v) => setSpecs({ ...specs, [f.key]: v })} />
                    </div>
                  ) : (
                    <Field key={f.key} label={`${f.label}${f.unit ? ` (${f.unit})` : ""}`} htmlFor={`pv-${f.key}`}>
                      <Input id={`pv-${f.key}`} type="number" inputMode="numeric" min={0} value={specs[f.key] === undefined ? "" : String(specs[f.key])} onChange={(e) => setSpecs({ ...specs, [f.key]: e.target.value === "" ? undefined : Number(e.target.value) })} />
                    </Field>
                  ),
                )}
              </div>
            </fieldset>
          )}
        </Section>
      </div>

      <div className="l" aria-live="polite">
        <Section title="Classification & plate">
          <DescriptionList
            items={[
              ["Vehicle group", VEHICLE_GROUPS.find((g) => g.key === def.group)?.label ?? def.group],
              ["Vehicle classes", <ChipList key="c" items={def.classes.map((c) => (c.key === suggestedClass ? `${c.label} (suggested)` : c.label))} empty="None" />],
              ["Body types", def.bodyTypes.join(", ")],
              ["Use", vehicleUsageLabel(usage)],
              ["Plate category", <span key="p">{plateCategoryLabel(plate)} <span className="mono mut">· series {plateDef?.prefix ?? "—"}</span></span>],
              ["Engine", def.hasEngine ? "Yes — engine number, fuel and transmission recorded" : "No — towed equipment"],
              ["Inspection", <span key="i" className="inline-flex flex-wrap items-center gap-2"><YesNo value={req.inspectionRequired} yes="Required" no="Not required" /><span className="mono text-[12.5px]">{profile.code}</span></span>],
              ["Insurance verification", <YesNo key="ins" value={req.insuranceRequired} yes="Required" no="Not required" />],
              ["Issues a plate", <YesNo key="pl" value={req.plateRequired} />],
            ]}
          />
        </Section>

        <Section title="Technical fields" description={`${fields.filter((f) => f.required).length} required · ${fields.filter((f) => !f.required).length} optional`}>
          {fields.length ? (
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
              {fields.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-2 rounded-lg border border-[#e1e4ea] px-3 py-2 text-[13.5px]">
                  <span className="min-w-0">
                    <span className="font-semibold">{f.label}</span>
                    {f.unit && <span className="mut"> ({f.unit})</span>}
                  </span>
                  {f.required ? <Badge tone="pend">Required</Badge> : <Badge tone="draft">Optional</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mut m-0 text-[13px]">No technical fields configured for this type.</p>
          )}
        </Section>

        <Section title="Supporting documents" description={`${req.documents.filter((d) => d.required).length} required for this scenario`}>
          {!rules.data && !rules.error ? (
            <Skeleton className="h-24" />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {req.documents.map((d) => (
                <li key={d.type} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[#e1e4ea] px-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-semibold">{documentLabel(d.type)}</span>
                    <span className="mut block text-[12.5px]">{d.reason}</span>
                  </span>
                  <StatusBadge kind="document" status={d.required ? "required" : "optional"} />
                </li>
              ))}
              {!req.documents.length && <li className="mut text-[13px]">No documents apply.</li>}
            </ul>
          )}
        </Section>

        <Section title="Inspection checklist" description={`${profile.code} · ${profile.label} — ${profile.note}`}>
          {!req.inspectionRequired && <p className="help m-0">Not required for this transaction; shown for reference.</p>}
          <div className="g3">
            {checklist.map((c) => (
              <div key={c.key} className="rounded-lg border border-[#e1e4ea] p-3">
                <p className="m-0 mb-1.5 text-[13px] font-bold">{c.label}</p>
                <ul className="m-0 list-disc pl-5 text-[13px]">
                  {c.items.map((i) => <li key={i.key}>{i.label}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Fee assessment" description="Calculated with the current fee rules (Administration → Fees).">
          {rules.error ? (
            <ErrorState message={rules.error} onRetry={() => rules.reload()} />
          ) : fees ? (
            <FeeBreakdown assessment={fees} />
          ) : (
            <Skeleton className="h-40" />
          )}
        </Section>
      </div>
    </div>
  );
}
