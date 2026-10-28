"use client";

import { Search } from "lucide-react";
import { Badge } from "@/components/ui/status-badge";

/** Filter row above admin tables; controls wrap to one per line at phone width. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="card flex flex-wrap items-end gap-3 p-4 [&>*]:min-w-[min(100%,180px)] [&>*]:flex-1">{children}</div>;
}

export function SearchField({ id, label = "Search", value, onChange, placeholder }: { id: string; label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="!min-w-[min(100%,240px)] !flex-[2]">
      <label htmlFor={id} className="lbl">{label}</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
        <input id={id} type="search" className="inp !pl-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

export function FilterSelect({ id, label, value, onChange, options, all = "All" }: { id: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; all?: string }) {
  return (
    <div>
      <label htmlFor={id} className="lbl">{label}</label>
      <select id={id} className="inp" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Cancel + submit for a modal whose <form id={formId}> lives in the body. */
export function FormFooter({ formId, busy, onCancel, submitLabel = "Save" }: { formId: string; busy?: boolean; onCancel: () => void; submitLabel?: string }) {
  return (
    <>
      <button type="button" className="btn btn-s" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="submit" form={formId} className="btn btn-p" disabled={busy}>
        {busy && <span className="spin" aria-hidden="true" />}
        {submitLabel}
      </button>
    </>
  );
}

export function ActiveBadge({ active, on = "Active", off = "Inactive" }: { active: boolean; on?: string; off?: string }) {
  return <Badge tone={active ? "ok" : "draft"}>{active ? on : off}</Badge>;
}

export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return <p className="mut m-0 text-[13px]" aria-live="polite">Showing {shown} of {total} {noun}</p>;
}
