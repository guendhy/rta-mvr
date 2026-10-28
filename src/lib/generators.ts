import { format } from "date-fns";
import { KEYS, mockStorage } from "./mock-storage";
import type { CounterKey, Counters } from "@/types";

/** UUID v4 — matches the shape Postgres `uuid` columns will use in Phase 2. */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function token(length = 24): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function emptyCounters(): Counters {
  return { transaction: {}, payment: {}, receipt: {}, certificate: {}, label: {}, registration: {}, inspectionCertificate: {} };
}

/** Increments and persists a counter. Numbers are never reused, even after a cancelled draft. */
export function nextSequence(key: CounterKey, scope: string, inMemory?: Counters): number {
  const counters = inMemory ?? mockStorage.get<Counters>(KEYS.counters) ?? emptyCounters();
  const next = (counters[key][scope] ?? 0) + 1;
  counters[key][scope] = next;
  if (!inMemory) mockStorage.set(KEYS.counters, counters);
  return next;
}

const pad = (n: number, w = 6) => String(n).padStart(w, "0");

export const generators = {
  /** RTA-MC-2026-000001 */
  transactionNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `RTA-MC-${year}-${pad(nextSequence("transaction", year, c))}`;
  },
  /** PAY-20261027-000001 */
  paymentReference(at: Date = new Date(), c?: Counters) {
    const day = format(at, "yyyyMMdd");
    return `PAY-${day}-${pad(nextSequence("payment", day, c))}`;
  },
  /** RTA-OR-2026-000001 */
  receiptNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `RTA-OR-${year}-${pad(nextSequence("receipt", year, c))}`;
  },
  /** COR-2026-000001 */
  certificateNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `COR-${year}-${pad(nextSequence("certificate", year, c))}`;
  },
  /** LBL-2026-000001 */
  labelNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `LBL-${year}-${pad(nextSequence("label", year, c))}`;
  },
  /** MC-NCD-2026-000001 — pattern MC-{PROVINCE}-{YEAR}-{SEQUENCE} */
  registrationNumber(provinceCode: string, at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `MC-${provinceCode}-${year}-${pad(nextSequence("registration", `${provinceCode}-${year}`, c))}`;
  },
  /** RWC-2026-000001 — roadworthiness certificate */
  inspectionCertificateNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `RWC-${year}-${pad(nextSequence("inspectionCertificate", year, c))}`;
  },
  approvalCode() {
    return String(100000 + Math.floor(Math.random() * 899999));
  },
  cardMasked() {
    return `•••• ${String(1000 + Math.floor(Math.random() * 8999))}`;
  },
};
