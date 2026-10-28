"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { motorcycleService } from "@/services/motorcycle.service";
import { registrationService } from "@/services/registration.service";
import { BODY_TYPES, COUNTRIES_OF_MANUFACTURE, FUEL_TYPES, IMPORT_STATUSES, INTENDED_USES, MAKES, MOTORCYCLE_COLORS, PROVINCE_NAMES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { fullName, motorcycleLabel } from "@/lib/formatting";
import { motorcycleSchema, type MotorcycleFormValues } from "@/lib/validation/schemas";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { VehicleCard } from "../cards";
import { PhotoManager } from "./photo-manager";
import { useAutosave, type StepProps } from "./types";
import type { FileMeta, Motorcycle, MotorcycleDuplicateMatch, PhotoSlot } from "@/types";

const FIELD_LABEL = { engineNumber: "Engine number", chassisNumber: "Chassis number", vin: "VIN" };

function defaults(m: Partial<Motorcycle> | undefined, province?: string): MotorcycleFormValues {
  return {
    make: m?.make ?? "", model: m?.model ?? "", variant: m?.variant ?? "", year: (m?.year ?? "") as unknown as number,
    bodyType: m?.bodyType ?? "Standard", color: m?.color ?? "", engineNumber: m?.engineNumber ?? "", chassisNumber: m?.chassisNumber ?? "",
    vin: m?.vin ?? "", engineCapacityCc: (m?.engineCapacityCc ?? "") as unknown as number, fuelType: m?.fuelType ?? "petrol",
    countryOfManufacture: m?.countryOfManufacture ?? "", importStatus: m?.importStatus ?? "new_import", intendedUse: (m?.intendedUse ?? "") as MotorcycleFormValues["intendedUse"],
    sidecar: m?.sidecar ?? false, provinceOfOperation: m?.provinceOfOperation ?? province ?? "",
  };
}

export function MotorcycleStep({ detail, editable, registerApi, onSaveState }: StepProps) {
  const app = detail.application;
  const [mode, setMode] = useState<"view" | "new" | "edit">(detail.motorcycle ? "view" : "new");
  const [photos, setPhotos] = useState<Partial<Record<PhotoSlot, FileMeta>>>(detail.motorcycle?.photos ?? app.draft.motorcycle?.photos ?? {});
  const [dupes, setDupes] = useState<MotorcycleDuplicateMatch[]>([]);
  const form = useForm<MotorcycleFormValues>({
    resolver: zodResolver(motorcycleSchema),
    defaultValues: mode === "new" ? defaults(app.draft.motorcycle, detail.owner?.province) : defaults(detail.motorcycle ?? undefined),
    mode: "onTouched",
  });
  const { register, watch, formState: { errors } } = form;
  const values = watch();
  const models = useMemo(() => MAKES[values.make] ?? [], [values.make]);

  useAutosave({ ...values, photos }, editable && mode === "new", async (v) => {
    onSaveState("saving");
    try {
      await registrationService.saveDraft(app.id, { motorcycle: v as never }, 2);
      onSaveState("saved");
    } catch (e) {
      onSaveState("error");
      toast.error(friendlyError(e));
    }
  });

  // Duplicate detection on engine / chassis / VIN (debounced).
  const idKey = useDebouncedValue(`${values.engineNumber}|${values.chassisNumber}|${values.vin}`, 600);
  useEffect(() => {
    if (mode === "view") return;
    const [engineNumber, chassisNumber, vin] = idKey.split("|");
    if ((engineNumber?.length ?? 0) < 5 && (chassisNumber?.length ?? 0) < 5 && (vin?.length ?? 0) < 17) {
      setDupes([]);
      return;
    }
    let cancelled = false;
    motorcycleService.findDuplicates({ engineNumber, chassisNumber, vin }, mode === "edit" ? detail.motorcycle?.id : undefined).then((d) => !cancelled && setDupes(d));
    return () => {
      cancelled = true;
    };
  }, [idKey, mode, detail.motorcycle?.id]);

  const latest = useRef({ mode, photos, dupes, detail });
  latest.current = { mode, photos, dupes, detail };

  useEffect(() => {
    registerApi({
      continueLabel: "Continue to Documents",
      saveDraft: async () => {
        if (latest.current.mode === "new") await registrationService.saveDraft(app.id, { motorcycle: { ...form.getValues(), photos: latest.current.photos } }, 2);
      },
      continue: async () => {
        const { mode: m, detail: d } = latest.current;
        if (!editable || m === "view") return !!d.motorcycle;
        const ok = await form.trigger();
        if (!ok) {
          toast.error("Check the highlighted fields.");
          return false;
        }
        const v = form.getValues();
        const matches = await motorcycleService.findDuplicates(v, m === "edit" ? d.motorcycle?.id : undefined);
        if (matches.length) {
          setDupes(matches);
          toast.error("Possible existing motorcycle record found. Duplicates cannot be created.");
          return false;
        }
        if (m === "edit" && d.motorcycle) {
          await motorcycleService.update(d.motorcycle.id, { ...v, vin: v.vin.toUpperCase(), photos: latest.current.photos });
          toast.success("Motorcycle details updated");
          return true;
        }
        if (!d.owner) {
          toast.error("Select the owner first.");
          return false;
        }
        const moto = await motorcycleService.create({ ...v, vin: v.vin.toUpperCase(), variant: v.variant || undefined, ownerId: d.owner.id, officeId: app.officeId, photos: latest.current.photos });
        await registrationService.attachMotorcycle(app.id, moto.id);
        toast.success(`${motorcycleLabel(moto)} captured`);
        return true;
      },
    });
    return () => registerApi(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  const savePhotos = async (p: Partial<Record<PhotoSlot, FileMeta>>) => {
    setPhotos(p);
    if (detail.motorcycle && mode !== "new") {
      try {
        await motorcycleService.update(detail.motorcycle.id, { photos: p });
      } catch (e) {
        toast.error(friendlyError(e));
      }
    }
  };

  const reusable = (m: Motorcycle) => m.ownerId === detail.owner?.id && m.registrationStatus === "unregistered";

  return (
    <div className="flex flex-col gap-5">
      {mode === "view" && detail.motorcycle ? (
        <VehicleCard
          motorcycle={detail.motorcycle}
          actions={editable ? <><Badge tone="ok">Captured</Badge><button type="button" className="btn btn-s btn-sm" onClick={() => { form.reset(defaults(detail.motorcycle!)); setMode("edit"); }}><Pencil size={14} aria-hidden="true" />Edit details</button></> : <Badge tone="ok">{app.type === "renewal" ? "Reviewed for renewal" : "On record"}</Badge>}
        />
      ) : (
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} noValidate>
          {dupes.length > 0 && (
            <Alert tone="bad" title="Possible existing motorcycle record found.">
              <p className="mb-2">The {[...new Set(dupes.flatMap((d) => d.fields))].map((f) => FIELD_LABEL[f]).join(", ")} already exists in the registry. A duplicate record cannot be created.</p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {dupes.map((d) => (
                  <li key={d.motorcycle.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/70 p-2.5 text-[#0b0b0f]">
                    <span>
                      <strong>{motorcycleLabel(d.motorcycle)}</strong> · <span className="mono">{d.motorcycle.vin}</span> · Engine <span className="mono">{d.motorcycle.engineNumber}</span>
                      <span className="ml-2"><StatusBadge kind="motorcycle" status={d.motorcycle.registrationStatus} /></span>
                      <span className="mut block text-[12px]">Matches: {d.fields.map((f) => FIELD_LABEL[f]).join(", ")}{d.motorcycle.plateNumber ? ` · Plate ${d.motorcycle.plateNumber}` : ""}</span>
                    </span>
                    <span className="flex gap-1.5">
                      {mode === "new" && reusable(d.motorcycle) && (
                        <button type="button" className="btn btn-p btn-sm" onClick={async () => {
                          try {
                            await registrationService.attachMotorcycle(app.id, d.motorcycle.id);
                            toast.success("Existing motorcycle record linked");
                          } catch (e) {
                            toast.error(friendlyError(e));
                          }
                        }}>Use this record</button>
                      )}
                      <Link href={`/registry/${d.motorcycle.id}`} className="btn btn-s btn-sm" target="_blank">View record</Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <section className="card sec">
            <div className="sechd"><h2 className="h2">{mode === "edit" ? "Edit motorcycle details" : "Motorcycle details"}</h2>{mode === "edit" && <button type="button" className="btn btn-g btn-sm" onClick={() => setMode("view")}>Cancel edit</button>}</div>
            <p className="mut m-0 -mt-2 text-[13px]">Owner: <strong className="text-[#0b0b0f]">{fullName(detail.owner)}</strong></p>
            <div className="form">
              <Field label="Make" required htmlFor="mk" error={errors.make?.message}>
                <Select id="mk" placeholder="Select make" options={[...Object.keys(MAKES), "Other"]} invalid={!!errors.make} {...register("make", { onChange: () => form.setValue("model", "") })} />
              </Field>
              <Field label="Model" required htmlFor="md" error={errors.model?.message}>
                {models.length ? <Select id="md" placeholder="Select model" options={models} invalid={!!errors.model} {...register("model")} /> : <Input id="md" invalid={!!errors.model} {...register("model")} />}
              </Field>
              <Field label="Variant" htmlFor="vr"><Input id="vr" {...register("variant")} /></Field>
              <Field label="Year of Manufacture" required htmlFor="yr" error={errors.year?.message}><Input id="yr" type="number" inputMode="numeric" invalid={!!errors.year} {...register("year")} /></Field>
              <Field label="Body Type" required htmlFor="bt" error={errors.bodyType?.message}><Select id="bt" options={BODY_TYPES} {...register("bodyType")} /></Field>
              <Field label="Color" required htmlFor="cl" error={errors.color?.message}><Select id="cl" placeholder="Select colour" options={MOTORCYCLE_COLORS} invalid={!!errors.color} {...register("color")} /></Field>
            </div>
          </section>
          <section className="card sec">
            <div><h2 className="h2">Identification numbers</h2><p className="mut m-0 mt-0.5 text-[13px]">Checked against the registry as you type to prevent duplicate records.</p></div>
            <div className="form">
              <Field label="Engine Number" required htmlFor="en" error={errors.engineNumber?.message} help="Exactly as stamped on the engine."><Input id="en" mono invalid={!!errors.engineNumber || dupes.some((d) => d.fields.includes("engineNumber"))} {...register("engineNumber")} /></Field>
              <Field label="Chassis Number" required htmlFor="ch" error={errors.chassisNumber?.message}><Input id="ch" mono invalid={!!errors.chassisNumber || dupes.some((d) => d.fields.includes("chassisNumber"))} {...register("chassisNumber")} /></Field>
              <Field label="VIN" required htmlFor="vin" error={errors.vin?.message} help={`${values.vin?.length ?? 0} / 17 characters`}><Input id="vin" mono maxLength={17} style={{ textTransform: "uppercase" }} invalid={!!errors.vin || dupes.some((d) => d.fields.includes("vin"))} {...register("vin")} /></Field>
              <Field label="Engine Capacity (CC)" required htmlFor="cc" error={errors.engineCapacityCc?.message}><Input id="cc" type="number" inputMode="numeric" invalid={!!errors.engineCapacityCc} {...register("engineCapacityCc")} /></Field>
              <Field label="Fuel Type" required htmlFor="fu"><Select id="fu" options={FUEL_TYPES} {...register("fuelType")} /></Field>
              <Field label="Country of Manufacture" required htmlFor="co" error={errors.countryOfManufacture?.message}><Select id="co" placeholder="Select country" options={COUNTRIES_OF_MANUFACTURE} invalid={!!errors.countryOfManufacture} {...register("countryOfManufacture")} /></Field>
            </div>
          </section>
          <section className="card sec">
            <h2 className="h2">Use &amp; configuration</h2>
            <div className="form">
              <Field label="Import Status" required htmlFor="im"><Select id="im" options={IMPORT_STATUSES} {...register("importStatus")} /></Field>
              <Field label="Intended Use" required htmlFor="iu" error={errors.intendedUse?.message}><Select id="iu" placeholder="Select" options={INTENDED_USES} invalid={!!errors.intendedUse} {...register("intendedUse")} /></Field>
              <Field label="Province of Operation" required htmlFor="po" error={errors.provinceOfOperation?.message}><Select id="po" placeholder="Select province" options={PROVINCE_NAMES} invalid={!!errors.provinceOfOperation} {...register("provinceOfOperation")} /></Field>
              <fieldset className="m-0 border-0 p-0">
                <legend className="lbl">Sidecar<span className="req" aria-hidden="true">*</span></legend>
                <div className="flex gap-2">
                  {[false, true].map((v) => (
                    <button key={String(v)} type="button" aria-pressed={values.sidecar === v} className={`opt flex-1 justify-center ${values.sidecar === v ? "opt-on" : ""}`} onClick={() => form.setValue("sidecar", v, { shouldDirty: true })}>{v ? "Yes" : "No"}</button>
                  ))}
                </div>
                <p className="help">Sidecar changes the registration fee (configured in Fees).</p>
              </fieldset>
            </div>
          </section>
        </form>
      )}
      <section className="card sec">
        <div><h2 className="h2">Motorcycle photos</h2><p className="mut m-0 mt-0.5 text-[13px]">Front, rear, both sides, engine number and chassis number. Images stay on this device.</p></div>
        <PhotoManager scope={app.id} photos={photos} onChange={savePhotos} readOnly={!editable} />
      </section>
    </div>
  );
}
