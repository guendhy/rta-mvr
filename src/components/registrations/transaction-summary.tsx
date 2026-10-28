import Link from "next/link";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { vehicleUsageLabel } from "@/config/vehicle-usage";
import { formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { DescriptionList } from "@/components/ui/layout-bits";
import { StatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import type { RegistrationDetail } from "@/services/interfaces";

/** Reference, transaction, owner, vehicle and amount — used on payment, review and approval screens. */
export function TransactionSummary({ detail, showAmount = true }: { detail: RegistrationDetail; showAmount?: boolean }) {
  const { application: app, vehicle, owner, newOwner } = detail;
  return (
    <section className="card sec gap-4" aria-label="Transaction summary">
      <div className="sechd">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-[10px] bg-[#f4f5f8]"><VehicleIcon type={vehicle?.vehicleType} size={26} /></span>
          <div className="min-w-0">
            <p className="eb">{transactionLabel(app.type)}</p>
            <p className="h3"><Link href={`/registrations/${app.id}`} className="mono">{app.transactionNumber}</Link></p>
          </div>
        </div>
        <StatusBadge kind="registration" status={app.status} />
      </div>
      <DescriptionList items={[
        ["Registration no.", <span key="r" className="mono">{app.registrationNumber ?? vehicle?.registrationNumber ?? "Assigned on approval"}</span>],
        ["Plate", <span key="p" className="mono">{app.plateNumber ?? vehicle?.plateNumber ?? (app.plateRequired ? "Issued on approval" : "—")}</span>],
        [newOwner ? "Current owner" : "Registered owner", fullName(owner)],
        ...(newOwner ? [["New owner", fullName(newOwner)] as [string, React.ReactNode]] : []),
        ["Vehicle", vehicle ? `${vehicleLabel(vehicle)} · ${vehicle.color}` : "Not captured"],
        ["Vehicle type", vehicle ? `${vehicleTypeLabel(vehicle.vehicleType)} · ${vehicleUsageLabel(vehicle.vehicleUsage)}` : "—"],
        ...(showAmount ? [["Amount due", <strong key="a">{app.assessment ? formatMoney(app.assessment.total) : "Not assessed"}</strong>] as [string, React.ReactNode]] : []),
      ]} />
    </section>
  );
}
