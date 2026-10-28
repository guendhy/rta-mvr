import { ServiceError } from "@/lib/errors";
import { uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import type { MotorcycleService } from "../interfaces";
import type { Motorcycle, MotorcycleDuplicateMatch, MotorcycleInput } from "@/types";
import { audit, consumeError, findById, nowIso, read, requirePermission, simulateNetwork, upsert, write } from "./core";

const norm = (s?: string) => (s ?? "").replace(/[\s-]/g, "").toUpperCase();

/** Registrations past their expiry date are reported as expired. */
export function refreshExpiry(list: Motorcycle[]): Motorcycle[] {
  const now = Date.now();
  let changed = false;
  for (const m of list) {
    if (m.registrationStatus === "registered" && m.registrationExpiry && new Date(m.registrationExpiry).getTime() < now) {
      m.registrationStatus = "expired";
      changed = true;
    }
  }
  if (changed) write("motorcycles", list);
  return list;
}

// FUTURE: Replace MockMotorcycleService with SupabaseMotorcycleService.
export class MockMotorcycleService implements MotorcycleService {
  async list(): Promise<Motorcycle[]> {
    await mockDelay();
    return refreshExpiry(read("motorcycles"));
  }

  async getById(id: string): Promise<Motorcycle | null> {
    await mockDelay(100, 300);
    refreshExpiry(read("motorcycles"));
    return findById("motorcycles", id);
  }

  async listByOwner(ownerId: string): Promise<Motorcycle[]> {
    await mockDelay(100, 300);
    return refreshExpiry(read("motorcycles")).filter((m) => m.ownerId === ownerId);
  }

  async findDuplicates(input: Pick<MotorcycleInput, "engineNumber" | "chassisNumber" | "vin">, excludeId?: string): Promise<MotorcycleDuplicateMatch[]> {
    await mockDelay(150, 350);
    const out: MotorcycleDuplicateMatch[] = [];
    for (const m of read("motorcycles")) {
      if (m.id === excludeId) continue;
      const fields: MotorcycleDuplicateMatch["fields"] = [];
      if (input.engineNumber && norm(m.engineNumber) === norm(input.engineNumber)) fields.push("engineNumber");
      if (input.chassisNumber && norm(m.chassisNumber) === norm(input.chassisNumber)) fields.push("chassisNumber");
      if (input.vin && norm(m.vin) === norm(input.vin)) fields.push("vin");
      if (fields.length) out.push({ motorcycle: m, fields });
    }
    return out;
  }

  async create(input: MotorcycleInput): Promise<Motorcycle> {
    requirePermission("registration.create", "create motorcycle records");
    await mockDelay();
    simulateNetwork();
    if (consumeError("save_failed")) throw new ServiceError("storage", "The application could not be saved locally.");
    const dupes = await this.findDuplicates(input);
    if (dupes.length) throw new ServiceError("conflict", "Possible existing motorcycle record found. Duplicate motorcycles cannot be created.");
    const ts = nowIso();
    const moto: Motorcycle = { ...input, id: uuid(), registrationStatus: "unregistered", createdAt: ts, updatedAt: ts };
    upsert("motorcycles", moto);
    audit("motorcycle_created", "Motorcycle", `Motorcycle ${moto.make} ${moto.model} (${moto.vin}) created`, { id: moto.id, label: moto.vin });
    return moto;
  }

  async update(id: string, input: Partial<MotorcycleInput>): Promise<Motorcycle> {
    requirePermission("registration.edit", "edit motorcycle records");
    await mockDelay();
    simulateNetwork();
    const current = findById("motorcycles", id);
    if (!current) throw new ServiceError("not_found", "Motorcycle not found.");
    if (input.engineNumber || input.chassisNumber || input.vin) {
      const dupes = await this.findDuplicates({
        engineNumber: input.engineNumber ?? current.engineNumber,
        chassisNumber: input.chassisNumber ?? current.chassisNumber,
        vin: input.vin ?? current.vin,
      }, id);
      if (dupes.length) throw new ServiceError("conflict", "Another motorcycle already uses this engine, chassis or VIN number.");
    }
    const next = { ...current, ...input, updatedAt: nowIso() };
    upsert("motorcycles", next);
    audit("registration_updated", "Motorcycle", `Motorcycle ${next.make} ${next.model} updated`, { id, label: next.vin });
    return next;
  }
}
