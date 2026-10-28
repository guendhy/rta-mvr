"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { vehicleService } from "@/services/vehicle.service";
import { registrationService } from "@/services/registration.service";
import { settingsService } from "@/services/settings.service";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { PROVINCE_NAMES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { fullName, vehicleLabel } from "@/lib/formatting";
import { vehicleSchemaFor, type VehicleFormValues } from "@/lib/validation/schemas";
import { getVehicleType, vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { COUNTRIES_OF_MANUFACTURE, FUEL_TYPES, IMPORT_STATUSES, makesFor, plateCategoryFor, plateCategoryLabel, TRANSMISSION_TYPES, VEHICLE_COLORS, vehicleUsageLabel } from "@/config/vehicle-usage";
import { formatSpecValue, specLabel } from "@/config/vehicle-fields";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { DescriptionList } from "@/components/ui/layout-bits";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { DynamicVehicleFields } from "@/components/vehicles/dynamic-vehicle-fields";
import { VehicleCard } from "../cards";
import { PhotoManager } from "./photo-manager";
import { useAutosave, type StepProps } from "./types";
import type { ChangeRequest, FileMeta, PhotoSlot, Vehicle, VehicleClassification, VehicleDuplicateMatch, VehicleInput } from "@/types";

const FIELD_LABEL = { engineNumber: "Engine number", chassisNumber: "Chassis number", vin: "VIN" };

const DEREG_REASONS = ["Written off / total loss", "Exported", "Scrapped / dismantled", "Stolen — not recovered", "Owner request", "Other"];

function defaults(v: Partial<VehicleInput> | undefined, type: string | undefined, province?: string): VehicleFormValues {
  const def = getVehicleType(type);
  return {
    make: v?.make ?? "", model: v?.model ?? "", variant: v?.variant ?? "", year: (v?.year ?? "") as unknown as number, modelYear: (v?.modelYear ?? "") as unknown as number,
    color: v?.color ?? "", secondaryColor: v?.secondaryColor ?? "", engineNumber: v?.engineNumber ?? "", chassisNumber: v?.chassisNumber ?? "", vin: v?.vin ?? "",
    fuelType: v?.fuelType ?? (def.hasEngine ? (def.group === "two_wheeler" ? "petrol" : "diesel") : "none"),
    transmission: v?.transmission ?? (def.hasEngine ? "manual" : "not_applicable"),
    countryOfManufacture: v?.countryOfManufacture ?? "", importStatus: v?.importStatus ?? "new_import", provinceOfOperation: v?.provinceOfOperation ?? province ?? "",
    previousRegistrationNumber: v?.previousRegistrationNumber ?? "", specifications: { ...(v?.specifications ?? {}) },
  };
}

/** Form values → vehicle record fields. */
function toVehicleFields(v: VehicleFormValues): Omit<VehicleInput, "ownerId" | "officeId" | "photos" | keyof VehicleClassification> {
  return {
    make: v.make.trim(), model: v.model.trim(), variant: v.variant || undefined, year: Number(v.year), modelYear: v.modelYear ? Number(v.modelYear) : undefined,
    color: v.color, secondaryColor: v.secondaryColor || undefined, engineNumber: (v.engineNumber ?? "").trim(), chassisNumber: v.chassisNumber.trim(), vin: v.vin.toUpperCase(),
    fuelType: v.fuelType, transmission: v.transmission, countryOfManufacture: v.countryOfManufacture, importStatus: v.importStatus, provinceOfOperation: v.provinceOfOperation,
    previousRegistrationNumber: v.previousRegistrationNumber || undefined,
    specifications: Object.fromEntries(Object.entries(v.specifications ?? {}).filter(([, x]) => x !== undefined && x !== "")),
  };
}

/** The common + dynamic vehicle details form (identification, information, technical specs). */
function VehicleDetailsForm({ form, classification, dupes, ownerName }: { form: ReturnType<typeof useForm<VehicleFormValues>>; classification: Partial<VehicleClassification>; dupes: VehicleDuplicateMatch[]; ownerName: string }) {
  const { register, watch, setValue, formState: { errors } } = form;
  const values = watch();
  const def = getVehicleType(classification.vehicleType);
  const makes = useMemo(() => makesFor(classification.vehicleType), [classification.vehicleType]);
  const models = makes[values.make] ?? [];
  const specErrors = Object.fromEntries(Object.entries((errors.specifications ?? {}) as Record<string, { message?: string }>).map(([k, e]) => [k, e?.message]));
  const dupField = (f: keyof typeof FIELD_LABEL) => dupes.some((d) => d.fields.includes(f));

  return (
    <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} noValidate>
      <section className="card sec">
        <div className="sechd"><h2 className="h2">Identification</h2><span className="mut text-[13px]">Owner: <strong className="text-[#0b0b0f]">{ownerName}</strong></span></div>
        <div className="form">
          <Field label="Vehicle Type" htmlFor="vt" help="Change in Step 3"><Input id="vt" readOnly value={vehicleTypeLabel(classification.vehicleType)} /></Field>
          <Field label="Vehicle Class" htmlFor="vcl"><Input id="vcl" readOnly value={vehicleClassLabel(classification.vehicleType, classification.vehicleClass)} /></Field>
          <Field label="Vehicle Use" htmlFor="vu"><Input id="vu" readOnly value={vehicleUsageLabel(classification.vehicleUsage)} /></Field>
          <Field label="Registration Number" htmlFor="rn"><Input id="rn" readOnly value="Assigned on approval" /></Field>
          <Field label="Plate Number" htmlFor="pn"><Input id="pn" readOnly value={`Assigned from ${plateCategoryLabel(plateCategoryFor(classification.vehicleType, classification.vehicleUsage))} series`} /></Field>
          <Field label="VIN / Chassis Number (VIN)" required htmlFor="vin" error={errors.vin?.message} help={`${values.vin?.length ?? 0} / 17 characters · no I, O or Q`}><Input id="vin" mono maxLength={17} style={{ textTransform: "uppercase" }} invalid={!!errors.vin || dupField("vin")} {...register("vin")} /></Field>
          <Field label="Chassis Number" required htmlFor="ch" error={errors.chassisNumber?.message}><Input id="ch" mono invalid={!!errors.chassisNumber || dupField("chassisNumber")} {...register("chassisNumber")} /></Field>
          {def.hasEngine && <Field label="Engine Number" required htmlFor="en" error={errors.engineNumber?.message} help="Exactly as stamped on the engine."><Input id="en" mono invalid={!!errors.engineNumber || dupField("engineNumber")} {...register("engineNumber")} /></Field>}
          <Field label="Previous Registration No." htmlFor="prn" help="Imported used / re-registration only"><Input id="prn" mono {...register("previousRegistrationNumber")} /></Field>
        </div>
        {dupes.length === 0 && values.vin?.length === 17 && <div className="rounded-lg border border-[#bfe6cd] bg-[#e9f7ef] px-3.5 py-3 text-[13px] text-[#0b4f25]" role="status"><strong>Duplicate check passed.</strong> VIN, chassis and engine not found on the registry.</div>}
      </section>
      <section className="card sec">
        <h2 className="h2">Vehicle information</h2>
        <div className="form">
          <Field label="Manufacturer / Make" required htmlFor="mk" error={errors.make?.message}>
            {Object.keys(makes).length ? <Select id="mk" placeholder="Select make" options={[...Object.keys(makes), ...(values.make && !makes[values.make] ? [values.make] : []), "Other"]} invalid={!!errors.make} {...register("make", { onChange: () => setValue("model", "") })} /> : <Input id="mk" invalid={!!errors.make} {...register("make")} />}
          </Field>
          <Field label="Model" required htmlFor="md" error={errors.model?.message}>
            {models.length ? <Select id="md" placeholder="Select model" options={[...models, ...(values.model && !models.includes(values.model) ? [values.model] : [])]} invalid={!!errors.model} {...register("model")} /> : <Input id="md" invalid={!!errors.model} {...register("model")} />}
          </Field>
          <Field label="Variant" htmlFor="vr"><Input id="vr" {...register("variant")} /></Field>
          <Field label="Year of Manufacture" required htmlFor="yr" error={errors.year?.message}><Input id="yr" type="number" inputMode="numeric" invalid={!!errors.year} {...register("year")} /></Field>
          <Field label="Model Year" htmlFor="my" error={errors.modelYear?.message}><Input id="my" type="number" inputMode="numeric" {...register("modelYear")} /></Field>
          <Field label="Country of Manufacture" required htmlFor="co" error={errors.countryOfManufacture?.message}><Select id="co" placeholder="Select country" options={COUNTRIES_OF_MANUFACTURE} invalid={!!errors.countryOfManufacture} {...register("countryOfManufacture")} /></Field>
          <Field label="Colour" required htmlFor="c1" error={errors.color?.message}><Select id="c1" placeholder="Select colour" options={VEHICLE_COLORS} invalid={!!errors.color} {...register("color")} /></Field>
          <Field label="Secondary Colour" htmlFor="c2"><Select id="c2" placeholder="None" options={VEHICLE_COLORS} {...register("secondaryColor")} /></Field>
          {def.hasEngine && <Field label="Fuel Type" required htmlFor="fu" error={errors.fuelType?.message}><Select id="fu" options={FUEL_TYPES.filter((f) => f.value !== "none")} {...register("fuelType")} /></Field>}
          {def.hasEngine && <Field label="Transmission" required htmlFor="tr"><Select id="tr" options={TRANSMISSION_TYPES.filter((t) => t.value !== "not_applicable")} {...register("transmission")} /></Field>}
          <Field label="Import Status" required htmlFor="im"><Select id="im" options={IMPORT_STATUSES} {...register("importStatus")} /></Field>
          <Field label="Province of Operation" required htmlFor="po" error={errors.provinceOfOperation?.message}><Select id="po" placeholder="Select province" options={PROVINCE_NAMES} invalid={!!errors.provinceOfOperation} {...register("provinceOfOperation")} /></Field>
        </div>
      </section>
      <section className="card sec">
        <div className="sechd"><h2 className="h2">Technical specifications</h2><Badge tone="insp">{def.label}</Badge></div>
        <DynamicVehicleFields
          vehicleType={def.key}
          fuelType={values.fuelType}
          values={values.specifications ?? {}}
          errors={specErrors}
          onChange={(k, val) => setValue(`specifications.${k}` as `specifications.${string}`, val, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })}
        />
      </section>
    </form>
  );
}

export function VehicleStep({ detail, editable, registerApi, onSaveState }: StepProps) {
  const app = detail.application;
  const isNew = app.type === "new";
  const classification: Partial<VehicleClassification> = isNew ? app.draft.classification ?? {} : detail.vehicle ?? {};
  const changeVehicle = app.type === "change_vehicle";
  const regTransfer = app.type === "registration_transfer";
  const dereg = app.type === "deregistration";
  const other = app.type === "other";
  const [mode, setMode] = useState<"view" | "new" | "edit">(isNew ? (detail.vehicle ? "view" : "new") : changeVehicle && editable ? "edit" : "view");
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, FileMeta>>>(detail.vehicle?.photos ?? app.draft.vehicle?.photos ?? {});
  const [dupes, setDupes] = useState<VehicleDuplicateMatch[]>([]);
  const [regTo, setRegTo] = useState({ province: app.draft.vehicle?.provinceOfOperation ?? "", officeId: app.draft.vehicle?.officeId ?? "" });
  const [closure, setClosure] = useState({ reason: app.closureReason?.split(" — ")[0] ?? "", detail: app.closureReason?.split(" — ")[1] ?? "", plateReturned: false });
  const [otherText, setOtherText] = useState(app.changeRequest?.summary ?? "");
  const { data: offices } = useServiceQuery(() => settingsService.listOffices(), []);
  const resolver = useMemo(() => zodResolver(vehicleSchemaFor(classification.vehicleType)), [classification.vehicleType]);
  const form = useForm<VehicleFormValues>({
    resolver,
    defaultValues: mode === "new" ? defaults(app.draft.vehicle, classification.vehicleType, detail.owner?.province) : defaults({ ...detail.vehicle ?? undefined, ...(changeVehicle ? app.draft.vehicle : {}) }, classification.vehicleType),
    mode: "onTouched",
  });
  const values = form.watch();

  useAutosave({ ...values, photos }, editable && mode === "new", async (v) => {
    onSaveState("saving");
    try {
      await registrationService.saveDraft(app.id, { vehicle: v as never }, 4);
      onSaveState("saved");
    } catch (e) {
      onSaveState("error");
      toast.error(friendlyError(e));
    }
  });

  // Duplicate VIN / chassis / engine detection (debounced).
  const idKey = useDebouncedValue(`${values.engineNumber}|${values.chassisNumber}|${values.vin}`, 600);
  useEffect(() => {
    if (mode === "view") return;
    const [engineNumber, chassisNumber, vin] = idKey.split("|");
    if ((engineNumber?.length ?? 0) < 5 && (chassisNumber?.length ?? 0) < 5 && (vin?.length ?? 0) < 17) {
      setDupes([]);
      return;
    }
    let cancelled = false;
    vehicleService.findDuplicates({ engineNumber, chassisNumber, vin }, mode === "edit" ? detail.vehicle?.id : undefined).then((d) => !cancelled && setDupes(d));
    return () => {
      cancelled = true;
    };
  }, [idKey, mode, detail.vehicle?.id]);

  const latest = useRef({ mode, photos, detail, regTo, closure, otherText });
  latest.current = { mode, photos, detail, regTo, closure, otherText };

  useEffect(() => {
    registerApi({
      continueLabel: isNew ? "Continue to Documents" : "Continue",
      saveDraft: async () => {
        if (latest.current.mode === "new") await registrationService.saveDraft(app.id, { vehicle: { ...form.getValues(), photos: latest.current.photos } as never }, 4);
      },
      continue: async () => {
        const { mode: m, detail: d } = latest.current;
        if (!editable) return true;
        if (regTransfer) {
          const t = latest.current.regTo;
          if (!t.province || !t.officeId) {
            toast.error("Select the new province and RTA office.");
            return false;
          }
          const office = offices?.find((o) => o.id === t.officeId);
          const change: ChangeRequest = { summary: `Move registration to ${office?.name ?? "new office"}`, changes: [
            { field: "provinceOfOperation", label: "Province of operation", from: d.vehicle?.provinceOfOperation, to: t.province },
            { field: "officeId", label: "Registering office", from: offices?.find((o) => o.id === d.vehicle?.officeId)?.name, to: office?.name ?? t.officeId },
          ] };
          await registrationService.setChangeRequest(app.id, change, { vehicle: { provinceOfOperation: t.province, officeId: t.officeId } });
          return true;
        }
        if (dereg) {
          const c = latest.current.closure;
          if (!c.reason) {
            toast.error("Select the reason for deregistration.");
            return false;
          }
          if (!c.plateReturned) {
            toast.error("Confirm the number plates were returned (or a police report is attached).");
            return false;
          }
          await registrationService.setChangeRequest(app.id, { summary: `Deregister — ${c.reason}`, changes: [{ field: "registrationStatus", label: "Registration status", from: "Active", to: "Deregistered" }] }, undefined, [c.reason, c.detail.trim()].filter(Boolean).join(" — "));
          return true;
        }
        if (other) {
          if (latest.current.otherText.trim().length < 10) {
            toast.error("Describe the request (at least 10 characters).");
            return false;
          }
          await registrationService.setChangeRequest(app.id, { summary: latest.current.otherText.trim(), changes: [] });
          return true;
        }
        if (m === "view") return !!d.vehicle;
        const ok = await form.trigger();
        if (!ok) {
          toast.error("Check the highlighted fields.");
          return false;
        }
        const v = toVehicleFields(form.getValues());
        const matches = await vehicleService.findDuplicates(v, m === "edit" ? d.vehicle?.id : undefined);
        if (matches.length) {
          setDupes(matches);
          toast.error("Duplicate VIN detected — a vehicle with these identifiers is already on the registry.");
          return false;
        }
        if (changeVehicle && d.vehicle) {
          const before = d.vehicle;
          const changes: ChangeRequest["changes"] = [];
          for (const k of ["make", "model", "variant", "year", "color", "secondaryColor", "engineNumber", "chassisNumber", "vin", "fuelType", "transmission"] as const) {
            if (String(v[k] ?? "") !== String(before[k] ?? "")) changes.push({ field: k, label: k.replace(/([A-Z])/g, " $1").toLowerCase(), from: String(before[k] ?? "—"), to: String(v[k] ?? "—") });
          }
          const specChanges = Object.entries(v.specifications).filter(([k, x]) => String(x) !== String(before.specifications[k] ?? ""));
          for (const [k, x] of specChanges) changes.push({ field: `specifications.${k}`, label: specLabel(k), from: formatSpecValue(k, before.specifications[k]), to: formatSpecValue(k, x) });
          if (!changes.length) {
            toast.error("No vehicle details were changed.");
            return false;
          }
          const technical = specChanges.length > 0 || v.engineNumber !== before.engineNumber;
          const draftVehicle: Partial<VehicleInput> = Object.fromEntries(changes.filter((c) => !c.field.startsWith("specifications.")).map((c) => [c.field, v[c.field as keyof typeof v]]));
          if (technical) draftVehicle.specifications = Object.fromEntries(specChanges);
          await registrationService.setChangeRequest(app.id, { summary: `${changes.length} vehicle detail(s) changed${technical ? " — technical change" : ""}`, changes }, { vehicle: draftVehicle });
          toast.success("Changes recorded — applied on approval");
          return true;
        }
        if (m === "edit" && d.vehicle) {
          await vehicleService.update(d.vehicle.id, { ...v, photos: latest.current.photos });
          toast.success("Vehicle details updated");
          return true;
        }
        if (!d.owner) {
          toast.error("Select the registered owner first.");
          return false;
        }
        const c = d.application.draft.classification;
        if (!c?.vehicleType || !c.vehicleClass || !c.vehicleUsage || !c.bodyType) {
          toast.error("Complete the vehicle classification (Step 3) first.");
          return false;
        }
        const vehicle = await vehicleService.create({ ...v, vehicleType: c.vehicleType, vehicleClass: c.vehicleClass, vehicleUsage: c.vehicleUsage, bodyType: c.bodyType, ownerId: d.owner.id, officeId: app.officeId, photos: latest.current.photos });
        await registrationService.attachVehicle(app.id, vehicle.id);
        toast.success(`${vehicleLabel(vehicle)} captured`);
        return true;
      },
    });
    return () => registerApi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, offices]);

  const savePhotos = async (p: Partial<Record<PhotoSlot, FileMeta>>) => {
    setPhotos(p);
    if (detail.vehicle && mode !== "new" && isNew) {
      try {
        await vehicleService.update(detail.vehicle.id, { photos: p });
      } catch (e) {
        toast.error(friendlyError(e));
      }
    }
  };

  const reusable = (v: Vehicle) => v.ownerId === detail.owner?.id && v.registrationStatus === "unregistered";
  const def = getVehicleType(classification.vehicleType);

  if (isNew && !classification.vehicleType) return <Alert tone="warn" title="Classification required">Complete Step 3 (Vehicle Classification) first — the fields on this step depend on the vehicle type.</Alert>;

  return (
    <div className="flex flex-col gap-5">
      {dupes.length > 0 && mode !== "view" && (
        <Alert tone="bad" title="Duplicate VIN detected">
          <p className="mb-2">The {[...new Set(dupes.flatMap((d) => d.fields))].map((f) => FIELD_LABEL[f]).join(", ")} already exists on the Motor Vehicle Registry. A duplicate record cannot be created.</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {dupes.map((d) => (
              <li key={d.vehicle.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 p-2.5 text-[#0b0b0f]">
                <span>
                  <strong>{vehicleLabel(d.vehicle)}</strong> ({vehicleTypeLabel(d.vehicle.vehicleType)}) · <span className="mono">{d.vehicle.vin}</span>
                  <span className="ml-2"><StatusBadge kind="vehicle" status={d.vehicle.registrationStatus} /></span>
                  <span className="mut block text-[12px]">Matches: {d.fields.map((f) => FIELD_LABEL[f]).join(", ")}{d.vehicle.plateNumber ? ` · Plate ${d.vehicle.plateNumber}` : ""}</span>
                </span>
                <span className="flex gap-1.5">
                  {mode === "new" && reusable(d.vehicle) && (
                    <button type="button" className="btn btn-p btn-sm" onClick={async () => {
                      try {
                        await registrationService.attachVehicle(app.id, d.vehicle.id);
                        toast.success("Existing vehicle record linked");
                      } catch (e) {
                        toast.error(friendlyError(e));
                      }
                    }}>Use this record</button>
                  )}
                  <Link href={`/registry/${d.vehicle.id}`} className="btn btn-s btn-sm" target="_blank">View record</Link>
                </span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {mode === "view" && detail.vehicle ? (
        <VehicleCard
          vehicle={detail.vehicle}
          actions={editable && isNew ? <><Badge tone="ok">Captured</Badge><button type="button" className="btn btn-s btn-sm" onClick={() => { form.reset(defaults(detail.vehicle!, classification.vehicleType)); setMode("edit"); }}><Pencil size={14} aria-hidden="true" />Edit details</button></> : <Badge tone="ok">On record</Badge>}
        />
      ) : mode !== "view" ? (
        <>
          {changeVehicle && <Alert tone="info" title="Change of vehicle details">Edit the fields that changed. Technical changes (engine, mass, seating…) require an inspection; changes are applied to the registry only on approval.</Alert>}
          <VehicleDetailsForm form={form} classification={classification} dupes={dupes} ownerName={fullName(detail.owner)} />
        </>
      ) : <Alert tone="warn" title="No vehicle linked">This application has no vehicle yet.</Alert>}

      {regTransfer && editable && (
        <section className="card sec">
          <h2 className="h2">New province &amp; office</h2>
          <div className="form">
            <Field label="Province of operation" required htmlFor="rt-p"><Select id="rt-p" placeholder="Select province" options={PROVINCE_NAMES} value={regTo.province} onChange={(e) => setRegTo((r) => ({ ...r, province: e.target.value }))} /></Field>
            <Field label="Registering RTA office" required htmlFor="rt-o"><Select id="rt-o" placeholder="Select office" options={(offices ?? []).filter((o) => o.status === "active").map((o) => ({ value: o.id, label: o.name }))} value={regTo.officeId} onChange={(e) => setRegTo((r) => ({ ...r, officeId: e.target.value }))} /></Field>
          </div>
        </section>
      )}

      {dereg && editable && (
        <section className="card sec">
          <h2 className="h2">Reason &amp; evidence</h2>
          <div className="form">
            <Field label="Reason for deregistration" required htmlFor="dr"><Select id="dr" placeholder="Select reason" options={DEREG_REASONS} value={closure.reason} onChange={(e) => setClosure((c) => ({ ...c, reason: e.target.value }))} /></Field>
            <Field label="Details" htmlFor="dd" className="full"><Textarea id="dd" value={closure.detail} onChange={(e) => setClosure((c) => ({ ...c, detail: e.target.value }))} placeholder="Insurer claim number, export entry, scrap certificate…" /></Field>
          </div>
          <label className="flex min-h-[44px] items-center gap-2.5 text-[14px]"><input type="checkbox" className="chk" checked={closure.plateReturned} onChange={(e) => setClosure((c) => ({ ...c, plateReturned: e.target.checked }))} />Number plates returned to the RTA (or police report attached for lost plates)</label>
          <Alert tone="warn" title="Supervisor approval required">The registry record is kept and marked Deregistered; its plates are released. History is never deleted.</Alert>
        </section>
      )}

      {other && editable && (
        <section className="card sec">
          <h2 className="h2">Describe the request</h2>
          <Field label="Request details" required htmlFor="ot"><Textarea id="ot" value={otherText} onChange={(e) => setOtherText(e.target.value)} /></Field>
        </section>
      )}

      {!isNew && detail.vehicle && (app.changeRequest?.changes.length ?? 0) > 0 && (
        <section className="card sec">
          <h2 className="h3">Requested changes</h2>
          <DescriptionList items={app.changeRequest!.changes.map((c) => [c.label, <span key={c.field}>{c.from ?? "—"} → <strong>{c.to}</strong></span>])} />
        </section>
      )}

      {(isNew || changeVehicle) && (
        <section className="card sec">
          <div><h2 className="h2">Vehicle photos</h2><p className="mut m-0 mt-0.5 text-[13px]">Front, rear, both sides, interior, VIN plate{def.hasEngine ? ", engine number" : ""} and chassis number. Images stay on this device.</p></div>
          <PhotoManager scope={app.id} photos={photos} onChange={savePhotos} readOnly={!editable} hasEngine={def.hasEngine} />
        </section>
      )}
    </div>
  );
}
