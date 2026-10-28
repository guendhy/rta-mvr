import { fullName } from "@/lib/formatting";
import type { VehicleRecord } from "@/services/interfaces";

const norm = (s?: string) => (s ?? "").replace(/[\s-]/g, "").toUpperCase();

/**
 * Client-side registry search with the same semantics as `VehicleService.lookup`:
 * registration / plate / VIN / chassis / engine number, owner name or phone; spaces and
 * dashes are ignored for identifiers ("BFK207" finds "BFK 207").
 */
export function recordMatches(r: VehicleRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qn = norm(query);
  const v = r.vehicle;
  const o = r.owner;
  const hay = [
    v.registrationNumber,
    v.previousRegistrationNumber,
    v.plateNumber,
    v.vin,
    v.chassisNumber,
    v.engineNumber,
    fullName(o),
    o ? `${o.firstName} ${o.lastName}` : "",
    o?.authorizedRepresentative,
    o?.mobile,
    o?.businessPhone,
  ].filter((h): h is string => !!h);
  return hay.some((h) => h.toLowerCase().includes(q) || (qn.length >= 3 && norm(h).includes(qn)));
}
