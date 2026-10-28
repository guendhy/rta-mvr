import { REGISTRATION_STATUS } from "@/lib/constants";
import { formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { getStatusLabel, vehicleRegistrationState } from "@/config/statuses";
import { mockDelay } from "@/lib/mock-delay";
import type { SearchResultGroup, SearchService } from "../interfaces";
import { can, findById, read } from "./core";

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[\s-]/g, "");

// FUTURE: Replace with a Postgres full-text / trigram search RPC.
export class MockSearchService implements SearchService {
  async search(query: string): Promise<SearchResultGroup[]> {
    await mockDelay(150, 350);
    const q = norm(query);
    if (q.length < 2) return [];
    const groups: SearchResultGroup[] = [];

    if (can("registration.view") || can("approval.view")) {
      const apps = read("applications").filter((a) => {
        const owner = findById("owners", a.ownerId);
        return [a.transactionNumber, a.registrationNumber, a.plateNumber, fullName(owner), owner?.mobile].some((v) => norm(v ?? "").includes(q));
      }).slice(0, 6);
      if (apps.length) groups.push({
        group: "Applications",
        items: apps.map((a) => ({ id: a.id, title: a.transactionNumber, subtitle: `${fullName(findById("owners", a.ownerId))} · ${vehicleLabel(findById("vehicles", a.vehicleId))}`, href: `/registrations/${a.id}`, badge: REGISTRATION_STATUS[a.status].label })),
      });
    }

    if (can("registry.view")) {
      const vehicles = read("vehicles").filter((m) => [m.plateNumber, m.registrationNumber, m.engineNumber, m.chassisNumber, m.vin, fullName(findById("owners", m.ownerId)), findById("owners", m.ownerId)?.mobile].some((v) => norm(v ?? "").includes(q))).slice(0, 6);
      if (vehicles.length) groups.push({
        group: "Motor Vehicle Registry",
        items: vehicles.map((m) => ({ id: m.id, title: m.plateNumber ?? m.registrationNumber ?? m.vin, subtitle: `${vehicleTypeLabel(m.vehicleType)} · ${vehicleLabel(m)} · ${fullName(findById("owners", m.ownerId))} · VIN ${m.vin}`, href: `/registry/${m.id}`, badge: getStatusLabel("vehicle", vehicleRegistrationState(m)) })),
      });
      const owners = read("owners").filter((o) => [fullName(o), o.mobile, o.identificationNumber].some((v) => norm(v).includes(q))).slice(0, 5);
      if (owners.length) groups.push({
        group: "Owners",
        items: owners.map((o) => {
          const vehicle = read("vehicles").find((m) => m.ownerId === o.id);
          return { id: o.id, title: fullName(o), subtitle: `${o.identificationNumber} · ${o.mobile}`, href: vehicle ? `/registry/${vehicle.id}` : "/registry" };
        }),
      });
    }

    if (can("payment.view")) {
      const pays = read("payments").filter((p) => [p.reference, p.receiptNumber, p.bankReference].some((v) => norm(v ?? "").includes(q))).slice(0, 6);
      if (pays.length) groups.push({
        group: "Payments & Receipts",
        items: pays.map((p) => ({ id: p.id, title: p.receiptNumber ?? p.reference, subtitle: `${p.reference} · ${formatMoney(p.amount)}`, href: `/payments/${p.id}`, badge: p.status })),
      });
    }
    return groups;
  }
}
