import Link from "next/link";
import { Bike, UserRound } from "lucide-react";
import { formatDate, fullName, motorcycleLabel } from "@/lib/formatting";
import { IDENTIFICATION_TYPES, INTENDED_USES } from "@/lib/constants";
import { DescriptionList } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Motorcycle, Owner } from "@/types";

export function OwnerCard({ owner, actions, compact }: { owner: Owner; actions?: React.ReactNode; compact?: boolean }) {
  return (
    <div className="card sec gap-4">
      <div className="sechd">
        <div className="flex items-center gap-3">
          <span className="ic bg-[#eeeefe] text-[#1515e8]"><UserRound size={20} aria-hidden="true" /></span>
          <div>
            <p className="h3">{fullName(owner)}</p>
            <p className="mono mut m-0 text-[12.5px]">{owner.identificationNumber} · {owner.mobile}</p>
          </div>
        </div>
        {actions && <div className="row gap-2">{actions}</div>}
      </div>
      {!compact && (
        <DescriptionList items={[
          ["Date of birth", formatDate(owner.dateOfBirth)],
          ["Gender", owner.gender === "male" ? "Male" : owner.gender === "female" ? "Female" : "Not stated"],
          ["Nationality", owner.nationality],
          ["Identification", IDENTIFICATION_TYPES.find((i) => i.value === owner.identificationType)?.label],
          ["Email", owner.email],
          ["Address", [owner.street, owner.ward, owner.llg, owner.district, owner.province].filter(Boolean).join(", ")],
          ["Postal address", owner.postalAddress],
        ]} />
      )}
    </div>
  );
}

export function VehicleCard({ motorcycle, actions, compact }: { motorcycle: Motorcycle; actions?: React.ReactNode; compact?: boolean }) {
  return (
    <div className="card sec gap-4">
      <div className="sechd">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-[10px] bg-[#f4f5f8]"><Bike size={30} strokeWidth={1.6} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="h3">{motorcycleLabel(motorcycle)} · {motorcycle.color}</p>
            <p className="mono mut m-0 mt-0.5 truncate text-[12.5px]">{motorcycle.plateNumber ? `Plate ${motorcycle.plateNumber} · ` : ""}VIN {motorcycle.vin}</p>
            <div className="mt-1.5"><StatusBadge kind="motorcycle" status={motorcycle.registrationStatus} /></div>
          </div>
        </div>
        {actions && <div className="row gap-2">{actions}</div>}
      </div>
      {!compact && (
        <DescriptionList items={[
          ["Variant", motorcycle.variant],
          ["Body type", motorcycle.bodyType],
          ["Engine number", <span key="e" className="mono">{motorcycle.engineNumber}</span>],
          ["Chassis number", <span key="c" className="mono">{motorcycle.chassisNumber}</span>],
          ["Engine capacity", `${motorcycle.engineCapacityCc} cc`],
          ["Fuel", motorcycle.fuelType],
          ["Country of manufacture", motorcycle.countryOfManufacture],
          ["Intended use", INTENDED_USES.find((u) => u.value === motorcycle.intendedUse)?.label],
          ["Sidecar", motorcycle.sidecar ? "Yes" : "No"],
          ["Province of operation", motorcycle.provinceOfOperation],
          ["Registration", motorcycle.registrationNumber ? <Link key="r" href={`/registry/${motorcycle.id}`} className="mono">{motorcycle.registrationNumber}</Link> : "Not registered"],
          ["Expiry", formatDate(motorcycle.registrationExpiry)],
        ]} />
      )}
    </div>
  );
}

export function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2.5 text-[13.5px]">
      <span className={`mt-px grid h-5 w-5 flex-none place-items-center rounded-full text-[12px] font-extrabold text-white ${ok ? "bg-[#137a3b]" : "bg-[#c4141b]"}`} aria-hidden="true">{ok ? "✓" : "✕"}</span>
      <span className="min-w-0">
        <span className="font-semibold">{label}</span>
        <span className="sr">{ok ? " — complete" : " — not complete"}</span>
        {detail && <span className="mut block text-[12.5px]">{detail}</span>}
      </span>
    </li>
  );
}
