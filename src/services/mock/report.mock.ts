import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { REPORT_ALIASES, REPORT_CATALOG } from "@/data/mock/reports";
import { AUDIT_ACTION_LABELS } from "@/data/mock/audit-logs";
import {
  DEFAULT_EXPIRING_SOON_DAYS,
  INSPECTION_STATUS,
  PAYMENT_STATUS,
  PLATE_STATUS,
  REGISTRATION_STATUS,
  VEHICLE_STATUS,
  vehicleRegistrationState,
  type VehicleRegistrationState,
} from "@/config/statuses";
import { getVehicleType, VEHICLE_REPORT_BUCKETS, vehicleTypeLabel, type VehicleReportBucket } from "@/config/vehicle-types";
import { getTransactionType, TRANSACTION_BUCKETS, TRANSACTION_TYPES, transactionLabel, type TransactionTypeDef } from "@/config/transaction-types";
import { PAYMENT_CHANNELS, PAYMENT_METHOD_LABELS } from "@/config/payment-channels";
import { PLATE_CATEGORIES, plateCategoryLabel, vehicleUsageLabel } from "@/config/vehicle-usage";
import { PROVINCE_NAMES } from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { mockDelay } from "@/lib/mock-delay";
import type { ReportService } from "../interfaces";
import type {
  CountDatum,
  DashboardStats,
  Inspection,
  Office,
  Owner,
  Payment,
  PaymentStatus,
  RegistrationApplication,
  RegistrationStatus,
  ReportColumn,
  ReportFilters,
  ReportKey,
  ReportResult,
  User,
  Vehicle,
} from "@/types";
import { read } from "./core";
import { refreshExpiry } from "./vehicle.mock";

type Row = Record<string, string | number>;

/** Registry states in the order dashboards and reports show them. */
const STATE_ORDER: VehicleRegistrationState[] = ["active", "expiring_soon", "expired", "suspended", "cancelled", "unregistered", "deregistered"];
const FAILED_PAYMENT: PaymentStatus[] = ["declined", "failed", "timeout", "unknown", "cancelled"];
const UNRESOLVED_PAYMENT: PaymentStatus[] = ["processing", "unknown", "timeout"];
const CLOSED_APP: RegistrationStatus[] = ["registered", "rejected", "cancelled"];

function inRange(iso: string | undefined, f: ReportFilters) {
  if (!iso) return !f.from && !f.to;
  const d = iso.slice(0, 10);
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  return true;
}

function countBy<T>(items: T[], key: (t: T) => string) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

function sumBy<T>(items: T[], key: (t: T) => string, val: (t: T) => number) {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + val(i));
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

const pct = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 1000) / 10}%` : "—");
const bucketOf = (type: string | undefined): VehicleReportBucket => getVehicleType(type).reportBucket;
const txnBucket = (type: string | undefined): TransactionTypeDef["bucket"] => getTransactionType(type).bucket;

/**
 * One snapshot of the mock database per call, indexed by id. `findById` re-reads
 * localStorage on every call, so reports join through these maps instead.
 */
function snapshot() {
  const settings = read("settings");
  const soonDays = settings?.registration?.expiringSoonDays ?? DEFAULT_EXPIRING_SOON_DAYS;
  const now = Date.now();
  const vehicles = refreshExpiry(read("vehicles"));
  const applications = read("applications");
  const payments = read("payments");
  const index = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const vehicleById = index(vehicles);
  const appById = index(applications);
  const ownerById = index<Owner>(read("owners"));
  const officeById = index<Office>(read("offices"));
  const userById = index<User>(read("users"));
  const stateCache = new Map<string, VehicleRegistrationState>();
  const state = (v: Vehicle) => {
    let s = stateCache.get(v.id);
    if (!s) {
      s = vehicleRegistrationState(v, now, soonDays);
      stateCache.set(v.id, s);
    }
    return s;
  };
  const appVehicle = (a: RegistrationApplication | undefined) => (a?.vehicleId ? vehicleById.get(a.vehicleId) : undefined);
  const appVehicleType = (a: RegistrationApplication | undefined) => appVehicle(a)?.vehicleType ?? a?.draft.classification?.vehicleType;
  const appProvince = (a: RegistrationApplication | undefined) => appVehicle(a)?.provinceOfOperation ?? a?.draft.vehicle?.provinceOfOperation ?? "";
  const officeName = (id?: string) => (id ? officeById.get(id)?.name : undefined) ?? "—";
  const userName = (id?: string) => {
    const u = id ? userById.get(id) : undefined;
    return u ? `${u.firstName} ${u.lastName}` : "—";
  };
  const successfulPaymentFor = new Map<string, Payment>();
  for (const p of payments) if (p.status === "successful") successfulPaymentFor.set(p.applicationId, p);
  return { now, soonDays, vehicles, applications, payments, vehicleById, appById, ownerById, officeById, userById, state, appVehicle, appVehicleType, appProvince, officeName, userName, successfulPaymentFor };
}
type Snapshot = ReturnType<typeof snapshot>;

function bucketCounts<T>(items: T[], typeOf: (t: T) => string | undefined): CountDatum[] {
  const m = new Map<VehicleReportBucket, number>();
  for (const i of items) {
    const b = bucketOf(typeOf(i));
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return VEHICLE_REPORT_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: m.get(b.key) ?? 0 }));
}

function transactionCounts(apps: RegistrationApplication[]): CountDatum[] {
  return TRANSACTION_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: apps.filter((a) => txnBucket(a.type) === b.key).length }));
}

// FUTURE: Replace with SQL views / RPC functions in Supabase.
export class MockReportService implements ReportService {
  async dashboard(): Promise<DashboardStats> {
    await mockDelay(300, 700);
    const db = snapshot();
    const apps = db.applications.filter((a) => a.status !== "cancelled");
    const nowDate = new Date(db.now);
    const today = (iso?: string) => !!iso && isSameDay(new Date(iso), nowDate);
    const ok = db.payments.filter((p) => p.status === "successful");
    const okToday = ok.filter((p) => today(p.completedAt));
    const status = (s: RegistrationStatus[]) => apps.filter((a) => s.includes(a.status)).length;
    const last30 = ok.filter((p) => differenceInCalendarDays(nowDate, new Date(p.completedAt ?? p.createdAt)) < 30);
    const appsToday = apps.filter((a) => today(a.createdAt));
    const apps30 = apps.filter((a) => differenceInCalendarDays(nowDate, new Date(a.createdAt)) < 30);
    const byState = new Map<VehicleRegistrationState, number>();
    for (const v of db.vehicles) byState.set(db.state(v), (byState.get(db.state(v)) ?? 0) + 1);
    const stateCount = (s: VehicleRegistrationState) => byState.get(s) ?? 0;
    const current = db.vehicles.filter((v) => ["active", "expiring_soon"].includes(db.state(v)));

    // Failed attempts still blocking an unpaid application, plus attempts awaiting a result.
    const failedOrPendingPayments = db.payments.filter((p) => {
      if (UNRESOLVED_PAYMENT.includes(p.status)) return true;
      if (p.status !== "declined" && p.status !== "failed") return false;
      const app = db.appById.get(p.applicationId);
      return !!app && app.status === "payment_required" && !db.successfulPaymentFor.has(app.id);
    }).length;

    const daily = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(startOfDay(nowDate), 6 - i);
      return { label: i === 6 ? "Today" : format(day, "EEE d"), value: apps.filter((a) => isSameDay(new Date(a.createdAt), day)).length };
    });
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const start = startOfWeek(subWeeks(nowDate, 7 - i), { weekStartsOn: 1 });
      const end = addDays(start, 7);
      return { label: i === 7 ? "This wk" : format(start, "d MMM"), value: apps.filter((a) => new Date(a.createdAt) >= start && new Date(a.createdAt) < end).length };
    });
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const start = startOfMonth(subMonths(nowDate, 11 - i));
      const end = startOfMonth(subMonths(nowDate, 10 - i));
      return { label: format(start, "MMM"), value: apps.filter((a) => new Date(a.createdAt) >= start && new Date(a.createdAt) < end).length };
    });

    return {
      totalVehicles: db.vehicles.length,
      activeRegistrations: stateCount("active") + stateCount("expiring_soon"),
      expiringRegistrations: stateCount("expiring_soon"),
      expiredRegistrations: stateCount("expired"),
      newToday: appsToday.filter((a) => txnBucket(a.type) === "new").length,
      renewalsToday: appsToday.filter((a) => txnBucket(a.type) === "renewal").length,
      transfersToday: appsToday.filter((a) => txnBucket(a.type) === "transfer").length,
      failedOrPendingPayments,
      vehicleTypeDistribution: bucketCounts(db.vehicles, (v) => v.vehicleType),
      activeVehicleTypeDistribution: bucketCounts(current, (v) => v.vehicleType),
      registrationStatusDistribution: STATE_ORDER.map((s) => ({ key: s, label: VEHICLE_STATUS[s].label, count: stateCount(s) })),
      transactionTypeDistribution: transactionCounts(apps30),
      transactionTypeDistributionToday: transactionCounts(appsToday),
      collectionsToday: PAYMENT_CHANNELS.map((c) => {
        const list = okToday.filter((p) => p.method === c.method);
        return { method: c.method, label: c.label, amount: list.reduce((s, p) => s + p.amount, 0), count: list.length };
      }),
      expiringSoonDays: db.soonDays,
      registrationsToday: appsToday.length,
      pendingApplications: status(["pending", "returned"]),
      awaitingInspection: status(["for_inspection"]),
      awaitingPayment: status(["payment_required"]),
      awaitingApproval: status(["for_approval"]),
      awaitingPlate: status(["approved"]),
      completedToday: apps.filter((a) => a.status === "registered" && today(a.completedAt)).length,
      revenueToday: okToday.reduce((s, p) => s + p.amount, 0),
      paymentsToday: okToday.length,
      failedInspections: status(["inspection_failed"]),
      availablePlates: read("plates").filter((p) => p.status === "available").length,
      revenueByMethod: PAYMENT_CHANNELS.map((c) => ({ method: c.method, label: c.label, amount: last30.filter((p) => p.method === c.method).reduce((s, p) => s + p.amount, 0) })),
      statusDistribution: [
        { status: "draft", label: "Draft", count: status(["draft"]) },
        { status: "pending", label: "Verification", count: status(["pending", "returned"]) },
        { status: "for_inspection", label: "Inspection", count: status(["for_inspection", "inspection_failed"]) },
        { status: "for_insurance_verification", label: "Insurance", count: status(["for_insurance_verification"]) },
        { status: "for_assessment", label: "Assessment", count: status(["for_assessment"]) },
        { status: "payment_required", label: "Payment", count: status(["payment_required"]) },
        { status: "for_approval", label: "Approval", count: status(["for_approval", "approved"]) },
        { status: "registered", label: "Completed", count: status(["registered"]) },
      ],
      transactions: { daily, weekly, monthly },
    };
  }

  async run(requested: ReportKey, f: ReportFilters): Promise<ReportResult> {
    await mockDelay(300, 800);
    const key = REPORT_ALIASES[requested] ?? requested;
    const meta = REPORT_CATALOG.find((r) => r.key === key) ?? REPORT_CATALOG[0];
    const base = { key: requested, title: meta.title, description: meta.description };
    const db = snapshot();
    const handler = HANDLERS[key];
    return { ...base, ...handler(db, f, key) };
  }
}

type Body = Omit<ReportResult, "key" | "title" | "description">;
type Handler = (db: Snapshot, f: ReportFilters, key: ReportKey) => Body;

// ── Shared filter predicates ────────────────────────────────────────────────

const typeOk = (f: ReportFilters, type: string | undefined) => !f.vehicleType || type === f.vehicleType;
const provinceOk = (f: ReportFilters, province: string | undefined) => !f.province || province === f.province;
const txnOk = (f: ReportFilters, type: string | undefined) => !f.transactionType || type === f.transactionType;

function vehicleFilter(db: Snapshot, f: ReportFilters, dateOf: (v: Vehicle) => string | undefined) {
  return (v: Vehicle) =>
    typeOk(f, v.vehicleType) && provinceOk(f, v.provinceOfOperation) && (!f.officeId || v.officeId === f.officeId) &&
    (!f.registrationStatus || db.state(v) === f.registrationStatus) && inRange(dateOf(v), f);
}

function appFilter(db: Snapshot, f: ReportFilters) {
  return (a: RegistrationApplication | undefined) =>
    !!a && typeOk(f, db.appVehicleType(a)) && provinceOk(f, db.appProvince(a)) && txnOk(f, a.type);
}

function paymentList(db: Snapshot, f: ReportFilters) {
  const appOk = appFilter(db, f);
  return db.payments.filter((p) =>
    inRange(p.completedAt ?? p.createdAt, f) && appOk(db.appById.get(p.applicationId)) && (!f.officeId || p.officeId === f.officeId) &&
    (!f.officerId || p.cashierId === f.officerId) && (!f.paymentMethod || p.method === f.paymentMethod));
}

// ── Row builders ────────────────────────────────────────────────────────────

const VEHICLE_COLUMNS: ReportColumn[] = [
  { key: "registration", label: "Registration", mono: true }, { key: "plate", label: "Plate", mono: true }, { key: "vehicle", label: "Vehicle" },
  { key: "type", label: "Vehicle type" }, { key: "usage", label: "Use" }, { key: "owner", label: "Owner" }, { key: "province", label: "Province" },
  { key: "office", label: "Office" }, { key: "status", label: "Status" }, { key: "expiry", label: "Expiry" },
];

function vehicleRow(db: Snapshot, v: Vehicle): Row {
  const owner = db.ownerById.get(v.ownerId);
  const days = v.registrationExpiry ? differenceInCalendarDays(new Date(v.registrationExpiry), new Date(db.now)) : "";
  return {
    registration: v.registrationNumber ?? "—", plate: v.plateNumber ?? "—", vehicle: vehicleLabel(v), type: vehicleTypeLabel(v.vehicleType),
    usage: vehicleUsageLabel(v.vehicleUsage), owner: fullName(owner), mobile: owner?.mobile ?? "", province: v.provinceOfOperation,
    office: db.officeName(v.officeId), status: VEHICLE_STATUS[db.state(v)].label, expiry: formatDate(v.registrationExpiry), days,
  };
}

const APP_COLUMNS: ReportColumn[] = [
  { key: "reference", label: "Reference", mono: true }, { key: "transaction", label: "Transaction" }, { key: "owner", label: "Owner" },
  { key: "vehicle", label: "Vehicle" }, { key: "type", label: "Vehicle type" }, { key: "province", label: "Province" }, { key: "office", label: "Office" },
  { key: "status", label: "Status" }, { key: "amount", label: "Amount", align: "right", money: true }, { key: "officer", label: "Officer" }, { key: "created", label: "Started" },
];

function appAmount(db: Snapshot, a: RegistrationApplication) {
  return db.successfulPaymentFor.get(a.id)?.amount ?? a.assessment?.total;
}

function appRow(db: Snapshot, a: RegistrationApplication): Row {
  const v = db.appVehicle(a);
  return {
    reference: a.transactionNumber, transaction: transactionLabel(a.type, true), owner: fullName(a.ownerId ? db.ownerById.get(a.ownerId) : undefined),
    vehicle: v ? vehicleLabel(v) : vehicleLabel(a.draft.vehicle), type: vehicleTypeLabel(db.appVehicleType(a)), province: db.appProvince(a) || "—",
    office: db.officeName(a.officeId), status: REGISTRATION_STATUS[a.status].label, amount: appAmount(db, a) ?? "", officer: a.createdByName,
    created: formatDateTime(a.createdAt),
  };
}

function paymentRows(db: Snapshot, payments: Payment[]): Row[] {
  return payments.map((p) => {
    const app = db.appById.get(p.applicationId);
    return {
      date: formatDateTime(p.completedAt ?? p.createdAt), reference: p.reference, receipt: p.receiptNumber ?? "—",
      transaction: app?.transactionNumber ?? "—", txnType: transactionLabel(app?.type, true), owner: fullName(app?.ownerId ? db.ownerById.get(app.ownerId) : undefined),
      type: vehicleTypeLabel(db.appVehicleType(app)), method: PAYMENT_METHOD_LABELS[p.method] ?? p.method, terminal: p.terminalId ?? "—",
      status: PAYMENT_STATUS[p.status].label, cashier: p.cashierName, office: db.officeName(p.officeId), amount: p.amount,
      reason: p.failureReason ?? "", tendered: p.amountTendered ?? "", change: p.change ?? "",
    };
  });
}

function bucketChart<T>(items: T[], typeOf: (t: T) => string | undefined) {
  return bucketCounts(items, typeOf).filter((d) => d.count > 0).map((d) => ({ name: d.label, value: d.count }));
}

// ── Handlers ────────────────────────────────────────────────────────────────

const registeredVehicles: Handler = (db, f) => {
  const list = db.vehicles.filter(vehicleFilter(db, f, (v) => v.registrationDate)).sort((a, b) => (a.registrationNumber ?? "~").localeCompare(b.registrationNumber ?? "~"));
  const n = (s: VehicleRegistrationState[]) => list.filter((v) => s.includes(db.state(v))).length;
  return {
    columns: VEHICLE_COLUMNS,
    rows: list.map((v) => vehicleRow(db, v)),
    summary: [
      { label: "Vehicles", value: String(list.length) },
      { label: "Active", value: String(n(["active", "expiring_soon"])) },
      { label: "Expiring soon", value: String(n(["expiring_soon"])) },
      { label: "Expired", value: String(n(["expired"])) },
    ],
    chart: { type: "pie", data: STATE_ORDER.map((s) => ({ name: VEHICLE_STATUS[s].label, value: n([s]) })).filter((d) => d.value > 0), valueFormat: "count" },
    statusOptions: [],
  };
};

function stateBreakdownRow(db: Snapshot, list: Vehicle[]) {
  const n = (s: VehicleRegistrationState[]) => list.filter((v) => s.includes(db.state(v))).length;
  return { active: n(["active"]), expiring: n(["expiring_soon"]), expired: n(["expired"]), closed: n(["suspended", "cancelled", "deregistered"]), pending: n(["unregistered"]), total: list.length };
}

const STATE_COLUMNS: ReportColumn[] = [
  { key: "active", label: "Active", align: "right" }, { key: "expiring", label: "Expiring soon", align: "right" }, { key: "expired", label: "Expired", align: "right" },
  { key: "closed", label: "Suspended / cancelled", align: "right" }, { key: "pending", label: "Pending", align: "right" }, { key: "total", label: "Total", align: "right" },
];

const byVehicleType: Handler = (db, f) => {
  const list = db.vehicles.filter(vehicleFilter(db, f, (v) => v.registrationDate));
  const rows = VEHICLE_REPORT_BUCKETS.map((b) => {
    const inBucket = list.filter((v) => bucketOf(v.vehicleType) === b.key);
    const types = [...new Set(inBucket.map((v) => vehicleTypeLabel(v.vehicleType)))].sort().join(", ");
    return { bucket: b.label, types: types || "—", ...stateBreakdownRow(db, inBucket), share: pct(inBucket.length, list.length) };
  }).filter((r) => r.total > 0);
  const top = [...rows].sort((a, b) => b.total - a.total)[0];
  return {
    columns: [{ key: "bucket", label: "Vehicle type" }, { key: "types", label: "Includes" }, ...STATE_COLUMNS, { key: "share", label: "Share", align: "right" }],
    rows,
    summary: [
      { label: "Vehicles", value: String(list.length) },
      { label: "Vehicle types", value: String(new Set(list.map((v) => v.vehicleType)).size) },
      { label: "Largest group", value: top ? top.bucket : "—" },
      { label: "Active", value: String(rows.reduce((s, r) => s + r.active + r.expiring, 0)) },
    ],
    chart: { type: "bar", data: rows.map((r) => ({ name: r.bucket, value: r.total })), valueFormat: "count" },
    statusOptions: [],
  };
};

const byProvince: Handler = (db, f) => {
  const list = db.vehicles.filter(vehicleFilter(db, { ...f, province: undefined }, (v) => v.registrationDate));
  const provinces = [...PROVINCE_NAMES, ...new Set(list.map((v) => v.provinceOfOperation).filter((p) => !PROVINCE_NAMES.includes(p)))];
  const rows = provinces
    .map((province) => ({ province, ...stateBreakdownRow(db, list.filter((v) => v.provinceOfOperation === province)) }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  return {
    columns: [{ key: "province", label: "Province" }, ...STATE_COLUMNS],
    rows,
    summary: [
      { label: "Vehicles", value: String(list.length) },
      { label: "Provinces", value: String(rows.length) },
      { label: "Active", value: String(rows.reduce((s, r) => s + r.active + r.expiring, 0)) },
      { label: "Expired", value: String(rows.reduce((s, r) => s + r.expired, 0)) },
    ],
    chart: { type: "bar", data: rows.map((r) => ({ name: r.province, value: r.total })), valueFormat: "count" },
    statusOptions: [],
  };
};

const expiryColumns = (daysLabel: string, extra: ReportColumn[] = []): ReportColumn[] => [
  { key: "plate", label: "Plate", mono: true }, { key: "registration", label: "Registration", mono: true }, { key: "owner", label: "Owner" },
  { key: "mobile", label: "Mobile", mono: true }, { key: "vehicle", label: "Vehicle" }, { key: "type", label: "Vehicle type" }, { key: "province", label: "Province" },
  { key: "expiry", label: "Expiry" }, { key: "days", label: daysLabel, align: "right" }, ...extra,
];

const expired: Handler = (db, f) => {
  const list = db.vehicles
    .filter((v) => db.state(v) === "expired" && vehicleFilter(db, { ...f, registrationStatus: undefined }, (x) => x.registrationExpiry)(v))
    .sort((a, b) => (a.registrationExpiry ?? "").localeCompare(b.registrationExpiry ?? ""));
  const rows: Row[] = list.map((v) => {
    const r = vehicleRow(db, v);
    return { ...r, days: typeof r.days === "number" ? -r.days : "" };
  });
  const overdue = (min: number, max = Infinity) => rows.filter((r) => typeof r.days === "number" && r.days >= min && r.days <= max).length;
  return {
    columns: expiryColumns("Days overdue"),
    rows,
    summary: [
      { label: "Expired registrations", value: String(list.length) },
      { label: "≤ 30 days overdue", value: String(overdue(0, 30)) },
      { label: "31–90 days", value: String(overdue(31, 90)) },
      { label: "> 90 days", value: String(overdue(91)) },
    ],
    chart: { type: "bar", data: bucketChart(list, (v) => v.vehicleType), valueFormat: "count" },
    statusOptions: [],
  };
};

const dueForRenewal: Handler = (db, f) => {
  const list = db.vehicles
    .filter((v) => db.state(v) === "expiring_soon" && vehicleFilter(db, { ...f, registrationStatus: undefined }, (x) => x.registrationExpiry)(v))
    .sort((a, b) => (a.registrationExpiry ?? "").localeCompare(b.registrationExpiry ?? ""));
  const renewing = new Set(db.applications.filter((a) => a.type === "renewal" && !CLOSED_APP.includes(a.status) && a.vehicleId).map((a) => a.vehicleId!));
  const rows: Row[] = list.map((v) => ({ ...vehicleRow(db, v), renewal: renewing.has(v.id) ? "Started" : "Not started" }));
  const within = (d: number) => rows.filter((r) => typeof r.days === "number" && r.days <= d).length;
  return {
    columns: expiryColumns("Days left", [{ key: "renewal", label: "Renewal" }]),
    rows,
    summary: [
      { label: `Due within ${db.soonDays} days`, value: String(list.length) },
      { label: "Within 7 days", value: String(within(7)) },
      { label: "Within 14 days", value: String(within(14)) },
      { label: "Renewal started", value: String(rows.filter((r) => r.renewal === "Started").length) },
    ],
    chart: { type: "bar", data: bucketChart(list, (v) => v.vehicleType), valueFormat: "count" },
    statusOptions: [],
  };
};

const transactions: Handler = (db, f, key) => {
  const bucket = key === "new_registrations" ? "new" : key === "renewals" ? "renewal" : key === "transfers" ? "transfer" : null;
  const appOk = appFilter(db, f);
  const list = db.applications
    .filter((a) => (!bucket || txnBucket(a.type) === bucket) && appOk(a) && inRange(a.createdAt, f) && (!f.officeId || a.officeId === f.officeId) &&
      (!f.officerId || a.createdBy === f.officerId) && (!f.status || REGISTRATION_STATUS[a.status].label === f.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const collected = list.reduce((s, a) => s + (db.successfulPaymentFor.get(a.id)?.amount ?? 0), 0);
  return {
    columns: APP_COLUMNS,
    rows: list.map((a) => appRow(db, a)),
    summary: [
      { label: "Transactions", value: String(list.length) },
      { label: "Completed", value: String(list.filter((a) => a.status === "registered").length) },
      { label: "In progress", value: String(list.filter((a) => !CLOSED_APP.includes(a.status)).length) },
      { label: "Collected", value: formatMoney(collected) },
    ],
    chart: bucket
      ? { type: "bar", data: bucketChart(list, (a) => db.appVehicleType(a)), valueFormat: "count" }
      : { type: "bar", data: TRANSACTION_BUCKETS.map((b) => ({ name: b.label, value: list.filter((a) => txnBucket(a.type) === b.key).length })).filter((d) => d.value > 0), valueFormat: "count" },
    statusOptions: Object.values(REGISTRATION_STATUS).map((s) => s.label),
  };
};

const inspections: Handler = (db, f, key) => {
  const appOk = appFilter(db, f);
  const centers = new Map(read("centers").map((c) => [c.id, c.name]));
  let list: Inspection[] = read("inspections").filter((i) => {
    const app = db.appById.get(i.applicationId);
    return inRange(i.submittedAt ?? i.inspectionDate ?? i.createdAt, f) && !!app && appOk(app) &&
      (!f.officeId || app.officeId === f.officeId) && (!f.officerId || i.inspectorId === f.officerId) &&
      (!f.status || INSPECTION_STATUS[i.status].label === f.status);
  });
  if (key === "failed_inspections") list = list.filter((i) => i.status === "failed" || i.status === "reinspection_required");
  list.sort((a, b) => (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt));
  const decided = list.filter((i) => ["passed", "failed", "conditional"].includes(i.status));
  const passed = list.filter((i) => i.status === "passed" || i.status === "conditional").length;
  const failedKey = key === "failed_inspections";
  return {
    columns: [
      { key: "date", label: "Date" }, { key: "reference", label: "Inspection", mono: true }, { key: "transaction", label: "Transaction", mono: true },
      { key: "vehicle", label: "Vehicle" }, { key: "type", label: "Vehicle type" }, { key: "center", label: "Centre" }, { key: "inspector", label: "Inspector" },
      { key: "attempt", label: "Attempt", align: "right" }, { key: "status", label: "Result" },
      failedKey ? { key: "reason", label: "Failure reason" } : { key: "certificate", label: "Certificate", mono: true },
    ],
    rows: list.map((i) => {
      const v = db.vehicleById.get(i.vehicleId);
      return {
        date: formatDate(i.submittedAt ?? i.inspectionDate), reference: i.reference ?? "—", transaction: db.appById.get(i.applicationId)?.transactionNumber ?? "—",
        vehicle: vehicleLabel(v), type: vehicleTypeLabel(v?.vehicleType), center: (i.centerId ? centers.get(i.centerId) : undefined) ?? "—",
        inspector: db.userName(i.inspectorId), attempt: i.attempt, status: INSPECTION_STATUS[i.status].label, certificate: i.certificateNumber ?? "—",
        reason: i.failureReason ?? (i.defects?.length ? i.defects.map((d) => d.label).join("; ") : "—"),
      };
    }),
    summary: [
      { label: "Inspections", value: String(list.length) },
      { label: "Passed / conditional", value: String(passed) },
      { label: "Failed", value: String(list.filter((i) => i.status === "failed").length) },
      { label: "Pass rate", value: decided.length ? pct(passed, decided.length) : "—" },
    ],
    chart: failedKey
      ? { type: "bar", data: countBy(list, (i) => i.failureReason ?? "Unspecified"), valueFormat: "count" }
      : { type: "pie", data: countBy(list, (i) => INSPECTION_STATUS[i.status].label), valueFormat: "count" },
    statusOptions: failedKey ? [] : Object.values(INSPECTION_STATUS).map((s) => s.label),
  };
};

const PAYMENT_COLUMNS: Partial<Record<ReportKey, ReportColumn[]>> = {
  cash_collection: [
    { key: "date", label: "Date" }, { key: "receipt", label: "Receipt", mono: true }, { key: "transaction", label: "Transaction", mono: true }, { key: "txnType", label: "Type" },
    { key: "owner", label: "Owner" }, { key: "cashier", label: "Cashier" }, { key: "tendered", label: "Tendered", align: "right", money: true },
    { key: "change", label: "Change", align: "right", money: true }, { key: "amount", label: "Amount", align: "right", money: true },
  ],
  pos_transactions: [
    { key: "date", label: "Date" }, { key: "reference", label: "Reference", mono: true }, { key: "terminal", label: "Terminal", mono: true },
    { key: "transaction", label: "Transaction", mono: true }, { key: "txnType", label: "Type" }, { key: "status", label: "Status" }, { key: "reason", label: "Detail" },
    { key: "amount", label: "Amount", align: "right", money: true },
  ],
  failed_payments: [
    { key: "date", label: "Date" }, { key: "reference", label: "Reference", mono: true }, { key: "transaction", label: "Transaction", mono: true }, { key: "txnType", label: "Type" },
    { key: "type", label: "Vehicle type" }, { key: "method", label: "Method" }, { key: "status", label: "Status" }, { key: "reason", label: "Reason" },
    { key: "cashier", label: "Cashier" }, { key: "amount", label: "Amount", align: "right", money: true },
  ],
};
const DEFAULT_PAYMENT_COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" }, { key: "reference", label: "Reference", mono: true }, { key: "receipt", label: "Receipt", mono: true },
  { key: "transaction", label: "Transaction", mono: true }, { key: "txnType", label: "Type" }, { key: "owner", label: "Owner" }, { key: "type", label: "Vehicle type" },
  { key: "method", label: "Method" }, { key: "status", label: "Status" }, { key: "office", label: "Office" }, { key: "amount", label: "Amount", align: "right", money: true },
];

const paymentReport: Handler = (db, f, key) => {
  let pays = paymentList(db, f).filter((p) => !f.status || PAYMENT_STATUS[p.status].label === f.status);
  if (key === "revenue_collection") pays = pays.filter((p) => p.status === "successful");
  if (key === "cash_collection") pays = pays.filter((p) => p.method === "cash" && p.status === "successful");
  if (key === "pos_transactions") pays = pays.filter((p) => p.method === "pos");
  if (key === "failed_payments") pays = pays.filter((p) => FAILED_PAYMENT.includes(p.status));
  pays.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ok = pays.filter((p) => p.status === "successful");
  const total = ok.reduce((s, p) => s + p.amount, 0);
  const statusChart = key === "failed_payments" || key === "pos_transactions";
  return {
    columns: PAYMENT_COLUMNS[key] ?? DEFAULT_PAYMENT_COLUMNS,
    rows: paymentRows(db, pays),
    summary: [
      { label: key === "failed_payments" ? "Failed attempts" : "Transactions", value: String(pays.length) },
      { label: key === "failed_payments" ? "Amount not collected" : "Collected", value: formatMoney(key === "failed_payments" ? pays.reduce((s, p) => s + p.amount, 0) : total) },
      { label: "Successful", value: String(ok.length) },
      { label: "Failed / unknown", value: String(pays.filter((p) => FAILED_PAYMENT.includes(p.status)).length) },
    ],
    chart: statusChart
      ? { type: "pie", data: countBy(pays, (p) => PAYMENT_STATUS[p.status].label), valueFormat: "count" }
      : { type: "pie", data: sumBy(ok, (p) => PAYMENT_METHOD_LABELS[p.method] ?? p.method, (p) => p.amount), valueFormat: "money" },
    statusOptions: key === "revenue_collection" || key === "cash_collection" ? [] : Object.values(PAYMENT_STATUS).map((s) => s.label),
  };
};

const revenueByTransactionType: Handler = (db, f) => {
  const ok = paymentList(db, { ...f, transactionType: undefined }).filter((p) => p.status === "successful");
  const rows = TRANSACTION_TYPES.map((t) => {
    const list = ok.filter((p) => db.appById.get(p.applicationId)?.type === t.key);
    const r = { transaction: t.label, bucket: TRANSACTION_BUCKETS.find((b) => b.key === t.bucket)?.label ?? t.bucket, payments: list.length, registration: 0, inspection: 0, plate: 0, transfer: 0, penalty: 0, other: 0, amount: 0 };
    for (const p of list) {
      const totals = db.appById.get(p.applicationId)?.assessment?.totals;
      r.amount += p.amount;
      // Components only when the assessment reconciles to the receipt; otherwise the whole amount is "Other".
      if (totals && Math.abs(totals.total - p.amount) < 0.005) {
        r.registration += totals.registrationFee;
        r.inspection += totals.inspectionFee;
        r.plate += totals.plateFee;
        r.transfer += totals.transferFee;
        r.penalty += totals.penalty;
        r.other += totals.serviceFee + totals.otherFees;
      } else r.other += p.amount;
    }
    return r;
  }).filter((r) => r.payments > 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const money = (key: string, label: string): ReportColumn => ({ key, label, align: "right", money: true });
  return {
    columns: [
      { key: "transaction", label: "Transaction type" }, { key: "bucket", label: "Group" }, { key: "payments", label: "Payments", align: "right" },
      money("registration", "Registration"), money("inspection", "Inspection"), money("plate", "Plate"), money("transfer", "Transfer"),
      money("penalty", "Penalties"), money("other", "Service / other"), money("amount", "Revenue"), { key: "share", label: "Share", align: "right" },
    ],
    rows: rows.map((r) => ({ ...r, share: pct(r.amount, total) })),
    summary: [
      { label: "Revenue", value: formatMoney(total) },
      { label: "Payments", value: String(ok.length) },
      { label: "Penalties", value: formatMoney(rows.reduce((s, r) => s + r.penalty, 0)) },
      { label: "Transaction types", value: String(rows.length) },
    ],
    chart: { type: "bar", data: TRANSACTION_BUCKETS.map((b) => ({ name: b.label, value: rows.filter((r) => r.bucket === b.label).reduce((s, r) => s + r.amount, 0) })).filter((d) => d.value > 0), valueFormat: "money" },
    statusOptions: [],
  };
};

const revenueByVehicleType: Handler = (db, f) => {
  const ok = paymentList(db, { ...f, vehicleType: undefined }).filter((p) => p.status === "successful");
  const total = ok.reduce((s, p) => s + p.amount, 0);
  const rows = VEHICLE_REPORT_BUCKETS.map((b) => {
    const list = ok.filter((p) => bucketOf(db.appVehicleType(db.appById.get(p.applicationId))) === b.key);
    const amount = list.reduce((s, p) => s + p.amount, 0);
    return { bucket: b.label, payments: list.length, amount, average: list.length ? Math.round((amount / list.length) * 100) / 100 : 0, share: pct(amount, total) };
  }).filter((r) => r.payments > 0);
  const top = [...rows].sort((a, b) => b.amount - a.amount)[0];
  return {
    columns: [
      { key: "bucket", label: "Vehicle type" }, { key: "payments", label: "Payments", align: "right" },
      { key: "average", label: "Average", align: "right", money: true }, { key: "amount", label: "Revenue", align: "right", money: true }, { key: "share", label: "Share", align: "right" },
    ],
    rows,
    summary: [
      { label: "Revenue", value: formatMoney(total) },
      { label: "Payments", value: String(ok.length) },
      { label: "Average payment", value: formatMoney(ok.length ? total / ok.length : 0) },
      { label: "Largest group", value: top ? top.bucket : "—" },
    ],
    chart: { type: "bar", data: rows.map((r) => ({ name: r.bucket, value: r.amount })), valueFormat: "money" },
    statusOptions: [],
  };
};

const paymentMethodBreakdown: Handler = (db, f) => {
  const pays = paymentList(db, { ...f, paymentMethod: undefined });
  const okTotal = pays.filter((p) => p.status === "successful").reduce((s, p) => s + p.amount, 0);
  const rows = PAYMENT_CHANNELS.map((c) => {
    const list = pays.filter((p) => p.method === c.method);
    const ok = list.filter((p) => p.status === "successful");
    const amount = ok.reduce((s, p) => s + p.amount, 0);
    return { method: c.label, attempts: list.length, successful: ok.length, failed: list.filter((p) => FAILED_PAYMENT.includes(p.status)).length, rate: pct(ok.length, list.length), amount, share: pct(amount, okTotal) };
  });
  const failed = rows.reduce((s, r) => s + r.failed, 0);
  return {
    columns: [
      { key: "method", label: "Payment method" }, { key: "attempts", label: "Attempts", align: "right" }, { key: "successful", label: "Successful", align: "right" },
      { key: "failed", label: "Failed", align: "right" }, { key: "rate", label: "Success rate", align: "right" }, { key: "amount", label: "Collected", align: "right", money: true },
      { key: "share", label: "Share", align: "right" },
    ],
    rows,
    summary: [
      { label: "Collected", value: formatMoney(okTotal) },
      { label: "Attempts", value: String(pays.length) },
      { label: "Failed attempts", value: String(failed) },
      { label: "Failure rate", value: pct(failed, pays.length) },
    ],
    chart: { type: "pie", data: rows.filter((r) => r.amount > 0).map((r) => ({ name: r.method, value: r.amount })), valueFormat: "money" },
    statusOptions: [],
  };
};

const plateInventory: Handler = (db, f) => {
  const list = read("plates")
    .filter((p) => (!f.officeId || p.officeId === f.officeId) && (!f.status || PLATE_STATUS[p.status].label === f.status) && inRange(p.receivedDate, f))
    .sort((a, b) => a.category.localeCompare(b.category) || a.plateNumber.localeCompare(b.plateNumber, undefined, { numeric: true }));
  return {
    columns: [
      { key: "plate", label: "Plate", mono: true }, { key: "category", label: "Category" }, { key: "office", label: "Office" }, { key: "status", label: "Status" },
      { key: "assignedTo", label: "Assigned vehicle", mono: true }, { key: "type", label: "Vehicle type" }, { key: "received", label: "Received" }, { key: "assigned", label: "Issued" },
    ],
    rows: list.map((p) => {
      const v = p.vehicleId ? db.vehicleById.get(p.vehicleId) : undefined;
      const app = p.applicationId ? db.appById.get(p.applicationId) : undefined;
      return {
        plate: p.plateNumber, category: plateCategoryLabel(p.category), office: db.officeName(p.officeId), status: PLATE_STATUS[p.status].label,
        assignedTo: v?.registrationNumber ?? app?.transactionNumber ?? "—", type: v ? vehicleTypeLabel(v.vehicleType) : "—",
        received: formatDate(p.receivedDate), assigned: formatDate(p.assignedDate),
      };
    }),
    summary: [
      { label: "Plates", value: String(list.length) },
      { label: "Available", value: String(list.filter((p) => p.status === "available").length) },
      { label: "Assigned", value: String(list.filter((p) => p.status === "assigned").length) },
      { label: "Damaged / lost", value: String(list.filter((p) => ["damaged", "lost"].includes(p.status)).length) },
    ],
    chart: { type: "bar", data: PLATE_CATEGORIES.map((c) => ({ name: c.label, value: list.filter((p) => p.category === c.value).length })).filter((d) => d.value > 0), valueFormat: "count" },
    statusOptions: Object.values(PLATE_STATUS).map((s) => s.label),
  };
};

function auditEvents(db: Snapshot, f: ReportFilters) {
  return read("audit").filter((e) => inRange(e.timestamp, f) && (!f.officerId || e.userId === f.officerId) &&
    (!f.officeId || db.userById.get(e.userId)?.officeId === f.officeId) && (!f.status || AUDIT_ACTION_LABELS[e.action] === f.status));
}

const officerActivity: Handler = (db, f) => {
  const events = auditEvents(db, f);
  const byUser = new Map<string, { name: string; role: string; total: number; registrations: number; payments: number; approvals: number; inspections: number; last: string }>();
  for (const e of events) {
    const r = byUser.get(e.userId) ?? { name: e.userName, role: e.role, total: 0, registrations: 0, payments: 0, approvals: 0, inspections: 0, last: e.timestamp };
    r.total++;
    if (e.action === "registration_created" || e.action === "renewal_created") r.registrations++;
    if (e.action === "payment_processed") r.payments++;
    if (["registration_approved", "registration_returned", "registration_rejected"].includes(e.action)) r.approvals++;
    if (e.action === "inspection_submitted") r.inspections++;
    if (e.timestamp > r.last) r.last = e.timestamp;
    byUser.set(e.userId, r);
  }
  const rows = [...byUser.values()].sort((a, b) => b.total - a.total);
  return {
    columns: [
      { key: "name", label: "Officer" }, { key: "role", label: "Role" }, { key: "registrations", label: "Transactions", align: "right" },
      { key: "inspections", label: "Inspections", align: "right" }, { key: "payments", label: "Payments", align: "right" }, { key: "approvals", label: "Decisions", align: "right" },
      { key: "total", label: "All actions", align: "right" }, { key: "last", label: "Last activity" },
    ],
    rows: rows.map((r) => ({ ...r, role: r.role.replace(/_/g, " "), last: formatDateTime(r.last) })),
    summary: [
      { label: "Officers", value: String(rows.length) },
      { label: "Actions", value: String(events.length) },
      { label: "Payments", value: String(rows.reduce((s, r) => s + r.payments, 0)) },
      { label: "Decisions", value: String(rows.reduce((s, r) => s + r.approvals, 0)) },
    ],
    chart: { type: "bar", data: rows.slice(0, 10).map((r) => ({ name: r.name, value: r.total })), valueFormat: "count" },
    statusOptions: [],
  };
};

const auditReport: Handler = (db, f) => {
  const events = auditEvents(db, f);
  return {
    columns: [
      { key: "time", label: "Date / time" }, { key: "user", label: "User" }, { key: "role", label: "Role" }, { key: "action", label: "Action" },
      { key: "entity", label: "Entity" }, { key: "record", label: "Record", mono: true }, { key: "description", label: "Description" },
    ],
    rows: events.map((e) => ({ time: formatDateTime(e.timestamp), user: e.userName, role: e.role.replace(/_/g, " "), action: AUDIT_ACTION_LABELS[e.action], entity: e.entity, record: e.recordLabel ?? "—", description: e.description })),
    summary: [
      { label: "Events", value: String(events.length) },
      { label: "Users", value: String(new Set(events.map((e) => e.userId)).size) },
      { label: "Payments", value: String(events.filter((e) => e.action === "payment_processed").length) },
      { label: "Approvals", value: String(events.filter((e) => e.action === "registration_approved").length) },
    ],
    chart: { type: "bar", data: countBy(events, (e) => AUDIT_ACTION_LABELS[e.action]).sort((a, b) => b.value - a.value).slice(0, 10), valueFormat: "count" },
    statusOptions: Object.values(AUDIT_ACTION_LABELS),
  };
};

const HANDLERS: Record<ReportKey, Handler> = {
  registered_vehicles: registeredVehicles,
  registrations_by_vehicle_type: byVehicleType,
  registrations_by_province: byProvince,
  expired_registrations: expired,
  due_for_renewal: dueForRenewal,
  registration_expiry: dueForRenewal,
  new_registrations: transactions,
  renewals: transactions,
  transfers: transactions,
  registration_summary: transactions,
  inspection_report: inspections,
  failed_inspections: inspections,
  revenue_collection: paymentReport,
  cash_collection: paymentReport,
  pos_transactions: paymentReport,
  payment_history: paymentReport,
  failed_payments: paymentReport,
  revenue_by_transaction_type: revenueByTransactionType,
  revenue_by_vehicle_type: revenueByVehicleType,
  payment_method_breakdown: paymentMethodBreakdown,
  plate_inventory: plateInventory,
  officer_activity: officerActivity,
  audit_report: auditReport,
};
