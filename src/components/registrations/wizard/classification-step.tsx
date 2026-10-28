"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { registrationService } from "@/services/registration.service";
import { settingsService } from "@/services/settings.service";
import { useServiceQuery } from "@/hooks/use-service";
import { getVehicleType, suggestVehicleClass, vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { plateCategoryFor, plateCategoryLabel, vehicleUsageLabel } from "@/config/vehicle-usage";
import { vehicleFieldsFor } from "@/config/vehicle-fields";
import { inspectionRuleText } from "@/config/inspection-checklists";
import { documentLabel, resolveDocumentRequirements } from "@/config/document-requirements";
import { classificationSchema } from "@/lib/validation/schemas";
import { Alert } from "@/components/ui/feedback";
import { DescriptionList } from "@/components/ui/layout-bits";
import { VehicleTypeSelect, VehicleUsageSelect } from "@/components/vehicles/vehicle-selects";
import type { StepProps } from "./types";
import type { VehicleClassification, VehicleType, VehicleUsage } from "@/types";

type Draft = Partial<VehicleClassification>;

/** VehicleClassificationForm — type, class, body type and use (recorded separately). */
export function VehicleClassificationForm({ value, onChange, errors = {} }: { value: Draft; onChange: (v: Draft) => void; errors?: Partial<Record<keyof VehicleClassification, string>> }) {
  const def = value.vehicleType ? getVehicleType(value.vehicleType) : null;
  return (
    <div className="flex flex-col gap-5">
      <section className="card sec">
        <VehicleTypeSelect
          value={value.vehicleType}
          error={errors.vehicleType}
          onChange={(t) => {
            const d = getVehicleType(t);
            onChange({ ...value, vehicleType: t, vehicleClass: suggestVehicleClass(t), bodyType: d.bodyTypes[0], vehicleUsage: value.vehicleUsage ?? d.defaultUsage });
          }}
        />
        <p className="help m-0">Types, classes and uses are managed in Administration → Vehicle Configuration. New categories appear here without design changes.</p>
      </section>
      <section className="card sec">
        {def ? (
          <div className="form">
            <fieldset className="full m-0 border-0 p-0">
              <legend className="lbl !text-[14px]">Vehicle Class<span className="req" aria-hidden="true">*</span></legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vehicle class">
                {def.classes.map((c) => (
                  <button key={c.key} type="button" role="radio" aria-checked={value.vehicleClass === c.key} className={`chip ${value.vehicleClass === c.key ? "chip-on" : ""}`} onClick={() => onChange({ ...value, vehicleClass: c.key })}>{c.label}</button>
                ))}
              </div>
              {errors.vehicleClass ? <p className="err" role="alert">{errors.vehicleClass}</p> : <p className="help">Filtered to classes valid for {def.label}.</p>}
            </fieldset>
            <div>
              <label className="lbl" htmlFor="bt">Body Type<span className="req" aria-hidden="true">*</span></label>
              <select id="bt" className={`inp ${errors.bodyType ? "inp-err" : ""}`} value={value.bodyType ?? ""} onChange={(e) => onChange({ ...value, bodyType: e.target.value })}>
                <option value="">Select body type</option>
                {def.bodyTypes.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              {errors.bodyType ? <p className="err" role="alert">{errors.bodyType}</p> : <p className="help">Options for this type: {def.bodyTypes.join(", ")}</p>}
            </div>
          </div>
        ) : <p className="mut m-0 text-[13.5px]">Select a vehicle type to see its classes and body types.</p>}
        <VehicleUsageSelect value={value.vehicleUsage} error={errors.vehicleUsage} onChange={(u) => onChange({ ...value, vehicleUsage: u })} />
      </section>
    </div>
  );
}

/** "Rules that will apply" side panel, resolved from configuration. */
export function ClassificationRules({ value, transactionType, ownershipType, validityMonths }: { value: Draft; transactionType: StepProps["detail"]["application"]["type"]; ownershipType?: string; validityMonths?: number }) {
  if (!value.vehicleType) return null;
  const def = getVehicleType(value.vehicleType);
  const fields = vehicleFieldsFor(value.vehicleType).filter((f) => f.required).map((f) => f.label);
  const docs = resolveDocumentRequirements({ transactionType, vehicleType: value.vehicleType as VehicleType, vehicleUsage: value.vehicleUsage as VehicleUsage, ownershipType: ownershipType as never }).filter((d) => d.required);
  return (
    <div className="card overflow-hidden">
      <div className="bg-[#0b0b0f] px-5 py-[18px] text-white">
        <p className="eb !text-[#c4c7d0]">Selected classification</p>
        <p className="m-0 mt-1.5 text-[20px] font-extrabold">{def.label}</p>
        <p className="m-0 mt-0.5 text-[13.5px] font-semibold text-[#ffd21a]">{value.vehicleUsage ? `${vehicleUsageLabel(value.vehicleUsage)} use` : "Use not selected"}</p>
      </div>
      <div className="flex flex-col gap-3 px-5 py-[18px]">
        <p className="eb">Rules that will apply</p>
        <DescriptionList className="text-[13px]" items={[
          ["Class", vehicleClassLabel(value.vehicleType, value.vehicleClass)],
          ["Inspection", inspectionRuleText(value.vehicleType, transactionType)],
          ["Plate series", plateCategoryLabel(plateCategoryFor(value.vehicleType, value.vehicleUsage))],
          ["Validity", validityMonths ? `${validityMonths} months (configured)` : "Per configuration"],
          ["Required fields", fields.join(", ") || "Standard fields"],
        ]} />
        <p className="eb mt-1">Required documents</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
          {docs.map((d) => <li key={d.type}>• {documentLabel(d.type)} <span className="mut">— {d.reason}</span></li>)}
        </ul>
        <p className="help m-0">Resolved from Administration → Requirements and Vehicle Configuration.</p>
      </div>
    </div>
  );
}

export function ClassificationStep({ detail, editable, registerApi }: StepProps) {
  const app = detail.application;
  const v = detail.vehicle;
  const reclass = app.type === "reclassification";
  const canEdit = editable && (app.type === "new" || reclass);
  const start: Draft = app.draft.classification ?? (v ? { vehicleType: v.vehicleType, vehicleClass: v.vehicleClass, vehicleUsage: v.vehicleUsage, bodyType: v.bodyType } : {});
  const [value, setValue] = useState<Draft>(start);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleClassification, string>>>({});
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    registerApi({
      continueLabel: app.type === "new" ? "Continue to Vehicle Details" : "Continue",
      saveDraft: async () => {
        if (canEdit) await registrationService.saveDraft(app.id, { classification: latest.current }, 3);
      },
      continue: async () => {
        if (!canEdit) return true;
        const parsed = classificationSchema.safeParse(latest.current);
        if (!parsed.success) {
          setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
          toast.error("Complete the vehicle classification.");
          return false;
        }
        const def = getVehicleType(parsed.data.vehicleType);
        if (!def.classes.some((c) => c.key === parsed.data.vehicleClass)) {
          setErrors({ vehicleClass: `Select a class valid for ${def.label}` });
          return false;
        }
        setErrors({});
        const c = parsed.data as VehicleClassification;
        if (reclass && v) {
          const changes = (["vehicleType", "vehicleClass", "vehicleUsage", "bodyType"] as const)
            .filter((k) => c[k] !== v[k])
            .map((k) => ({
              field: k,
              label: { vehicleType: "Vehicle type", vehicleClass: "Vehicle class", vehicleUsage: "Vehicle use", bodyType: "Body type" }[k],
              from: k === "vehicleType" ? vehicleTypeLabel(v[k]) : k === "vehicleUsage" ? vehicleUsageLabel(v[k]) : k === "vehicleClass" ? vehicleClassLabel(v.vehicleType, v[k]) : v[k],
              to: k === "vehicleType" ? vehicleTypeLabel(c[k]) : k === "vehicleUsage" ? vehicleUsageLabel(c[k]) : k === "vehicleClass" ? vehicleClassLabel(c.vehicleType, c[k]) : c[k],
            }));
          if (!changes.length) {
            toast.error("Choose the new classification or use — nothing has changed.");
            return false;
          }
          await registrationService.setChangeRequest(app.id, { summary: `Reclassify ${changes.map((x) => `${x.from} → ${x.to}`).join(", ")}`, changes }, { classification: c });
          toast.success("New classification recorded — applied on approval");
          return true;
        }
        await registrationService.saveClassification(app.id, c);
        return true;
      },
    });
    return () => registerApi(null);
  }, [app.id, app.type, canEdit, reclass, v, registerApi]);

  const current = useMemo(() => (v ? `${vehicleTypeLabel(v.vehicleType)} · ${vehicleClassLabel(v.vehicleType, v.vehicleClass)} · ${vehicleUsageLabel(v.vehicleUsage)} · ${v.bodyType}` : null), [v]);

  if (!canEdit) {
    return (
      <div className="split">
        <div className="l">
          <section className="card sec">
            <h2 className="h2">Vehicle classification</h2>
            {value.vehicleType ? (
              <DescriptionList items={[
                ["Vehicle type", vehicleTypeLabel(value.vehicleType)],
                ["Vehicle class", vehicleClassLabel(value.vehicleType, value.vehicleClass)],
                ["Vehicle use", vehicleUsageLabel(value.vehicleUsage)],
                ["Body type", value.bodyType],
              ]} />
            ) : <Alert tone="warn" title="Not classified">Classification has not been recorded.</Alert>}
            {app.type !== "new" && <p className="help m-0">To change the type or use, start a Vehicle Reclassification transaction.</p>}
          </section>
        </div>
        <div className="r"><ClassificationRules value={value} transactionType={app.type} ownershipType={detail.owner?.ownershipType} validityMonths={settings?.registration.validityMonths} /></div>
      </div>
    );
  }

  return (
    <div className="split">
      <div className="l">
        {reclass && current && <Alert tone="info" title="Current classification">{current} — select the new classification and use.</Alert>}
        <VehicleClassificationForm value={value} onChange={(next) => { setValue(next); setErrors({}); }} errors={errors} />
      </div>
      <div className="r">
        <ClassificationRules value={value} transactionType={app.type} ownershipType={detail.owner?.ownershipType} validityMonths={settings?.registration.validityMonths} />
      </div>
    </div>
  );
}
