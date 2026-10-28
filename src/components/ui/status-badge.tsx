import { getStatusLabel, getStatusVariant, vehicleRegistrationState, type BadgeTone, type StatusKind } from "@/config/statuses";
import type { Vehicle } from "@/types";

export function Badge({ tone, children, className = "" }: { tone: BadgeTone; children: React.ReactNode; className?: string }) {
  return <span className={`badge s-${tone} ${className}`}>{children}</span>;
}

/** Consistent status badges — always colour + dot + text label, from `src/config/statuses.ts`. */
export function StatusBadge({ kind, status, className }: { kind: StatusKind; status: string; className?: string }) {
  return <Badge tone={getStatusVariant(kind, status)} className={className}>{getStatusLabel(kind, status)}</Badge>;
}

/** Registry status of a vehicle, with "Expiring Soon" derived from the expiry date. */
export function RegistrationStatusBadge({ vehicle, soonDays, className }: { vehicle: Pick<Vehicle, "registrationStatus" | "registrationExpiry">; soonDays?: number; className?: string }) {
  return <StatusBadge kind="vehicle" status={vehicleRegistrationState(vehicle, Date.now(), soonDays)} className={className} />;
}
