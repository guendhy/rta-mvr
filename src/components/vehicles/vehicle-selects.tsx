"use client";

import { useMemo, useState } from "react";
import { vehicleTypesByGroup } from "@/config/vehicle-types";
import { VEHICLE_USAGES } from "@/config/vehicle-usage";
import { VehicleIcon } from "./vehicle-icon";
import type { VehicleType, VehicleUsage } from "@/types";

/** VehicleTypeSelect — grouped chip radio group with a filter box. Types come from configuration. */
export function VehicleTypeSelect({ value, onChange, error, disabled }: { value?: VehicleType | string; onChange: (v: VehicleType) => void; error?: string; disabled?: boolean }) {
  const [filter, setFilter] = useState("");
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return vehicleTypesByGroup()
      .map((g) => ({ ...g, types: g.types.filter((t) => !q || t.label.toLowerCase().includes(q) || g.group.label.toLowerCase().includes(q)) }))
      .filter((g) => g.types.length);
  }, [filter]);
  return (
    <fieldset className="m-0 flex flex-col gap-4 border-0 p-0" disabled={disabled} aria-describedby={error ? "vt-err" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <legend className="h2 float-left">Vehicle type<span className="req" aria-hidden="true">*</span></legend>
        <input aria-label="Filter vehicle types" className="inp !h-10 max-w-[260px]" placeholder="Filter types…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {groups.map(({ group, types }) => (
        <div key={group.key} className="flex flex-col gap-2">
          <p className="eb">{group.label}</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={group.label}>
            {types.map((t) => (
              <button key={t.key} type="button" role="radio" aria-checked={value === t.key} className={`chip ${value === t.key ? "chip-on" : ""}`} onClick={() => onChange(t.key)}>
                <VehicleIcon type={t.key} size={16} />{t.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="mut m-0 text-[13px]">No vehicle types match “{filter}”.</p>}
      {error && <p id="vt-err" className="err" role="alert">{error}</p>}
    </fieldset>
  );
}

/** VehicleUsageSelect — purpose of use, recorded separately from the type. */
export function VehicleUsageSelect({ value, onChange, error }: { value?: VehicleUsage | string; onChange: (v: VehicleUsage) => void; error?: string }) {
  return (
    <fieldset className="m-0 border-0 p-0" aria-describedby={error ? "vu-err" : "vu-help"}>
      <legend className="lbl !text-[14px]">Vehicle Use / Purpose<span className="req" aria-hidden="true">*</span></legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vehicle use">
        {VEHICLE_USAGES.map((u) => (
          <button key={u.value} type="button" role="radio" aria-checked={value === u.value} className={`chip ${value === u.value ? "chip-on" : ""}`} onClick={() => onChange(u.value)}>{u.label}</button>
        ))}
      </div>
      {error ? <p id="vu-err" className="err" role="alert">{error}</p> : <p id="vu-help" className="help">Use is separate from type: a Van can be Private, Rental or PMV — each with different fees, inspections and documents.</p>}
    </fieldset>
  );
}
