"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { vehicleService } from "@/services/vehicle.service";
import type { VehicleRecord } from "@/services/interfaces";
import { friendlyError } from "@/lib/errors";
import { formatDate, fullName, vehicleLabel } from "@/lib/formatting";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { RegistrationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "./vehicle-icon";
import type { VehicleLookupField } from "@/types";

export const LOOKUP_FIELDS: { value: VehicleLookupField; label: string; placeholder: string }[] = [
  { value: "any", label: "Any identifier", placeholder: "Registration, plate, VIN, engine, owner or phone" },
  { value: "registrationNumber", label: "Registration number", placeholder: "e.g. REG-NCD-25-000012" },
  { value: "plateNumber", label: "Plate number", placeholder: "e.g. BGM 472" },
  { value: "vin", label: "VIN", placeholder: "17 characters" },
  { value: "chassisNumber", label: "Chassis number", placeholder: "As stamped on the chassis" },
  { value: "engineNumber", label: "Engine number", placeholder: "As stamped on the engine" },
  { value: "ownerName", label: "Owner name", placeholder: "Person or organisation" },
  { value: "phone", label: "Phone number", placeholder: "+675 7…" },
];

/**
 * VehicleLookup — finds an existing registry record by any identifier. Used by renewals,
 * transfers and every existing-vehicle transaction.
 */
export function VehicleLookup({
  onSelect,
  selectedId,
  actionLabel = "Select",
  title = "Find the existing vehicle record",
  initialQuery = "",
}: {
  onSelect: (record: VehicleRecord) => void;
  selectedId?: string;
  actionLabel?: string;
  title?: string;
  initialQuery?: string;
}) {
  const [field, setField] = useState<VehicleLookupField>("any");
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<VehicleRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const def = LOOKUP_FIELDS.find((f) => f.value === field)!;

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await vehicleService.lookup(query, field));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card sec" aria-label={title}>
      <h2 className="h3">{title}</h2>
      <form className="flex flex-wrap items-end gap-3" onSubmit={run} role="search">
        <div className="w-full sm:w-[220px]">
          <label className="lbl" htmlFor="lk-field">Search by</label>
          <select id="lk-field" className="inp" value={field} onChange={(e) => setField(e.target.value as VehicleLookupField)}>
            {LOOKUP_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
        <div className="min-w-0 flex-1 basis-[240px]">
          <label className="lbl" htmlFor="lk-q">Value</label>
          <input id="lk-q" className="inp mono" value={query} placeholder={def.placeholder} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <button type="submit" className="btn btn-p" disabled={busy || !query.trim()}>
          {busy ? <span className="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}Search
        </button>
      </form>
      {error && <Alert tone="bad" title="Search failed">{error}</Alert>}
      {results && results.length === 0 && <EmptyState title="No vehicle found" message="Check the number and try another identifier — VIN, chassis, engine number, plate or owner." />}
      {results && results.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Search results">
          {results.map((r) => {
            const v = r.vehicle;
            const selected = v.id === selectedId;
            return (
              <li key={v.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-[10px] border p-3 ${selected ? "border-2 border-[#1515e8] bg-[#f6f6ff]" : "border-[#e1e4ea]"}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 flex-none place-items-center rounded-lg bg-[#f4f5f8]"><VehicleIcon type={v.vehicleType} size={22} /></span>
                  <div className="min-w-0">
                    <p className="m-0 font-bold">{vehicleLabel(v)} · {v.color} <span className="mut text-[12.5px] font-medium">({vehicleTypeLabel(v.vehicleType)})</span></p>
                    <p className="mono mut m-0 truncate text-[12.5px]">{v.registrationNumber ?? "Unregistered"} · {v.plateNumber ?? "No plate"} · VIN {v.vin}</p>
                    <p className="mut m-0 text-[12.5px]">{fullName(r.owner)} · expires {formatDate(v.registrationExpiry)}</p>
                  </div>
                </div>
                <div className="row gap-2">
                  <RegistrationStatusBadge vehicle={v} />
                  {r.openApplication && <StatusBadge kind="registration" status={r.openApplication.status} />}
                  <button type="button" className={`btn btn-sm ${selected ? "btn-s" : "btn-p"}`} onClick={() => onSelect(r)} aria-pressed={selected}>{selected ? "Selected" : actionLabel}</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
