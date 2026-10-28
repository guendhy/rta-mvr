"use client";

import { Fragment, useId } from "react";
import { Lock } from "lucide-react";
import { VEHICLE_GROUPS, VEHICLE_TYPES } from "@/config/vehicle-types";
import { EV_FIELDS, SPEC_FIELDS, VEHICLE_FIELD_CONFIG, vehicleFieldsFor } from "@/config/vehicle-fields";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";

/**
 * Shared building blocks for the configuration screens (vehicle, fee, requirement and
 * registration configuration). Everything here is presentational — data comes from
 * `src/config/*` or the services.
 */

export const PHASE_1_NOTICE = "Static configuration in Phase 1 — editable once the vehicle_types tables are connected (Phase 2).";

/** "Static configuration" banner for config that is read from code in Phase 1. */
export function StaticConfigNotice({ title = "Managed configuration · read-only in Phase 1", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <Alert tone="info" title={title}>
      {children ?? <p>{PHASE_1_NOTICE}</p>}
    </Alert>
  );
}

/** Shown when the signed-in role can open a screen but not change it. */
export function ReadOnlyBanner({ what }: { what: string }) {
  return (
    <Alert tone="warn" title="View only">
      <p>Your role can view {what} but cannot change it. Ask an RTA administrator if a change is needed.</p>
    </Alert>
  );
}

export function LockedHint({ children = "Read-only" }: { children?: React.ReactNode }) {
  return (
    <span className="mut inline-flex items-center gap-1 text-[12px] font-semibold">
      <Lock size={12} aria-hidden="true" />
      {children}
    </span>
  );
}

/** A plain table inside a bordered box that scrolls sideways on narrow screens. */
export function ConfigTable({ caption, head, children, minWidth = 720 }: { caption: string; head: React.ReactNode; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#e1e4ea]" role="region" aria-label={caption} tabIndex={0}>
      <table className="tbl" style={{ minWidth }}>
        <caption className="sr">{caption}</caption>
        <thead>{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Compact list of tag-like values; shows `empty` when there are none. */
export function ChipList({ items, empty = "Any", tone = "default" }: { items: React.ReactNode[]; empty?: string; tone?: "default" | "blue" }) {
  if (!items.length) return <span className="mut text-[12.5px]">{empty}</span>;
  const cls = tone === "blue" ? "bg-[#eeeefe] text-[#2a2d8f]" : "bg-[#eef0f4] text-[#3a3f4a]";
  return (
    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {items.map((it, i) => (
        <li key={i} className={`rounded-md px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap ${cls}`}>{it}</li>
      ))}
    </ul>
  );
}

/** Yes / No with text, never colour alone. */
export function YesNo({ value, yes = "Yes", no = "No" }: { value: boolean; yes?: string; no?: string }) {
  return <Badge tone={value ? "ok" : "draft"}>{value ? yes : no}</Badge>;
}

export function labelsFor<T extends string>(keys: readonly T[] | undefined, options: readonly { value: T; label: string }[]): string[] {
  return (keys ?? []).map((k) => options.find((o) => o.value === k)?.label ?? String(k));
}

/** Multi-select as a checkbox group. An empty selection means "any". */
export function CheckGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  help = "Leave all unticked to apply to any.",
  disabled,
}: {
  legend: string;
  options: readonly { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  help?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="full m-0 min-w-0 border-0 p-0" aria-describedby={`${id}-help`} disabled={disabled}>
      <legend className="lbl">
        {legend} <span className="mut font-normal">({value.length ? `${value.length} selected` : "any"})</span>
      </legend>
      <div className="grid grid-cols-1 gap-x-4 gap-y-0.5 rounded-lg border border-[#e1e4ea] p-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[13.5px]">
              <input type="checkbox" className="chk" checked={on} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))} />
              {o.label}
            </label>
          );
        })}
      </div>
      <p id={`${id}-help`} className="help">{help}</p>
    </fieldset>
  );
}

/** Where a vehicle type's field schema comes from: its own override or its group. */
export function fieldSourceFor(typeKey: string, group: string): string {
  if (VEHICLE_FIELD_CONFIG[typeKey as keyof typeof VEHICLE_FIELD_CONFIG]) return "Type override";
  if (VEHICLE_FIELD_CONFIG[group as keyof typeof VEHICLE_FIELD_CONFIG]) return "Group default";
  return "None configured";
}

/** Required / optional technical-specification fields for every vehicle type. */
export function VehicleFieldMatrix() {
  return (
    <div className="flex flex-col gap-4">
      <ConfigTable
        caption="Technical specification fields per vehicle type"
        minWidth={860}
        head={
          <tr>
            <th scope="col">Vehicle type</th>
            <th scope="col">Schema source</th>
            <th scope="col">Required fields</th>
            <th scope="col">Optional fields</th>
          </tr>
        }
      >
        {VEHICLE_GROUPS.map((g) => {
          const types = VEHICLE_TYPES.filter((t) => t.group === g.key);
          return (
            <Fragment key={g.key}>
              <tr>
                <th scope="colgroup" colSpan={4} className="!bg-[#eef0f4] !text-[#0b0b0f]">{g.label}</th>
              </tr>
              {types.map((t) => {
                const fields = vehicleFieldsFor(t.key);
                return (
                  <tr key={t.key}>
                    <th scope="row" className="!bg-white !text-[13px] !font-semibold !normal-case !tracking-normal !text-[#0b0b0f]">
                      {t.label}
                      <span className="mono mut block text-[11px] font-normal">{t.key}</span>
                    </th>
                    <td className="text-[12.5px] whitespace-nowrap">{fieldSourceFor(t.key, t.group)}</td>
                    <td><ChipList tone="blue" items={fields.filter((f) => f.required).map((f) => f.label)} empty="None" /></td>
                    <td><ChipList items={fields.filter((f) => !f.required).map((f) => f.label)} empty="None" /></td>
                  </tr>
                );
              })}
            </Fragment>
          );
        })}
      </ConfigTable>
      <p className="help m-0">
        Electric and hybrid vehicles with an engine also require: {EV_FIELDS.map((f) => SPEC_FIELDS[f.key]?.label ?? f.key).join(", ")}. Battery-electric vehicles do not require engine capacity or cylinders. Towed equipment (no engine) never shows EV fields.
      </p>
    </div>
  );
}
