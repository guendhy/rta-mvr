import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { emptyCounters } from "@/lib/generators";
import { APPLICATION_SPECS } from "./applications";
import { auditEvent } from "./audit-logs";
import { buildApplication, type MockDb } from "./builder";
import { DEFAULT_DOCUMENT_RULES } from "@/config/document-requirements";
import { SEED_FEE_RULES } from "@/config/fee-rules";
import { SEED_VEHICLES } from "./vehicles";
import { buildNotifications } from "./notifications";
import { SEED_CENTERS, SEED_OFFICES } from "./offices";
import { SEED_OWNERS } from "./owners";
import { buildPlates } from "./plates";
import { DEFAULT_SETTINGS } from "./settings";
import { SEED_TERMINALS } from "./terminals";
import { SEED_USERS } from "./users";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Builds the complete first-run dataset relative to `now`, so "today" KPIs always have data. */
export function createSeedDb(now = new Date()): MockDb {
  const plateDate = new Date(now.getTime() - 420 * 86_400_000).toISOString().slice(0, 10);
  const db: MockDb = {
    users: clone(SEED_USERS),
    permissions: clone(DEFAULT_PERMISSIONS),
    owners: clone(SEED_OWNERS),
    vehicles: clone(SEED_VEHICLES),
    applications: [],
    inspections: [],
    insurance: [],
    feeRules: clone(SEED_FEE_RULES),
    documentRules: clone(DEFAULT_DOCUMENT_RULES),
    payments: [],
    plates: buildPlates(plateDate),
    audit: [],
    notifications: buildNotifications(now),
    terminals: clone(SEED_TERMINALS).map((t) => ({ ...t, lastConnectedAt: t.status === "online" ? now.toISOString() : new Date(now.getTime() - 14 * 60_000).toISOString() })),
    offices: clone(SEED_OFFICES),
    centers: clone(SEED_CENTERS),
    settings: clone(DEFAULT_SETTINGS),
    counters: emptyCounters(),
  };

  const plateOfficer = db.users.find((u) => u.role === "plate_officer")!;
  db.audit.push(auditEvent(plateOfficer, "plates_received", "Plate", `${db.plates.length} plates received into inventory across private, commercial, PMV, taxi, government, diplomatic, motorcycle, trailer, emergency and special series`, `${plateDate}T09:00:00.000Z`));

  const built: string[] = [];
  APPLICATION_SPECS.forEach((spec) => {
    const at = new Date(now.getTime() - spec.daysAgo * 86_400_000);
    const previousApplicationId = spec.renews ? built[spec.renews - 1] : undefined;
    const app = buildApplication(db, { ...spec, at, previousApplicationId }, now);
    built.push(app.id);
  });

  // Recent sign-ins so the Users page and audit log have activity.
  db.users.forEach((u, i) => {
    if (u.status !== "active") return;
    const at = new Date(now.getTime() - (i + 1) * 47 * 60_000).toISOString();
    u.lastLoginAt = at;
    db.audit.push(auditEvent(u, "login", "Session", `${u.firstName} ${u.lastName} signed in`, at));
  });

  db.audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return db;
}
