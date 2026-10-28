"use client";

import { Field, Input, Select } from "@/components/ui/form";
import { PAYMENT_METHOD_LABELS, PROVINCE_NAMES } from "@/lib/constants";
import type { Office, PaymentMethod, ReportFilters, SafeUser } from "@/types";

export const EMPTY_FILTERS: ReportFilters = { from: "", to: "", province: "", officeId: "", officerId: "", status: "", paymentMethod: "" };

/** Strips empty values so the report service sees only active filters. */
export function activeFilters(f: ReportFilters): ReportFilters {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")) as ReportFilters;
}

export function describeFilters(f: ReportFilters, offices: Office[], users: SafeUser[]): string[] {
  const out: string[] = [];
  if (f.from || f.to) out.push(`Date: ${f.from || "start"} to ${f.to || "today"}`);
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

export function ReportFilterForm({
  idPrefix,
  value,
  onChange,
  offices,
  users,
  statusOptions,
}: {
  idPrefix: string;
  value: ReportFilters;
  onChange: (next: ReportFilters) => void;
  offices: Office[];
  users: SafeUser[];
  statusOptions: string[];
}) {
  const set = (k: keyof ReportFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  const id = (k: string) => `${idPrefix}-${k}`;
  const dateError = value.from && value.to && value.from > value.to ? "The start date is after the end date." : undefined;
  return (
    <div className="form">
      <Field label="From" htmlFor={id("from")} error={dateError}>
        <Input id={id("from")} type="date" value={value.from ?? ""} max={value.to || undefined} onChange={set("from")} invalid={!!dateError} />
      </Field>
      <Field label="To" htmlFor={id("to")}>
        <Input id={id("to")} type="date" value={value.to ?? ""} min={value.from || undefined} onChange={set("to")} />
      </Field>
      <Field label="Province" htmlFor={id("province")}>
        <Select id={id("province")} value={value.province ?? ""} onChange={set("province")} placeholder="All provinces" options={PROVINCE_NAMES} />
      </Field>
      <Field label="Office" htmlFor={id("office")}>
        <Select id={id("office")} value={value.officeId ?? ""} onChange={set("officeId")} placeholder="All offices" options={offices.map((o) => ({ value: o.id, label: o.name }))} />
      </Field>
      <Field label="Officer" htmlFor={id("officer")}>
        <Select id={id("officer")} value={value.officerId ?? ""} onChange={set("officerId")} placeholder="All officers" options={users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))} />
      </Field>
      <Field label="Status" htmlFor={id("status")}>
        <Select id={id("status")} value={value.status ?? ""} onChange={set("status")} placeholder="All statuses" options={statusOptions} disabled={!statusOptions.length} />
      </Field>
      <Field label="Payment method" htmlFor={id("method")}>
        <Select id={id("method")} value={value.paymentMethod ?? ""} onChange={set("paymentMethod")} placeholder="All methods" options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
      </Field>
    </div>
  );
}
