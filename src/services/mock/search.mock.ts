import { REGISTRATION_STATUS } from "@/lib/constants";
import { formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
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
        items: apps.map((a) => ({ id: a.id, title: a.transactionNumber, subtitle: `${fullName(findById("owners", a.ownerId))} · ${motorcycleLabel(findById("motorcycles", a.motorcycleId))}`, href: `/registrations/${a.id}`, badge: REGISTRATION_STATUS[a.status].label })),
      });
    }

    if (can("registry.view")) {
      const motos = read("motorcycles").filter((m) => [m.plateNumber, m.registrationNumber, m.engineNumber, m.chassisNumber, m.vin, fullName(findById("owners", m.ownerId))].some((v) => norm(v ?? "").includes(q))).slice(0, 6);
      if (motos.length) groups.push({
        group: "Motorcycles",
        items: motos.map((m) => ({ id: m.id, title: m.plateNumber ?? m.vin, subtitle: `${motorcycleLabel(m)} · ${fullName(findById("owners", m.ownerId))} · Engine ${m.engineNumber}`, href: `/registry/${m.id}`, badge: m.registrationStatus })),
      });
      const owners = read("owners").filter((o) => [fullName(o), o.mobile, o.identificationNumber].some((v) => norm(v).includes(q))).slice(0, 5);
      if (owners.length) groups.push({
        group: "Owners",
        items: owners.map((o) => {
          const moto = read("motorcycles").find((m) => m.ownerId === o.id);
          return { id: o.id, title: fullName(o), subtitle: `${o.identificationNumber} · ${o.mobile}`, href: moto ? `/registry/${moto.id}` : "/registry" };
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
