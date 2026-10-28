import { createSeedDb } from "@/data/mock/seed";
import type { MockDb } from "@/data/mock/builder";
import { auditEvent } from "@/data/mock/audit-logs";
import { DEFAULT_POS_STATE, DEFAULT_SIMULATION } from "@/data/mock/settings";
import { ServiceError } from "@/lib/errors";
import { uuid } from "@/lib/generators";
import { KEYS, mockStorage } from "@/lib/mock-storage";
import { hasPermission } from "@/lib/permissions";
import type {
  AppNotification,
  AuditAction,
  NotificationSeverity,
  Permission,
  PosSimulatorState,
  RoleKey,
  Session,
  SimulatedErrorKey,
  SimulationState,
  User,
} from "@/types";

/** Collections persisted under their own localStorage key. */
export type CollectionKey = keyof MockDb;

const SEED_VERSION = 3;

interface SeedMeta {
  version: number;
  seededAt: string;
  paymentIds: string[];
}

export function ensureSeeded(): void {
  if (typeof window === "undefined") return;
  const meta = mockStorage.get<SeedMeta>(KEYS.seeded);
  if (meta && meta.version === SEED_VERSION) return;
  writeSeed();
}

export function writeSeed(): MockDb {
  const db = createSeedDb(new Date());
  (Object.keys(db) as CollectionKey[]).forEach((k) => mockStorage.set(k, db[k]));
  mockStorage.set(KEYS.simulation, DEFAULT_SIMULATION);
  mockStorage.set(KEYS.pos, DEFAULT_POS_STATE);
  mockStorage.set<SeedMeta>(KEYS.seeded, { version: SEED_VERSION, seededAt: new Date().toISOString(), paymentIds: db.payments.map((p) => p.id) });
  return db;
}

export function seedMeta(): SeedMeta | null {
  return mockStorage.get<SeedMeta>(KEYS.seeded);
}

export function read<K extends CollectionKey>(key: K): MockDb[K] {
  ensureSeeded();
  const v = mockStorage.get<MockDb[K]>(key);
  if (v === null) {
    const fresh = createSeedDb(new Date())[key];
    mockStorage.set(key, fresh);
    return fresh;
  }
  return v;
}

export function write<K extends CollectionKey>(key: K, value: MockDb[K]): void {
  mockStorage.set(key, value);
}

type WithId = { id: string };
type ArrayKeys = { [K in CollectionKey]: MockDb[K] extends WithId[] ? K : never }[CollectionKey];

export function findById<K extends ArrayKeys>(key: K, id: string | undefined): MockDb[K][number] | null {
  if (!id) return null;
  return ((read(key) as WithId[]).find((r) => r.id === id) as MockDb[K][number]) ?? null;
}

export function mustFind<K extends ArrayKeys>(key: K, id: string | undefined, label = "Record"): MockDb[K][number] {
  const rec = findById(key, id);
  if (!rec) throw new ServiceError("not_found", `${label} was not found.`);
  return rec;
}

export function upsert<K extends ArrayKeys>(key: K, record: MockDb[K][number]): MockDb[K][number] {
  const all = read(key) as WithId[];
  const i = all.findIndex((r) => r.id === (record as WithId).id);
  if (i >= 0) all[i] = record as WithId;
  else all.unshift(record as WithId);
  write(key, all as MockDb[K]);
  return record;
}

export function patch<K extends ArrayKeys>(key: K, id: string, changes: Partial<MockDb[K][number]>): MockDb[K][number] {
  const rec = mustFind(key, id);
  const next = { ...rec, ...changes, updatedAt: new Date().toISOString() } as MockDb[K][number];
  return upsert(key, next);
}

export function nowIso() {
  return new Date().toISOString();
}

// ── Session / actor ─────────────────────────────────────────────────────────

export function getSession(): Session | null {
  return mockStorage.get<Session>(KEYS.session);
}

export function currentUser(): User | null {
  const s = getSession();
  if (!s) return null;
  return read("users").find((u) => u.id === s.userId) ?? null;
}

export function currentRole(): RoleKey | null {
  return getSession()?.activeRole ?? null;
}

/** The signed-in user, with the QA role override applied. */
export function actor(): User {
  const u = currentUser();
  if (!u) throw new ServiceError("auth", "Your session has ended. Please sign in again.");
  return { ...u, role: currentRole() ?? u.role };
}

export function can(permission: Permission): boolean {
  const role = currentRole();
  if (!role) return false;
  return hasPermission(read("permissions"), role, permission);
}

/** Mocked server-side permission check — blocks direct URL / API misuse. */
export function requirePermission(permission: Permission, action = "perform this action") {
  if (!can(permission)) throw new ServiceError("forbidden", `Your role is not allowed to ${action}.`);
}

export function actorName(): string {
  const a = actor();
  return `${a.firstName} ${a.lastName}`;
}

// ── Audit & notifications ───────────────────────────────────────────────────

export function audit(action: AuditAction, entity: string, description: string, record?: { id?: string; label?: string }) {
  let who: Pick<User, "id" | "firstName" | "lastName" | "role">;
  try {
    who = actor();
  } catch {
    who = { id: "system", firstName: "System", lastName: "", role: "super_admin" };
  }
  const list = read("audit");
  list.unshift(auditEvent(who, action, entity, description, nowIso(), record));
  write("audit", list.slice(0, 2000));
}

export function notify(title: string, message: string, severity: NotificationSeverity = "info", link?: string) {
  const list = read("notifications");
  const n: AppNotification = { id: uuid(), title, message, severity, link, read: false, createdAt: nowIso() };
  list.unshift(n);
  write("notifications", list.slice(0, 200));
}

// ── Simulation (network, armed errors, POS) ────────────────────────────────

export function getSimulation(): SimulationState {
  return mockStorage.get<SimulationState>(KEYS.simulation) ?? DEFAULT_SIMULATION;
}

export function setSimulation(changes: Partial<SimulationState>) {
  mockStorage.set(KEYS.simulation, { ...getSimulation(), ...changes });
}

export function getPosState(): PosSimulatorState {
  return mockStorage.get<PosSimulatorState>(KEYS.pos) ?? DEFAULT_POS_STATE;
}

export function setPosState(changes: Partial<PosSimulatorState>) {
  mockStorage.set(KEYS.pos, { ...getPosState(), ...changes });
}

/** Returns true (and disarms it) when Demo Tools armed this one-shot error. */
export function consumeError(key: SimulatedErrorKey): boolean {
  const sim = getSimulation();
  if (!sim.armedErrors.includes(key)) return false;
  setSimulation({ armedErrors: sim.armedErrors.filter((k) => k !== key) });
  return true;
}

/** Generic network failure simulation, used by every mutating service call. */
export function simulateNetwork() {
  if (consumeError("network_error")) {
    throw new ServiceError("network", "Network error — the request could not reach the RTA server. Your data is safe; try again.");
  }
}

export function requireOnline(what = "Payments") {
  if (getSimulation().network === "offline") {
    throw new ServiceError("network", `${what} require an active connection.`);
  }
}
