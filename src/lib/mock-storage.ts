/**
 * Thin localStorage wrapper used by the mock backend only. Pages and components never
 * touch localStorage directly — they go through services.
 */
export interface MockStorage {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  reset(): void;
  keys(): string[];
}

export const STORAGE_PREFIX = "rta:";
export const STORAGE_EVENT = "rta:storage-changed";

const memory = new Map<string, string>();

function hasWindow() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function emit(key: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }));
}

class LocalMockStorage implements MockStorage {
  get<T>(key: string): T | null {
    const k = STORAGE_PREFIX + key;
    try {
      const raw = hasWindow() ? window.localStorage.getItem(k) : memory.get(k) ?? null;
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    const k = STORAGE_PREFIX + key;
    const raw = JSON.stringify(value);
    if (hasWindow()) {
      try {
        window.localStorage.setItem(k, raw);
      } catch {
        throw new Error("The application could not be saved locally.");
      }
    } else {
      memory.set(k, raw);
    }
    emit(key);
  }

  remove(key: string): void {
    const k = STORAGE_PREFIX + key;
    if (hasWindow()) window.localStorage.removeItem(k);
    else memory.delete(k);
    emit(key);
  }

  keys(): string[] {
    if (!hasWindow()) return [...memory.keys()].map((k) => k.slice(STORAGE_PREFIX.length));
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) out.push(k.slice(STORAGE_PREFIX.length));
    }
    return out;
  }

  reset(): void {
    for (const key of this.keys()) {
      if (hasWindow()) window.localStorage.removeItem(STORAGE_PREFIX + key);
      else memory.delete(STORAGE_PREFIX + key);
    }
    emit("*");
  }
}

export const mockStorage: MockStorage = new LocalMockStorage();

/** Every key the mock backend persists. */
export const KEYS = {
  seeded: "seeded",
  session: "session",
  users: "users",
  permissions: "permissions",
  owners: "owners",
  motorcycles: "motorcycles",
  applications: "applications",
  inspections: "inspections",
  insurance: "insurance",
  fees: "fees",
  payments: "payments",
  plates: "plates",
  audit: "audit",
  notifications: "notifications",
  terminals: "terminals",
  offices: "offices",
  centers: "centers",
  settings: "settings",
  counters: "counters",
  simulation: "simulation",
  pos: "pos",
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];
