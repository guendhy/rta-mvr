import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import { formatDate, fullName, personName, vehicleLabel } from "@/lib/formatting";
import { IDENTIFICATION_TYPES } from "@/lib/constants";
import { isOrganization, ownershipTypeLabel } from "@/config/ownership-types";
import { vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { FUEL_TYPES, plateCategoryLabel, TRANSMISSION_TYPES, vehicleUsageLabel } from "@/config/vehicle-usage";
import { DescriptionList } from "@/components/ui/layout-bits";
import { Badge, RegistrationStatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { SpecList } from "@/components/vehicles/vehicle-specs";
import type { Owner, Vehicle } from "@/types";

/** Registered owner — individual or organisation. */
export function OwnerCard({ owner, actions, compact, title }: { owner: Owner; actions?: React.ReactNode; compact?: boolean; title?: string }) {
  const org = isOrganization(owner.ownershipType);
  return (
    <div className="card sec gap-4">
      <div className="sechd">
        <div className="flex min-w-0 items-center gap-3">
          <span className="ic bg-[#eeeefe] text-[#1515e8]">{org ? <Building2 size={20} aria-hidden="true" /> : <UserRound size={20} aria-hidden="true" />}</span>
          <div className="min-w-0">
            {title && <p className="eb">{title}</p>}
            <p className="h3">{fullName(owner)}</p>
            <p className="mono mut m-0 text-[12.5px]">{org ? owner.organizationRegistrationNumber : owner.identificationNumber} · {owner.businessPhone ?? owner.mobile}</p>
            <div className="mt-1.5"><Badge tone={org ? "insp" : "draft"}>{ownershipTypeLabel(owner.ownershipType)}</Badge></div>
          </div>
        </div>
        {actions && <div className="row gap-2">{actions}</div>}
      </div>
      {!compact && (
        <DescriptionList
          items={org ? [
            ["Ownership type", ownershipTypeLabel(owner.ownershipType)],
            ["Registration no.", <span key="r" className="mono">{owner.organizationRegistrationNumber}</span>],
            ["Authorized representative", `${owner.authorizedRepresentative ?? personName(owner)}${owner.representativePosition ? ` · ${owner.representativePosition}` : ""}`],
            ["Representative ID", <span key="i" className="mono">{owner.identificationNumber}</span>],
            ["Mobile", owner.mobile],
            ["Business phone", owner.businessPhone],
            ["Email", owner.email],
            ["Business address", [owner.street, owner.ward, owner.llg, owner.district, owner.province].filter(Boolean).join(", ")],
            ["Postal address", owner.postalAddress],
          ] : [
            ["Date of birth", formatDate(owner.dateOfBirth)],
            ["Gender", owner.gender === "male" ? "Male" : owner.gender === "female" ? "Female" : "Not stated"],
            ["Nationality", owner.nationality],
            ["Identification", IDENTIFICATION_TYPES.find((i) => i.value === owner.identificationType)?.label],
            ["Email", owner.email],
            ["Address", [owner.street, owner.ward, owner.llg, owner.district, owner.province].filter(Boolean).join(", ")],
            ["Postal address", owner.postalAddress],
          ]}
        />
      )}
    </div>
  );
}

/** VehicleSummaryCard — any motor vehicle, with type, class, use and type-specific specs. */
export function VehicleCard({ vehicle, actions, compact, title }: { vehicle: Vehicle; actions?: React.ReactNode; compact?: boolean; title?: string }) {
  return (
    <div className="card sec gap-4">
      <div className="sechd">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid h-14 w-14 flex-none place-items-center rounded-[10px] bg-[#f4f5f8]"><VehicleIcon type={vehicle.vehicleType} size={30} /></span>
          <div className="min-w-0">
            {title && <p className="eb">{title}</p>}
            <p className="h3">{vehicleLabel(vehicle)} · {vehicle.color}</p>
            <p className="mut m-0 mt-0.5 text-[13px]">{vehicleTypeLabel(vehicle.vehicleType)} · {vehicleClassLabel(vehicle.vehicleType, vehicle.vehicleClass)} · {vehicleUsageLabel(vehicle.vehicleUsage)}</p>
            <p className="mono mut m-0 mt-0.5 truncate text-[12.5px]">{vehicle.plateNumber ? `Plate ${vehicle.plateNumber} · ` : ""}VIN {vehicle.vin}</p>
            <div className="mt-1.5"><RegistrationStatusBadge vehicle={vehicle} /></div>
          </div>
        </div>
        {actions && <div className="row gap-2">{actions}</div>}
      </div>
      {!compact && (
        <>
          <DescriptionList items={[
            ["Variant", vehicle.variant],
            ["Body type", vehicle.bodyType],
            ["Engine number", vehicle.engineNumber ? <span key="e" className="mono">{vehicle.engineNumber}</span> : "Not applicable"],
            ["Chassis number", <span key="c" className="mono">{vehicle.chassisNumber}</span>],
            ["Fuel / transmission", `${FUEL_TYPES.find((f) => f.value === vehicle.fuelType)?.label ?? vehicle.fuelType} · ${TRANSMISSION_TYPES.find((t) => t.value === vehicle.transmission)?.label ?? "—"}`],
            ["Country of manufacture", vehicle.countryOfManufacture],
            ["Plate series", plateCategoryLabel(vehicle.plateCategory)],
            ["Province of operation", vehicle.provinceOfOperation],
            ["Registration", vehicle.registrationNumber ? <Link key="r" href={`/registry/${vehicle.id}`} className="mono">{vehicle.registrationNumber}</Link> : "Not registered"],
            ["Expiry", formatDate(vehicle.registrationExpiry)],
          ]} />
          <SpecList vehicle={vehicle} />
        </>
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
