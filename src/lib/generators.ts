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
  return { transaction: {}, payment: {}, receipt: {}, certificate: {}, label: {}, registration: {}, inspectionCertificate: {}, inspection: {} };
}

/** Increments and persists a counter. Numbers are never reused, even after a cancelled draft. */
export function nextSequence(key: CounterKey, scope: string, inMemory?: Counters): number {
  const counters = inMemory ?? mockStorage.get<Counters>(KEYS.counters) ?? emptyCounters();
  counters[key] ??= {};
  const next = (counters[key][scope] ?? 0) + 1;
  counters[key][scope] = next;
  if (!inMemory) mockStorage.set(KEYS.counters, counters);
  return next;
}

const pad = (n: number, w = 6) => String(n).padStart(w, "0");

export const generators = {
  /** RTA-MV-2026-00000001 (legacy Phase 1 records keep RTA-MC-…) */
  transactionNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `RTA-MV-${year}-${pad(nextSequence("transaction", year, c), 8)}`;
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
  /** CERT-MVR-2026-000001 */
  certificateNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `CERT-MVR-${year}-${pad(nextSequence("certificate", year, c))}`;
  },
  /** LBL-2026-000001 */
  labelNumber(at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `LBL-${year}-${pad(nextSequence("label", year, c))}`;
  },
  /**
   * REG-NCD-26-018482 — pattern REG-{PROVINCE}-{YY}-{SEQUENCE}. Existing Phase 1 numbers
   * (MC-NCD-2026-000001) are preserved on their records and never regenerated.
   */
  registrationNumber(provinceCode: string, at: Date = new Date(), c?: Counters) {
    const yy = format(at, "yy");
    return `REG-${provinceCode}-${yy}-${pad(nextSequence("registration", `${provinceCode}-${yy}`, c))}`;
  },
  /** INS-NCD-2026-000001 — inspection reference */
  inspectionReference(provinceCode: string, at: Date = new Date(), c?: Counters) {
    const year = format(at, "yyyy");
    return `INS-${provinceCode}-${year}-${pad(nextSequence("inspection", `${provinceCode}-${year}`, c))}`;
  },
  /** VR-7Q4K-82MX — verification reference printed on certificates */
  verificationReference(seed: string) {
    const clean = seed.replace(/[^A-Za-z0-9]/g, "").toUpperCase().padEnd(8, "X");
    return `VR-${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
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
