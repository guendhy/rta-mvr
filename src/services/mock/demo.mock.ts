import { buildApplication, type MockDb } from "@/data/mock/builder";
import type { ApplicationSpec } from "@/data/mock/applications";
import { officeForProvince } from "@/data/mock/offices";
import { SEED_TERMINALS } from "@/data/mock/terminals";
import { buildPlates } from "@/data/mock/plates";
import { DEFAULT_POS_STATE } from "@/data/mock/settings";
import { PROVINCES, VEHICLE_COLORS } from "@/lib/constants";
import { makesFor, plateCategoryFor } from "@/config/vehicle-usage";
import { suggestVehicleClass } from "@/config/vehicle-types";
import { uuid } from "@/lib/generators";
import { KEYS, mockStorage } from "@/lib/mock-storage";
import { mockDelay } from "@/lib/mock-delay";
import type { NetworkState, Owner, SimulatedErrorKey, SimulationState, Vehicle, VehicleSpecifications, VehicleType, VehicleUsage } from "@/types";
import { audit, getSimulation, read, seedMeta, setPosState, setSimulation, write, writeSeed, type CollectionKey } from "./core";

export type ScenarioKey =
  | "ready_for_inspection"
  | "inspection_failed"
  | "insurance_expired"
  | "ready_for_payment"
  | "payment_declined"
  | "ready_for_approval"
  | "awaiting_plate"
  | "registered"
  | "expired_registration"
  | "returned"
  | "rejected"
  | "transfer_for_approval"
  | "renewal_inspection";

/** Seeded transaction number by sequence (see data/mock/applications.ts). */
const seq = (n: number) => `RTA-MV-${new Date().getFullYear()}-${String(n).padStart(8, "0")}`;

export const SCENARIOS: { key: ScenarioKey; label: string; seeded: string }[] = [
  { key: "ready_for_inspection", label: "Ready for Inspection", seeded: seq(27) },
  { key: "inspection_failed", label: "Inspection Failed", seeded: seq(28) },
  { key: "insurance_expired", label: "Insurance Expired", seeded: seq(29) },
  { key: "ready_for_payment", label: "Ready for Payment", seeded: seq(30) },
  { key: "payment_declined", label: "Payment Declined", seeded: seq(31) },
  { key: "ready_for_approval", label: "Ready for Approval", seeded: seq(32) },
  { key: "awaiting_plate", label: "Awaiting Plate", seeded: seq(33) },
  { key: "registered", label: "Registered", seeded: seq(23) },
  { key: "expired_registration", label: "Expired Registration", seeded: seq(5) },
  { key: "returned", label: "Returned", seeded: seq(34) },
  { key: "rejected", label: "Rejected", seeded: seq(35) },
  { key: "transfer_for_approval", label: "Transfer Awaiting Approval", seeded: seq(36) },
  { key: "renewal_inspection", label: "PMV Renewal Needs Inspection", seeded: seq(37) },
];

const FIRST = ["Jacob", "Miriam", "Tony", "Lucy", "Andrew", "Betty", "Gabriel", "Naomi", "Clement", "Veronica", "Elijah", "Judith"];
const LAST = ["Kapi", "Toliman", "Wani", "Gorua", "Pokana", "Sinai", "Ulka", "Hagei", "Mabo", "Tiri", "Amean", "Kua"];
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (n: number) => Math.floor(Math.random() * n);
const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const DB_KEYS: CollectionKey[] = ["users", "permissions", "owners", "vehicles", "applications", "inspections", "insurance", "feeRules", "documentRules", "payments", "plates", "audit", "notifications", "terminals", "offices", "centers", "settings", "counters"];

function loadDb(): MockDb {
  return Object.fromEntries(DB_KEYS.map((k) => [k, read(k)])) as unknown as MockDb;
}

function saveDb(db: MockDb, keys: CollectionKey[]) {
  for (const k of keys) write(k, db[k] as never);
}

/** Random demo vehicle types — a spread across groups. */
const DEMO_TYPES: { type: VehicleType; usage: VehicleUsage; specs: VehicleSpecifications; body: string }[] = [
  { type: "pickup", usage: "private", specs: { engineCapacityCc: 2393, grossVehicleMassKg: 2910, tareWeightKg: 2000, seatingCapacity: 5, axleCount: 2 }, body: "Double cab utility" },
  { type: "sedan", usage: "private", specs: { engineCapacityCc: 1798, grossVehicleMassKg: 1750, seatingCapacity: 5 }, body: "Sedan" },
  { type: "suv", usage: "private", specs: { engineCapacityCc: 2755, grossVehicleMassKg: 2990, seatingCapacity: 7 }, body: "4WD Wagon" },
  { type: "motorcycle", usage: "private", specs: { engineCapacityCc: 149, wheelCount: 2, motorcycleCategory: "Standard", sidecar: false }, body: "Standard" },
  { type: "pmv", usage: "pmv", specs: { seatingCapacity: 26, grossVehicleMassKg: 5100, axleCount: 2, emergencyExits: 1, routePermitNumber: "PMV-NCD-2026-0999" }, body: "Bus" },
  { type: "truck", usage: "commercial", specs: { grossVehicleMassKg: 16000, tareWeightKg: 7000, axleCount: 2, trailerCoupling: "None" }, body: "Tray" },
  { type: "van", usage: "commercial", specs: { engineCapacityCc: 2755, grossVehicleMassKg: 3300, seatingCapacity: 3 }, body: "Panel van" },
];

function randomOwnerAndVehicle(db: MockDb): { owner: Owner; vehicle: Vehicle } {
  const province = pick(PROVINCES);
  const district = province.districts[0];
  const first = pick(FIRST);
  const last = pick(LAST);
  const ts = new Date().toISOString();
  const owner: Owner = {
    id: uuid(), ownershipType: "individual", firstName: first, lastName: last, dateOfBirth: `19${70 + rnd(28)}-0${1 + rnd(8)}-1${rnd(9)}`, gender: rnd(2) ? "male" : "female",
    nationality: "Papua New Guinean", identificationType: "national_id", identificationNumber: `NID-${1900 + rnd(99)}-${100000 + rnd(899999)}`,
    mobile: `+675 7${rnd(9)}${rnd(9)}${rnd(9)} ${1000 + rnd(8999)}`, email: `${first}.${last}@example.com`.toLowerCase(), province: province.name, district,
    llg: `${district} Urban LLG`, ward: `Ward ${1 + rnd(9)}`, street: `Section ${1 + rnd(60)}, Lot ${1 + rnd(40)}`, createdAt: ts, updatedAt: ts,
  };
  const demo = pick(DEMO_TYPES);
  const makes = makesFor(demo.type);
  const make = pick(Object.keys(makes));
  const model = pick(makes[make]);
  const serial = String(1000000 + rnd(8999999));
  const vin = Array.from({ length: 17 }, () => VIN_CHARS[rnd(VIN_CHARS.length)]).join("");
  const vehicle: Vehicle = {
    id: uuid(), ownerId: owner.id, vehicleType: demo.type, vehicleClass: suggestVehicleClass(demo.type, demo.specs), vehicleUsage: demo.usage, bodyType: demo.body,
    make, model, variant: "Standard", year: 2020 + rnd(6), color: pick(VEHICLE_COLORS), engineNumber: `ENG-${serial}`, chassisNumber: `CH-${serial}`, vin,
    fuelType: demo.type === "motorcycle" ? "petrol" : "diesel", transmission: "manual", countryOfManufacture: pick(["Japan", "Thailand", "India", "China"]), importStatus: "new_import",
    provinceOfOperation: province.name, officeId: officeForProvince(province.name), specifications: demo.specs, photos: {}, registrationStatus: "unregistered",
    plateCategory: plateCategoryFor(demo.type, demo.usage), ownershipHistory: [], createdAt: ts, updatedAt: ts,
  };
  db.owners.unshift(owner);
  db.vehicles.push(vehicle);
  return { owner, vehicle };
}

function specFor(key: ScenarioKey): Omit<ApplicationSpec, "vehicle"> {
  switch (key) {
    case "ready_for_inspection": return { type: "new", target: "for_inspection", daysAgo: 0.05 };
    case "inspection_failed": return { type: "new", target: "inspection_failed", daysAgo: 0.05 };
    case "insurance_expired": return { type: "new", target: "for_insurance_verification", daysAgo: 0.05, insuranceStatus: "expired" };
    case "ready_for_payment": return { type: "new", target: "payment_required", daysAgo: 0.05 };
    case "payment_declined": return { type: "new", target: "payment_required", daysAgo: 0.05, failedAttempts: ["declined"] };
    case "ready_for_approval": return { type: "new", target: "for_approval", daysAgo: 0.05, method: "pos" };
    case "awaiting_plate": return { type: "new", target: "approved", daysAgo: 0.05, method: "cash" };
    case "registered": return { type: "new", target: "registered", daysAgo: 0.05, method: "pos" };
    case "expired_registration": return { type: "new", target: "registered", daysAgo: 380, method: "pos" };
    case "returned": return { type: "new", target: "returned", daysAgo: 0.1, method: "pos", reason: "Proof of ownership is illegible — upload a clearer copy." };
    case "rejected": return { type: "new", target: "rejected", daysAgo: 0.1, method: "cash", reason: "Chassis number tampering suspected. Referred to RTA Compliance." };
    case "transfer_for_approval":
    case "renewal_inspection":
      return { type: "new", target: "registered", daysAgo: 0.05, method: "pos" };
  }
}

// Demo / QA utilities — only available while Demo Tools are enabled.
export class MockDemoService {
  getSimulation(): SimulationState {
    return getSimulation();
  }

  setNetwork(network: NetworkState) {
    setSimulation({ network });
  }

  setPosMode(posMode: SimulationState["posMode"]) {
    setSimulation({ posMode });
  }

  armError(key: SimulatedErrorKey) {
    const sim = getSimulation();
    if (!sim.armedErrors.includes(key)) setSimulation({ armedErrors: [...sim.armedErrors, key] });
  }

  disarmError(key: SimulatedErrorKey) {
    setSimulation({ armedErrors: getSimulation().armedErrors.filter((k) => k !== key) });
  }

  /** Creates a brand-new owner, vehicle and application in the requested state. */
  async loadScenario(key: ScenarioKey): Promise<string> {
    await mockDelay(400, 800);
    const db = loadDb();
    randomOwnerAndVehicle(db);
    const spec = specFor(key);
    const now = new Date();
    const vehicle = db.vehicles.length - 1;
    const label = `Demo scenario — ${SCENARIOS.find((s) => s.key === key)?.label}`;
    let app = buildApplication(db, { ...spec, vehicle, at: new Date(now.getTime() - spec.daysAgo * 86_400_000), scenario: label }, now);
    if (key === "transfer_for_approval") {
      const buyer = db.owners.findIndex((o) => o.id !== db.vehicles[vehicle].ownerId);
      app = buildApplication(db, { vehicle, type: "transfer", target: "for_approval", daysAgo: 0.01, newOwner: buyer, method: "pos", previousApplicationId: app.id, at: new Date(now.getTime() - 0.01 * 86_400_000), scenario: label }, now);
    }
    if (key === "renewal_inspection") {
      app = buildApplication(db, { vehicle, type: "renewal", target: "for_inspection", daysAgo: 0.01, previousApplicationId: app.id, at: new Date(now.getTime() - 0.01 * 86_400_000), scenario: label }, now);
    }
    db.audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    saveDb(db, ["owners", "vehicles", "applications", "inspections", "insurance", "payments", "plates", "audit", "counters"]);
    return app.id;
  }

  async generateTestApplication(): Promise<string> {
    return this.loadScenario("ready_for_inspection");
  }

  findSeeded(key: ScenarioKey): string | null {
    const s = SCENARIOS.find((x) => x.key === key);
    return read("applications").find((a) => a.transactionNumber === s?.seeded)?.id ?? null;
  }

  restoreSeed() {
    writeSeed();
    audit("demo_reset", "Demo", "Original seed data restored");
  }

  clearDrafts(): number {
    const apps = read("applications");
    const keep = apps.filter((a) => a.status !== "draft");
    write("applications", keep);
    audit("demo_reset", "Demo", `${apps.length - keep.length} draft(s) cleared`);
    return apps.length - keep.length;
  }

  /** Removes payments taken during the demo and puts unapproved applications back to Payment Required. */
  resetPayments(): number {
    const seeded = new Set(seedMeta()?.paymentIds ?? []);
    const payments = read("payments");
    const removed = payments.filter((p) => !seeded.has(p.id));
    const apps = read("applications");
    const ts = new Date().toISOString();
    for (const p of removed) {
      const app = apps.find((a) => a.id === p.applicationId);
      if (app && app.paymentId === p.id && (app.status === "for_approval" || app.status === "paid")) {
        app.paymentId = undefined;
        app.history.push({ from: app.status, to: "payment_required", at: ts, by: "system", byName: "Demo reset", note: "Payment reset" });
        app.status = "payment_required";
        app.updatedAt = ts;
      }
    }
    const stillLinked = new Set(apps.map((a) => a.paymentId).filter(Boolean));
    write("payments", payments.filter((p) => seeded.has(p.id) || stillLinked.has(p.id)));
    write("applications", apps);
    setPosState({ pendingOutcomes: {} });
    audit("demo_reset", "Demo", "Demo payments reset");
    return removed.length;
  }

  /** Restores seed plates, then re-applies assignments held by current registrations. */
  resetPlates() {
    const fresh = buildPlates(read("plates")[0]?.receivedDate ?? new Date().toISOString().slice(0, 10));
    const apps = read("applications");
    for (const p of fresh) {
      const holder = apps.find((a) => a.plateNumber === p.plateNumber && a.status === "registered");
      if (holder) Object.assign(p, { status: "assigned", applicationId: holder.id, vehicleId: holder.vehicleId, assignedDate: holder.completedAt });
    }
    const extra = read("plates").filter((p) => !fresh.some((f) => f.plateNumber === p.plateNumber) && p.status === "assigned");
    write("plates", [...fresh, ...extra]);
    audit("demo_reset", "Demo", "Plate inventory reset");
  }

  resetTerminals() {
    write("terminals", SEED_TERMINALS.map((t) => ({ ...t, lastConnectedAt: new Date().toISOString() })));
    mockStorage.set(KEYS.pos, DEFAULT_POS_STATE);
    audit("demo_reset", "Demo", "POS terminals reset");
  }

  clearNotifications() {
    write("notifications", []);
  }

  clearAudit() {
    write("audit", []);
    audit("demo_reset", "Demo", "Audit log cleared");
  }

  clearAll() {
    mockStorage.reset();
  }

  dump(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of mockStorage.keys().sort()) out[k] = mockStorage.get(k);
    return out;
  }
}
