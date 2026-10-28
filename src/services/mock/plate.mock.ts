import { ServiceError } from "@/lib/errors";
import { uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import type { PlateAssignmentItem, PlateService } from "../interfaces";
import type { Plate, PlateStatus } from "@/types";
import { audit, consumeError, findById, mustFind, notify, nowIso, read, requirePermission, simulateNetwork, upsert, write } from "./core";
import { loadApp, saveApp, transition } from "./registration.mock";

const LOW_STOCK = 10;

// FUTURE: Replace MockPlateService with SupabasePlateService (row-level locking on assignment).
export class MockPlateService implements PlateService {
  async list(): Promise<Plate[]> {
    await mockDelay();
    return [...read("plates")].sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, undefined, { numeric: true }));
  }

  async listAvailable(officeId?: string): Promise<Plate[]> {
    await mockDelay(150, 400);
    return read("plates")
      .filter((p) => p.status === "available" && (!officeId || p.officeId === officeId))
      .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber, undefined, { numeric: true }));
  }

  async awaitingAssignment(): Promise<PlateAssignmentItem[]> {
    await mockDelay();
    return read("applications")
      .filter((a) => a.status === "approved")
      .map((application) => ({ application, owner: findById("owners", application.ownerId), motorcycle: findById("motorcycles", application.motorcycleId) }));
  }

  async assign(plateId: string, applicationId: string): Promise<Plate> {
    requirePermission("plates.assign", "assign plates");
    await mockDelay(400, 800);
    simulateNetwork();
    const plate = mustFind("plates", plateId, "Plate");
    if (consumeError("plate_conflict") || plate.status !== "available") {
      throw new ServiceError("conflict", "This plate has already been assigned.");
    }
    const app = loadApp(applicationId);
    if (app.status !== "approved") throw new ServiceError("workflow", "Only approved registrations can receive a plate.");
    const moto = mustFind("motorcycles", app.motorcycleId, "Motorcycle");
    if (moto.plateNumber) throw new ServiceError("conflict", `This motorcycle already has plate ${moto.plateNumber}.`);
    const ts = nowIso();
    const next: Plate = { ...plate, status: "assigned", motorcycleId: moto.id, applicationId: app.id, assignedDate: ts, updatedAt: ts };
    upsert("plates", next);
    app.plateNumber = plate.plateNumber;
    app.completedAt = ts;
    transition(app, "registered", `Plate ${plate.plateNumber} assigned`);
    saveApp(app);
    upsert("motorcycles", {
      ...moto,
      plateNumber: plate.plateNumber,
      registrationNumber: app.registrationNumber,
      registrationStatus: "registered",
      registrationDate: app.registrationDate,
      registrationExpiry: app.expiryDate,
      updatedAt: ts,
    });
    audit("plate_assigned", "Plate", `Plate ${plate.plateNumber} assigned to ${moto.make} ${moto.model} (${app.registrationNumber})`, { id: app.id, label: app.transactionNumber });
    const left = read("plates").filter((p) => p.status === "available" && p.officeId === plate.officeId).length;
    if (left < LOW_STOCK) {
      const office = findById("offices", plate.officeId);
      notify("Low Plate Inventory", `${office?.name ?? "Office"} has ${left} motorcycle plates left.`, "warning", "/plates");
    }
    return next;
  }

  async changeStatus(plateId: string, status: PlateStatus, note: string): Promise<Plate> {
    requirePermission("plates.manage", "manage plates");
    await mockDelay();
    const plate = mustFind("plates", plateId, "Plate");
    if (plate.status === "assigned" && status !== "released") throw new ServiceError("workflow", "An assigned plate can only be released.");
    if (status === "assigned") throw new ServiceError("workflow", "Use plate assignment to assign a plate.");
    const next: Plate = { ...plate, status, notes: note || plate.notes, updatedAt: nowIso() };
    if (status === "released" || status === "available") {
      next.motorcycleId = undefined;
      next.applicationId = undefined;
    }
    upsert("plates", next);
    audit("plate_status_changed", "Plate", `Plate ${plate.plateNumber}: ${plate.status} → ${status}${note ? ` (${note})` : ""}`, { id: plate.id, label: plate.plateNumber });
    return next;
  }

  async receiveBatch(input: { from: number; to: number; officeId: string; receivedDate: string }): Promise<Plate[]> {
    requirePermission("plates.manage", "receive plates");
    await mockDelay();
    if (input.to < input.from) throw new ServiceError("validation", "The last plate number must be after the first.");
    if (input.to - input.from > 499) throw new ServiceError("validation", "Receive at most 500 plates at a time.");
    const all = read("plates");
    const existing = new Set(all.map((p) => p.plateNumber));
    const ts = nowIso();
    const created: Plate[] = [];
    for (let n = input.from; n <= input.to; n++) {
      const plateNumber = `MC-${n}`;
      if (existing.has(plateNumber)) throw new ServiceError("conflict", `Plate ${plateNumber} already exists in inventory.`);
      created.push({ id: uuid(), plateNumber, type: "Motorcycle", officeId: input.officeId, status: "available", receivedDate: input.receivedDate, createdAt: ts, updatedAt: ts });
    }
    write("plates", [...all, ...created]);
    audit("plates_received", "Plate", `${created.length} plates received (MC-${input.from} – MC-${input.to})`);
    return created;
  }
}
