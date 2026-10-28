import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { REPORT_CATALOG } from "@/data/mock/reports";
import { AUDIT_ACTION_LABELS } from "@/data/mock/audit-logs";
import {
  INSPECTION_STATUS,
  MOTORCYCLE_STATUS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS,
  PLATE_STATUS,
  REGISTRATION_STATUS,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { mockDelay } from "@/lib/mock-delay";
import type { ReportService } from "../interfaces";
import type { DashboardStats, Payment, PaymentMethod, RegistrationStatus, ReportFilters, ReportKey, ReportResult } from "@/types";
import { findById, read } from "./core";
import { refreshExpiry } from "./motorcycle.mock";

function inRange(iso: string | undefined, f: ReportFilters) {
  if (!iso) return !f.from && !f.to;
  const d = iso.slice(0, 10);
  if (f.from && d < f.from) return false;
  if (f.to && d > f.to) return false;
  return true;
}

const officeName = (id?: string) => findById("offices", id)?.name ?? "—";
const userName = (id?: string) => {
  const u = findById("users", id);
  return u ? `${u.firstName} ${u.lastName}` : "—";
};

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

function paymentRows(payments: Payment[]) {
  return payments.map((p) => {
    const app = findById("applications", p.applicationId);
    const owner = findById("owners", app?.ownerId);
    return {
      date: formatDateTime(p.completedAt ?? p.createdAt),
      reference: p.reference,
      receipt: p.receiptNumber ?? "—",
      transaction: app?.transactionNumber ?? "—",
      owner: fullName(owner),
      method: PAYMENT_METHOD_LABELS[p.method],
      terminal: p.terminalId ?? "—",
      status: PAYMENT_STATUS[p.status].label,
      cashier: p.cashierName,
      office: officeName(p.officeId),
      amount: p.amount,
      reason: p.failureReason ?? "",
      tendered: p.amountTendered ?? "",
      change: p.change ?? "",
    };
  });
}

// FUTURE: Replace with SQL views / RPC functions in Supabase.
export class MockReportService implements ReportService {
  async dashboard(): Promise<DashboardStats> {
    await mockDelay(300, 700);
    const apps = read("applications").filter((a) => a.status !== "cancelled");
    const payments = read("payments");
    const motos = refreshExpiry(read("motorcycles"));
    const now = new Date();
    const today = (iso?: string) => !!iso && isSameDay(new Date(iso), now);
    const ok = payments.filter((p) => p.status === "successful");
    const status = (s: RegistrationStatus[]) => apps.filter((a) => s.includes(a.status)).length;
    const last30 = ok.filter((p) => differenceInCalendarDays(now, new Date(p.completedAt ?? p.createdAt)) < 30);
    const methods: PaymentMethod[] = ["pos", "cash", "online", "bank_transfer"];

    const daily = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(startOfDay(now), 6 - i);
      return { label: i === 6 ? "Today" : format(day, "EEE d"), value: apps.filter((a) => isSameDay(new Date(a.createdAt), day)).length };
    });
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const start = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 });
      const end = addDays(start, 7);
      return { label: i === 7 ? "This wk" : format(start, "d MMM"), value: apps.filter((a) => new Date(a.createdAt) >= start && new Date(a.createdAt) < end).length };
    });
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const start = startOfMonth(subMonths(now, 11 - i));
      const end = startOfMonth(subMonths(now, 10 - i));
      return { label: format(start, "MMM"), value: apps.filter((a) => new Date(a.createdAt) >= start && new Date(a.createdAt) < end).length };
    });

    return {
      registrationsToday: apps.filter((a) => today(a.createdAt)).length,
      pendingApplications: status(["pending", "returned"]),
      awaitingInspection: status(["for_inspection"]),
      awaitingPayment: status(["payment_required"]),
      awaitingApproval: status(["for_approval"]),
      awaitingPlate: status(["approved"]),
      completedToday: apps.filter((a) => a.status === "registered" && today(a.completedAt)).length,
      revenueToday: ok.filter((p) => today(p.completedAt)).reduce((s, p) => s + p.amount, 0),
      paymentsToday: ok.filter((p) => today(p.completedAt)).length,
      expiringRegistrations: motos.filter((m) => m.registrationStatus === "registered" && m.registrationExpiry && differenceInCalendarDays(new Date(m.registrationExpiry), now) <= 30).length,
      failedInspections: status(["inspection_failed"]),
      availablePlates: read("plates").filter((p) => p.status === "available").length,
      revenueByMethod: methods.map((m) => ({ method: m, label: m === "pos" ? "POS" : m === "online" ? "Online" : m === "bank_transfer" ? "Bank Transfer" : "Cash", amount: last30.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) })),
      statusDistribution: [
        { status: "draft", label: "Draft", count: status(["draft"]) },
        { status: "pending", label: "Pending", count: status(["pending", "returned"]) },
        { status: "for_inspection", label: "Inspection", count: status(["for_inspection", "inspection_failed"]) },
        { status: "for_insurance_verification", label: "Insurance", count: status(["for_insurance_verification"]) },
        { status: "for_assessment", label: "Assessment", count: status(["for_assessment"]) },
        { status: "payment_required", label: "Payment", count: status(["payment_required"]) },
        { status: "for_approval", label: "Approval", count: status(["for_approval", "approved"]) },
        { status: "registered", label: "Registered", count: status(["registered"]) },
      ],
      transactions: { daily, weekly, monthly },
    };
  }

  async run(key: ReportKey, f: ReportFilters): Promise<ReportResult> {
    await mockDelay(300, 800);
    const meta = REPORT_CATALOG.find((r) => r.key === key)!;
    const base = { key, title: meta.title, description: meta.description };
    const motoProvince = (motorcycleId?: string) => findById("motorcycles", motorcycleId)?.provinceOfOperation ?? "";
    const provinceOk = (motorcycleId?: string) => !f.province || motoProvince(motorcycleId) === f.province;

    if (key === "registration_summary") {
      const apps = read("applications").filter((a) =>
        inRange(a.createdAt, f) && provinceOk(a.motorcycleId) && (!f.officeId || a.officeId === f.officeId) &&
        (!f.officerId || a.createdBy === f.officerId) && (!f.status || REGISTRATION_STATUS[a.status].label === f.status));
      return {
        ...base,
        columns: [
          { key: "transaction", label: "Transaction", mono: true }, { key: "type", label: "Type" }, { key: "owner", label: "Owner" },
          { key: "motorcycle", label: "Motorcycle" }, { key: "province", label: "Province" }, { key: "office", label: "Office" },
          { key: "status", label: "Status" }, { key: "officer", label: "Officer" }, { key: "created", label: "Created" },
        ],
        rows: apps.map((a) => ({
          transaction: a.transactionNumber, type: a.type === "new" ? "New" : "Renewal", owner: fullName(findById("owners", a.ownerId)),
          motorcycle: motorcycleLabel(findById("motorcycles", a.motorcycleId)), province: motoProvince(a.motorcycleId), office: officeName(a.officeId),
          status: REGISTRATION_STATUS[a.status].label, officer: a.createdByName, created: formatDateTime(a.createdAt),
        })),
        summary: [
          { label: "Applications", value: String(apps.length) },
          { label: "Registered", value: String(apps.filter((a) => a.status === "registered").length) },
          { label: "In progress", value: String(apps.filter((a) => !["registered", "rejected", "cancelled"].includes(a.status)).length) },
          { label: "Rejected", value: String(apps.filter((a) => a.status === "rejected").length) },
        ],
        chart: { type: "bar", data: countBy(apps, (a) => REGISTRATION_STATUS[a.status].label), valueFormat: "count" },
        statusOptions: Object.values(REGISTRATION_STATUS).map((s) => s.label),
      };
    }

    if (["revenue_collection", "cash_collection", "pos_transactions", "payment_history", "failed_payments"].includes(key)) {
      let pays = read("payments").filter((p) => {
        const app = findById("applications", p.applicationId);
        return inRange(p.completedAt ?? p.createdAt, f) && provinceOk(app?.motorcycleId) && (!f.officeId || p.officeId === f.officeId) &&
          (!f.officerId || p.cashierId === f.officerId) && (!f.paymentMethod || p.method === f.paymentMethod) &&
          (!f.status || PAYMENT_STATUS[p.status].label === f.status);
      });
      if (key === "revenue_collection") pays = pays.filter((p) => p.status === "successful");
      if (key === "cash_collection") pays = pays.filter((p) => p.method === "cash" && p.status === "successful");
      if (key === "pos_transactions") pays = pays.filter((p) => p.method === "pos");
      if (key === "failed_payments") pays = pays.filter((p) => !["successful", "processing"].includes(p.status));
      pays.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const total = pays.filter((p) => p.status === "successful").reduce((s, p) => s + p.amount, 0);
      const columns = key === "cash_collection"
        ? [{ key: "date", label: "Date" }, { key: "receipt", label: "Receipt", mono: true }, { key: "transaction", label: "Transaction", mono: true }, { key: "owner", label: "Owner" }, { key: "cashier", label: "Cashier" }, { key: "tendered", label: "Tendered", align: "right" as const }, { key: "change", label: "Change", align: "right" as const }, { key: "amount", label: "Amount", align: "right" as const }]
        : key === "pos_transactions"
          ? [{ key: "date", label: "Date" }, { key: "reference", label: "Reference", mono: true }, { key: "terminal", label: "Terminal", mono: true }, { key: "transaction", label: "Transaction", mono: true }, { key: "status", label: "Status" }, { key: "reason", label: "Detail" }, { key: "amount", label: "Amount", align: "right" as const }]
          : key === "failed_payments"
            ? [{ key: "date", label: "Date" }, { key: "reference", label: "Reference", mono: true }, { key: "transaction", label: "Transaction", mono: true }, { key: "method", label: "Method" }, { key: "status", label: "Status" }, { key: "reason", label: "Reason" }, { key: "cashier", label: "Cashier" }, { key: "amount", label: "Amount", align: "right" as const }]
            : [{ key: "date", label: "Date" }, { key: "reference", label: "Reference", mono: true }, { key: "receipt", label: "Receipt", mono: true }, { key: "transaction", label: "Transaction", mono: true }, { key: "owner", label: "Owner" }, { key: "method", label: "Method" }, { key: "status", label: "Status" }, { key: "office", label: "Office" }, { key: "amount", label: "Amount", align: "right" as const }];
      return {
        ...base,
        columns,
        rows: paymentRows(pays),
        summary: [
          { label: key === "failed_payments" ? "Failed attempts" : "Transactions", value: String(pays.length) },
          { label: "Collected", value: formatMoney(total) },
          { label: "Successful", value: String(pays.filter((p) => p.status === "successful").length) },
          { label: "Failed / unknown", value: String(pays.filter((p) => !["successful", "processing"].includes(p.status)).length) },
        ],
        chart: key === "failed_payments" || key === "pos_transactions"
          ? { type: "pie", data: countBy(pays, (p) => PAYMENT_STATUS[p.status].label), valueFormat: "count" }
          : { type: "pie", data: sumBy(pays.filter((p) => p.status === "successful"), (p) => PAYMENT_METHOD_LABELS[p.method], (p) => p.amount), valueFormat: "money" },
        statusOptions: Object.values(PAYMENT_STATUS).map((s) => s.label),
      };
    }

    if (key === "inspection_report" || key === "failed_inspections") {
      let list = read("inspections").filter((i) => inRange(i.submittedAt ?? i.createdAt, f) && provinceOk(i.motorcycleId) && (!f.officerId || i.inspectorId === f.officerId) && (!f.status || INSPECTION_STATUS[i.status].label === f.status));
      if (f.officeId) list = list.filter((i) => findById("applications", i.applicationId)?.officeId === f.officeId);
      if (key === "failed_inspections") list = list.filter((i) => i.status === "failed");
      return {
        ...base,
        columns: [
          { key: "date", label: "Date" }, { key: "transaction", label: "Transaction", mono: true }, { key: "motorcycle", label: "Motorcycle" },
          { key: "center", label: "Centre" }, { key: "inspector", label: "Inspector" }, { key: "attempt", label: "Attempt", align: "right" },
          { key: "status", label: "Result" }, { key: key === "failed_inspections" ? "reason" : "certificate", label: key === "failed_inspections" ? "Failure reason" : "Certificate", mono: key !== "failed_inspections" },
        ],
        rows: list.map((i) => ({
          date: formatDate(i.submittedAt ?? i.inspectionDate), transaction: findById("applications", i.applicationId)?.transactionNumber ?? "—",
          motorcycle: motorcycleLabel(findById("motorcycles", i.motorcycleId)), center: findById("centers", i.centerId)?.name ?? "—",
          inspector: userName(i.inspectorId), attempt: i.attempt, status: INSPECTION_STATUS[i.status].label,
          certificate: i.certificateNumber ?? "—", reason: i.failureReason ?? "—",
        })),
        summary: [
          { label: "Inspections", value: String(list.length) },
          { label: "Passed", value: String(list.filter((i) => i.status === "passed").length) },
          { label: "Failed", value: String(list.filter((i) => i.status === "failed").length) },
          { label: "Pass rate", value: list.length ? `${Math.round((list.filter((i) => i.status === "passed").length / Math.max(1, list.filter((i) => ["passed", "failed"].includes(i.status)).length)) * 100)}%` : "—" },
        ],
        chart: key === "failed_inspections"
          ? { type: "bar", data: countBy(list, (i) => i.failureReason ?? "Unspecified"), valueFormat: "count" }
          : { type: "pie", data: countBy(list, (i) => INSPECTION_STATUS[i.status].label), valueFormat: "count" },
        statusOptions: Object.values(INSPECTION_STATUS).map((s) => s.label),
      };
    }

    if (key === "plate_inventory") {
      const list = read("plates").filter((p) => (!f.officeId || p.officeId === f.officeId) && (!f.status || PLATE_STATUS[p.status].label === f.status) && inRange(p.receivedDate, f));
      return {
        ...base,
        columns: [{ key: "plate", label: "Plate", mono: true }, { key: "office", label: "Office" }, { key: "status", label: "Status" }, { key: "vehicle", label: "Vehicle" }, { key: "received", label: "Received" }, { key: "assigned", label: "Assigned" }],
        rows: list.map((p) => ({ plate: p.plateNumber, office: officeName(p.officeId), status: PLATE_STATUS[p.status].label, vehicle: motorcycleLabel(findById("motorcycles", p.motorcycleId)), received: formatDate(p.receivedDate), assigned: formatDate(p.assignedDate) })),
        summary: [
          { label: "Plates", value: String(list.length) },
          { label: "Available", value: String(list.filter((p) => p.status === "available").length) },
          { label: "Assigned", value: String(list.filter((p) => p.status === "assigned").length) },
          { label: "Damaged / lost", value: String(list.filter((p) => ["damaged", "lost"].includes(p.status)).length) },
        ],
        chart: { type: "bar", data: countBy(list, (p) => PLATE_STATUS[p.status].label), valueFormat: "count" },
        statusOptions: Object.values(PLATE_STATUS).map((s) => s.label),
      };
    }

    if (key === "registration_expiry") {
      const now = new Date();
      const list = refreshExpiry(read("motorcycles")).filter((m) => m.registrationExpiry && (!f.province || m.provinceOfOperation === f.province) && (!f.officeId || m.officeId === f.officeId) && (!f.status || MOTORCYCLE_STATUS[m.registrationStatus].label === f.status) && inRange(m.registrationExpiry, f))
        .sort((a, b) => (a.registrationExpiry ?? "").localeCompare(b.registrationExpiry ?? ""));
      return {
        ...base,
        columns: [{ key: "plate", label: "Plate", mono: true }, { key: "registration", label: "Registration", mono: true }, { key: "owner", label: "Owner" }, { key: "mobile", label: "Mobile", mono: true }, { key: "motorcycle", label: "Motorcycle" }, { key: "province", label: "Province" }, { key: "expiry", label: "Expiry" }, { key: "days", label: "Days", align: "right" }, { key: "status", label: "Status" }],
        rows: list.map((m) => {
          const owner = findById("owners", m.ownerId);
          return { plate: m.plateNumber ?? "—", registration: m.registrationNumber ?? "—", owner: fullName(owner), mobile: owner?.mobile ?? "", motorcycle: motorcycleLabel(m), province: m.provinceOfOperation, expiry: formatDate(m.registrationExpiry), days: differenceInCalendarDays(new Date(m.registrationExpiry!), now), status: MOTORCYCLE_STATUS[m.registrationStatus].label };
        }),
        summary: [
          { label: "Registrations", value: String(list.length) },
          { label: "Expired", value: String(list.filter((m) => m.registrationStatus === "expired").length) },
          { label: "Expiring ≤ 30 days", value: String(list.filter((m) => m.registrationStatus === "registered" && differenceInCalendarDays(new Date(m.registrationExpiry!), now) <= 30).length) },
          { label: "Current", value: String(list.filter((m) => m.registrationStatus === "registered").length) },
        ],
        chart: { type: "pie", data: countBy(list, (m) => (m.registrationStatus === "expired" ? "Expired" : differenceInCalendarDays(new Date(m.registrationExpiry!), now) <= 30 ? "Expiring ≤ 30 days" : differenceInCalendarDays(new Date(m.registrationExpiry!), now) <= 90 ? "31–90 days" : "> 90 days")), valueFormat: "count" },
        statusOptions: Object.values(MOTORCYCLE_STATUS).map((s) => s.label),
      };
    }

    // officer_activity / audit_report
    const events = read("audit").filter((e) => inRange(e.timestamp, f) && (!f.officerId || e.userId === f.officerId) && (!f.officeId || findById("users", e.userId)?.officeId === f.officeId) && (!f.status || AUDIT_ACTION_LABELS[e.action] === f.status));
    if (key === "officer_activity") {
      const byUser = new Map<string, { name: string; role: string; total: number; registrations: number; payments: number; approvals: number; inspections: number; last: string }>();
      for (const e of events) {
        const r = byUser.get(e.userId) ?? { name: e.userName, role: e.role, total: 0, registrations: 0, payments: 0, approvals: 0, inspections: 0, last: e.timestamp };
        r.total++;
        if (e.action.startsWith("registration_created") || e.action === "renewal_created") r.registrations++;
        if (e.action === "payment_processed") r.payments++;
        if (["registration_approved", "registration_returned", "registration_rejected"].includes(e.action)) r.approvals++;
        if (e.action === "inspection_submitted") r.inspections++;
        if (e.timestamp > r.last) r.last = e.timestamp;
        byUser.set(e.userId, r);
      }
      const rows = [...byUser.values()].sort((a, b) => b.total - a.total);
      return {
        ...base,
        columns: [{ key: "name", label: "Officer" }, { key: "role", label: "Role" }, { key: "registrations", label: "Registrations", align: "right" }, { key: "inspections", label: "Inspections", align: "right" }, { key: "payments", label: "Payments", align: "right" }, { key: "approvals", label: "Decisions", align: "right" }, { key: "total", label: "All actions", align: "right" }, { key: "last", label: "Last activity" }],
        rows: rows.map((r) => ({ ...r, role: r.role.replace(/_/g, " "), last: formatDateTime(r.last) })),
        summary: [
          { label: "Officers", value: String(rows.length) },
          { label: "Actions", value: String(events.length) },
          { label: "Payments", value: String(rows.reduce((s, r) => s + r.payments, 0)) },
          { label: "Decisions", value: String(rows.reduce((s, r) => s + r.approvals, 0)) },
        ],
        chart: { type: "bar", data: rows.slice(0, 10).map((r) => ({ name: r.name, value: r.total })), valueFormat: "count" },
        statusOptions: Object.values(AUDIT_ACTION_LABELS),
      };
    }
    return {
      ...base,
      columns: [{ key: "time", label: "Date / time" }, { key: "user", label: "User" }, { key: "role", label: "Role" }, { key: "action", label: "Action" }, { key: "entity", label: "Entity" }, { key: "record", label: "Record", mono: true }, { key: "description", label: "Description" }],
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
  }
}
