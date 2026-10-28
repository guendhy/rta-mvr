import { ServiceError } from "@/lib/errors";
import { fullName } from "@/lib/formatting";
import { uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import { plateCategoryFor } from "@/config/vehicle-usage";
import type { VehicleHistory, VehicleRecord, VehicleService } from "../interfaces";
import type { Vehicle, VehicleDuplicateMatch, VehicleInput, VehicleLookupField } from "@/types";
import { audit, consumeError, findById, nowIso, read, requirePermission, simulateNetwork, upsert, write } from "./core";

const norm = (s?: string) => (s ?? "").replace(/[\s-]/g, "").toUpperCase();
const CLOSED = ["registered", "rejected", "cancelled"];

/** Active registrations past their expiry date are reported as expired. */
export function refreshExpiry(list: Vehicle[]): Vehicle[] {
  const now = Date.now();
  let changed = false;
  for (const v of list) {
    if (v.registrationStatus === "active" && v.registrationExpiry && new Date(v.registrationExpiry).getTime() < now) {
      v.registrationStatus = "expired";
      changed = true;
    }
  }
  if (changed) write("vehicles", list);
  return list;
}

export function recordFor(v: Vehicle): VehicleRecord {
  const openApplication = read("applications").find((a) => a.vehicleId === v.id && !CLOSED.includes(a.status)) ?? null;
  return { vehicle: v, owner: findById("owners", v.ownerId), openApplication };
}

function haystack(r: VehicleRecord, field: VehicleLookupField): string[] {
  const v = r.vehicle;
  const o = r.owner;
  switch (field) {
    case "registrationNumber": return [v.registrationNumber ?? "", v.previousRegistrationNumber ?? ""];
    case "plateNumber": return [v.plateNumber ?? ""];
    case "vin": return [v.vin];
    case "chassisNumber": return [v.chassisNumber];
    case "engineNumber": return [v.engineNumber];
    case "ownerName": return [fullName(o), o?.authorizedRepresentative ?? "", o ? `${o.firstName} ${o.lastName}` : ""];
    case "phone": return [o?.mobile ?? "", o?.businessPhone ?? ""];
    default: return [v.registrationNumber ?? "", v.plateNumber ?? "", v.vin, v.chassisNumber, v.engineNumber, fullName(o), o?.mobile ?? "", o?.businessPhone ?? "", o?.identificationNumber ?? "", `${v.make} ${v.model}`];
  }
}

export function matchesLookup(r: VehicleRecord, query: string, field: VehicleLookupField = "any"): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qn = norm(query);
  return haystack(r, field).some((h) => h.toLowerCase().includes(q) || (qn.length >= 3 && norm(h).includes(qn)));
}

// FUTURE: Replace MockVehicleService with SupabaseVehicleService.
export class MockVehicleService implements VehicleService {
  async list(): Promise<Vehicle[]> {
    await mockDelay();
    return refreshExpiry(read("vehicles"));
  }

  async listRecords(): Promise<VehicleRecord[]> {
    await mockDelay();
    return refreshExpiry(read("vehicles")).map(recordFor);
  }

  async getById(id: string): Promise<Vehicle | null> {
    await mockDelay(100, 300);
    refreshExpiry(read("vehicles"));
    return findById("vehicles", id);
  }

  async getHistory(id: string): Promise<VehicleHistory | null> {
    await mockDelay(200, 500);
    refreshExpiry(read("vehicles"));
    const v = findById("vehicles", id);
    if (!v) return null;
    const applications = read("applications").filter((a) => a.vehicleId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const appIds = new Set(applications.map((a) => a.id));
    const ownerIds = new Set([v.ownerId, ...v.ownershipHistory.map((p) => p.ownerId), ...applications.flatMap((a) => [a.ownerId, a.transfer?.newOwnerId].filter(Boolean) as string[])]);
    return {
      record: recordFor(v),
      applications,
      inspections: read("inspections").filter((i) => i.vehicleId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      payments: read("payments").filter((p) => appIds.has(p.applicationId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      insurance: read("insurance").filter((i) => i.vehicleId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      owners: read("owners").filter((o) => ownerIds.has(o.id)),
      audit: read("audit").filter((e) => e.recordId === id || (e.recordId && appIds.has(e.recordId))),
    };
  }

  async listByOwner(ownerId: string): Promise<Vehicle[]> {
    await mockDelay(100, 300);
    return refreshExpiry(read("vehicles")).filter((v) => v.ownerId === ownerId);
  }

  async lookup(query: string, field: VehicleLookupField = "any"): Promise<VehicleRecord[]> {
    await mockDelay(200, 500);
    if (!query.trim()) return [];
    return refreshExpiry(read("vehicles")).map(recordFor).filter((r) => matchesLookup(r, query, field)).slice(0, 25);
  }

  async findDuplicates(input: Pick<VehicleInput, "engineNumber" | "chassisNumber" | "vin">, excludeId?: string): Promise<VehicleDuplicateMatch[]> {
    await mockDelay(150, 350);
    const out: VehicleDuplicateMatch[] = [];
    for (const v of read("vehicles")) {
      if (v.id === excludeId) continue;
      const fields: VehicleDuplicateMatch["fields"] = [];
      if (input.engineNumber && v.engineNumber && norm(v.engineNumber) === norm(input.engineNumber)) fields.push("engineNumber");
      if (input.chassisNumber && norm(v.chassisNumber) === norm(input.chassisNumber)) fields.push("chassisNumber");
      if (input.vin && norm(v.vin) === norm(input.vin)) fields.push("vin");
      if (fields.length) out.push({ vehicle: v, fields });
    }
    return out;
  }

  async create(input: VehicleInput): Promise<Vehicle> {
    requirePermission("registration.create", "create vehicle records");
    await mockDelay();
    simulateNetwork();
    if (consumeError("save_failed")) throw new ServiceError("storage", "The application could not be saved locally.");
    const dupes = await this.findDuplicates(input);
    if (dupes.length) throw new ServiceError("conflict", "Duplicate VIN detected — a vehicle with this VIN, chassis or engine number is already on the registry.");
    const ts = nowIso();
    const vehicle: Vehicle = {
      ...input,
      id: uuid(),
      plateCategory: input.plateCategory ?? plateCategoryFor(input.vehicleType, input.vehicleUsage),
      registrationStatus: "unregistered",
      ownershipHistory: [],
      createdAt: ts,
      updatedAt: ts,
    };
    upsert("vehicles", vehicle);
    audit("vehicle_created", "Vehicle", `Vehicle ${vehicle.make} ${vehicle.model} (${vehicle.vin}) created`, { id: vehicle.id, label: vehicle.vin });
    return vehicle;
  }

  async update(id: string, input: Partial<VehicleInput>): Promise<Vehicle> {
    requirePermission("registration.edit", "edit vehicle records");
    await mockDelay();
    simulateNetwork();
    const current = findById("vehicles", id);
    if (!current) throw new ServiceError("not_found", "Vehicle not found.");
    if (input.engineNumber || input.chassisNumber || input.vin) {
      const dupes = await this.findDuplicates({
        engineNumber: input.engineNumber ?? current.engineNumber,
        chassisNumber: input.chassisNumber ?? current.chassisNumber,
        vin: input.vin ?? current.vin,
      }, id);
      if (dupes.length) throw new ServiceError("conflict", "Duplicate VIN detected — another vehicle already uses this engine, chassis or VIN number.");
    }
    const next: Vehicle = { ...current, ...input, updatedAt: nowIso() };
    if (input.vehicleType || input.vehicleUsage) next.plateCategory = plateCategoryFor(next.vehicleType, next.vehicleUsage);
    upsert("vehicles", next);
    audit("vehicle_updated", "Vehicle", `Vehicle ${next.make} ${next.model} updated`, { id, label: next.vin });
    return next;
  }

  async setStatus(id: string, status: Vehicle["registrationStatus"], reason: string): Promise<Vehicle> {
    requirePermission("approval.decide", "suspend or cancel registrations");
    if (!reason.trim()) throw new ServiceError("validation", "A reason is required.");
    await mockDelay();
    const current = findById("vehicles", id);
    if (!current) throw new ServiceError("not_found", "Vehicle not found.");
    const next: Vehicle = { ...current, registrationStatus: status, statusReason: reason.trim(), updatedAt: nowIso() };
    upsert("vehicles", next);
    audit("vehicle_status_changed", "Vehicle", `Registration ${current.registrationNumber ?? current.vin} → ${status}: ${reason}`, { id, label: current.registrationNumber ?? current.vin });
    return next;
  }
}
