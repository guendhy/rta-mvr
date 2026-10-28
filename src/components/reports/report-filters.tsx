"use client";

import { useState } from "react";
import { format, startOfMonth, startOfYear, subDays } from "date-fns";
import { Field, Input, Select } from "@/components/ui/form";
import { PROVINCE_NAMES } from "@/lib/constants";
import { PAYMENT_CHANNELS, PAYMENT_METHOD_LABELS } from "@/config/payment-channels";
import { VEHICLE_STATE_OPTIONS, VEHICLE_STATUS, type VehicleRegistrationState } from "@/config/statuses";
import { TRANSACTION_TYPE_OPTIONS, transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel, vehicleTypesByGroup } from "@/config/vehicle-types";
import type { Office, PaymentMethod, ReportFilterField, ReportFilters, SafeUser } from "@/types";

export const EMPTY_FILTERS: ReportFilters = {
  from: "", to: "", province: "", officeId: "", officerId: "", status: "", paymentMethod: "", vehicleType: "", transactionType: "", registrationStatus: "",
};

/** Which ReportFilters keys each filter field controls. */
const FIELD_KEYS: Record<ReportFilterField, (keyof ReportFilters)[]> = {
  date: ["from", "to"],
  vehicleType: ["vehicleType"],
  registrationStatus: ["registrationStatus"],
  transactionType: ["transactionType"],
  province: ["province"],
  officeId: ["officeId"],
  officerId: ["officerId"],
  status: ["status"],
  paymentMethod: ["paymentMethod"],
};

/**
 * Strips empty values — and, when `fields` is given, filters the selected report does not
 * use — so the report service and the printed header only see filters that apply.
 */
export function activeFilters(f: ReportFilters, fields?: ReportFilterField[]): ReportFilters {
  const allowed = fields ? new Set(fields.flatMap((k) => FIELD_KEYS[k])) : null;
  return Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== undefined && v !== "" && (!allowed || allowed.has(k as keyof ReportFilters)))) as ReportFilters;
}

export function describeFilters(f: ReportFilters, offices: Office[], users: SafeUser[], dateLabel = "Date"): string[] {
  const out: string[] = [];
  if (f.from || f.to) out.push(`${dateLabel}: ${f.from || "start"} to ${f.to || "today"}`);
  if (f.vehicleType) out.push(`Vehicle type: ${vehicleTypeLabel(f.vehicleType)}`);
  if (f.registrationStatus) out.push(`Registration status: ${VEHICLE_STATUS[f.registrationStatus as VehicleRegistrationState]?.label ?? f.registrationStatus}`);
  if (f.transactionType) out.push(`Transaction: ${transactionLabel(f.transactionType)}`);
  if (f.province) out.push(`Province: ${f.province}`);
  if (f.officeId) out.push(`Office: ${offices.find((o) => o.id === f.officeId)?.name ?? f.officeId}`);
  if (f.officerId) {
    const u = users.find((x) => x.id === f.officerId);
    out.push(`Officer: ${u ? `${u.firstName} ${u.lastName}` : f.officerId}`);
  }
  if (f.status) out.push(`Status: ${f.status}`);
  if (f.paymentMethod) out.push(`Payment method: ${PAYMENT_METHOD_LABELS[f.paymentMethod as PaymentMethod] ?? f.paymentMethod}`);
  return out;
}

type Preset = "" | "today" | "7d" | "30d" | "month" | "year" | "custom";
const PRESETS: { value: Exclude<Preset, "">; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const d = (x: Date) => format(x, "yyyy-MM-dd");
  switch (p) {
    case "today": return { from: d(now), to: d(now) };
    case "7d": return { from: d(subDays(now, 6)), to: d(now) };
    case "30d": return { from: d(subDays(now, 29)), to: d(now) };
    case "month": return { from: d(startOfMonth(now)), to: d(now) };
    case "year": return { from: d(startOfYear(now)), to: d(now) };
    default: return { from: "", to: "" };
  }
}

function presetOf(from = "", to = ""): Preset {
  if (!from && !to) return "";
  return PRESETS.find((p) => p.value !== "custom" && presetRange(p.value).from === from && presetRange(p.value).to === to)?.value ?? "custom";
}

const VEHICLE_TYPE_GROUPS = vehicleTypesByGroup().filter((g) => g.types.length);
const STATE_OPTIONS = VEHICLE_STATE_OPTIONS.map((o) => ({ value: o.value, label: o.value === "unregistered" ? "Pending (not yet registered)" : o.label }));
const METHOD_OPTIONS = PAYMENT_CHANNELS.map((c) => ({ value: c.method, label: c.label }));

export function ReportFilterForm({
  idPrefix,
  value,
  onChange,
  offices,
  users,
  statusOptions,
  fields,
  dateLabel = "Date",
}: {
  idPrefix: string;
  value: ReportFilters;
  onChange: (next: ReportFilters) => void;
  offices: Office[];
  users: SafeUser[];
  statusOptions: string[];
  /** Filters the selected report understands. */
  fields: ReportFilterField[];
  dateLabel?: string;
}) {
  const set = (k: keyof ReportFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  const id = (k: string) => `${idPrefix}-${k}`;
  const has = (k: ReportFilterField) => fields.includes(k);
  const dateError = value.from && value.to && value.from > value.to ? "The start date is after the end date." : undefined;
  const [customMode, setCustomMode] = useState(false);
  const preset: Preset = customMode ? "custom" : presetOf(value.from, value.to);
  const onPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value as Preset;
    setCustomMode(p === "custom");
    if (p !== "custom") onChange({ ...value, ...presetRange(p) });
  };

  return (
    <div className="grid gap-x-4 gap-y-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))" }}>
      {has("date") && (
        <>
          <Field label="Date range" htmlFor={id("range")} help={`Applies to ${dateLabel.toLowerCase()}`}>
            <Select id={id("range")} value={preset} onChange={onPreset} placeholder="All dates" options={PRESETS} />
          </Field>
          {preset === "custom" && (
            <>
              <Field label="From" htmlFor={id("from")} error={dateError}>
                <Input id={id("from")} type="date" value={value.from ?? ""} max={value.to || undefined} onChange={set("from")} invalid={!!dateError} />
              </Field>
              <Field label="To" htmlFor={id("to")}>
                <Input id={id("to")} type="date" value={value.to ?? ""} min={value.from || undefined} onChange={set("to")} />
              </Field>
            </>
          )}
        </>
      )}
      {has("vehicleType") && (
        <Field label="Vehicle type" htmlFor={id("vtype")}>
          <select id={id("vtype")} className="inp" value={value.vehicleType ?? ""} onChange={set("vehicleType")}>
            <option value="">All vehicle types</option>
            {VEHICLE_TYPE_GROUPS.map((g) => (
              <optgroup key={g.group.key} label={g.group.label}>
                {g.types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
      )}
      {has("registrationStatus") && (
        <Field label="Registration status" htmlFor={id("rstatus")}>
          <Select id={id("rstatus")} value={value.registrationStatus ?? ""} onChange={set("registrationStatus")} placeholder="All statuses" options={STATE_OPTIONS} />
        </Field>
      )}
      {has("transactionType") && (
        <Field label="Transaction type" htmlFor={id("ttype")}>
          <Select id={id("ttype")} value={value.transactionType ?? ""} onChange={set("transactionType")} placeholder="All transactions" options={TRANSACTION_TYPE_OPTIONS} />
        </Field>
      )}
      {has("province") && (
        <Field label="Province" htmlFor={id("province")}>
          <Select id={id("province")} value={value.province ?? ""} onChange={set("province")} placeholder="All provinces" options={PROVINCE_NAMES} />
        </Field>
      )}
      {has("officeId") && (
        <Field label="Office" htmlFor={id("office")}>
          <Select id={id("office")} value={value.officeId ?? ""} onChange={set("officeId")} placeholder="All offices" options={offices.map((o) => ({ value: o.id, label: o.name }))} />
        </Field>
      )}
      {has("officerId") && (
        <Field label="Officer" htmlFor={id("officer")}>
          <Select id={id("officer")} value={value.officerId ?? ""} onChange={set("officerId")} placeholder="All officers" options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} />
        </Field>
      )}
      {has("paymentMethod") && (
        <Field label="Payment method" htmlFor={id("method")}>
          <Select id={id("method")} value={value.paymentMethod ?? ""} onChange={set("paymentMethod")} placeholder="All methods" options={METHOD_OPTIONS} />
        </Field>
      )}
      {has("status") && statusOptions.length > 0 && (
        <Field label="Status" htmlFor={id("status")}>
          <Select id={id("status")} value={value.status ?? ""} onChange={set("status")} placeholder="All statuses" options={statusOptions} />
        </Field>
      )}
    </div>
  );
}
