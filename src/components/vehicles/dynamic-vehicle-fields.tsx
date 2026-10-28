"use client";

import { Filter } from "lucide-react";
import { FIELD_GROUP_REASON, vehicleFieldsFor, type ResolvedSpecField } from "@/config/vehicle-fields";
import { getVehicleType } from "@/config/vehicle-types";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/status-badge";
import type { FuelType, VehicleSpecifications, VehicleType } from "@/types";

/**
 * DynamicVehicleFields — renders the technical-specification fields configured for the
 * vehicle type (and EV fields for electric / hybrid). No per-type form code.
 */
export function DynamicVehicleFields({
  vehicleType,
  fuelType,
  values,
  onChange,
  errors = {},
  readOnly,
}: {
  vehicleType: VehicleType | string;
  fuelType?: FuelType | string;
  values: VehicleSpecifications;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
  errors?: Record<string, string | undefined>;
  readOnly?: boolean;
}) {
  const def = getVehicleType(vehicleType);
  const fields = vehicleFieldsFor(vehicleType, { fuelType });
  const id = (f: ResolvedSpecField) => `spec-${f.key}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="condhd">
        <Filter size={16} aria-hidden="true" className="mt-0.5 flex-none" />
        <span>Showing fields required for <strong>{def.label}</strong>: {FIELD_GROUP_REASON[def.group]}</span>
      </div>
      <div className="form">
        {fields.map((f) => {
          const label = `${f.label}${f.unit ? ` (${f.unit})` : ""}`;
          const v = values[f.key];
          if (f.input === "boolean") {
            return (
              <fieldset key={f.key} className="m-0 border-0 p-0">
                <legend className="lbl">{f.label}{f.required && <span className="req" aria-hidden="true">*</span>}</legend>
                <div className="flex gap-2">
                  {[false, true].map((b) => (
                    <button key={String(b)} type="button" disabled={readOnly} aria-pressed={Boolean(v) === b} className={`opt flex-1 justify-center ${Boolean(v) === b ? "opt-on" : ""}`} onClick={() => onChange(f.key, b)}>{b ? "Yes" : "No"}</button>
                  ))}
                </div>
                {f.help && <p className="help">{f.help}</p>}
              </fieldset>
            );
          }
          if (f.input === "select") {
            return (
              <Field key={f.key} label={label} required={f.required} htmlFor={id(f)} error={errors[f.key]} help={f.help}>
                <Select id={id(f)} placeholder="Select" options={f.options ?? []} value={v === undefined ? "" : String(v)} disabled={readOnly} invalid={!!errors[f.key]} onChange={(e) => onChange(f.key, e.target.value || undefined)} />
              </Field>
            );
          }
          return (
            <Field key={f.key} label={label} required={f.required} htmlFor={id(f)} error={errors[f.key]} help={f.help}>
              <Input
                id={id(f)}
                type={f.input === "number" ? "number" : "text"}
                inputMode={f.input === "number" ? (f.integer ? "numeric" : "decimal") : undefined}
                step={f.input === "number" && !f.integer ? "any" : undefined}
                value={v === undefined ? "" : String(v)}
                readOnly={readOnly}
                invalid={!!errors[f.key]}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange(f.key, raw === "" ? undefined : f.input === "number" ? Number(raw) : raw);
                }}
              />
            </Field>
          );
        })}
      </div>
      {fields.some((f) => f.key.startsWith("battery") || f.key === "motorPowerKw") && <Badge tone="insp" className="self-start">Electric / hybrid fields shown for fuel type {String(fuelType)}</Badge>}
    </div>
  );
}
