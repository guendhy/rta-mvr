import { ServiceError } from "@/lib/errors";
import { uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import { fullName } from "@/lib/formatting";
import type { OwnerService } from "../interfaces";
import type { Owner, OwnerDuplicateMatch, OwnerInput } from "@/types";
import { audit, consumeError, findById, nowIso, read, requirePermission, simulateNetwork, upsert } from "./core";

const digits = (s?: string) => (s ?? "").replace(/\D/g, "");
const norm = (s?: string) => (s ?? "").trim().toLowerCase();

// FUTURE: Replace MockOwnerService with SupabaseOwnerService.
export class MockOwnerService implements OwnerService {
  async list(): Promise<Owner[]> {
    await mockDelay();
    return read("owners");
  }

  async getById(id: string): Promise<Owner | null> {
    await mockDelay(100, 300);
    return findById("owners", id);
  }

  async search(query: string): Promise<Owner[]> {
    await mockDelay(200, 500);
    const q = norm(query);
    if (q.length < 2) return [];
    const qd = digits(query);
    return read("owners").filter((o) =>
      norm(fullName(o)).includes(q) ||
      norm(o.identificationNumber).includes(q) ||
      (qd.length >= 4 && digits(o.mobile).includes(qd)),
    ).slice(0, 20);
  }

  async findDuplicates(input: Partial<OwnerInput>, excludeId?: string): Promise<OwnerDuplicateMatch[]> {
    await mockDelay(150, 350);
    const out: OwnerDuplicateMatch[] = [];
    for (const o of read("owners")) {
      if (o.id === excludeId) continue;
      const reasons: OwnerDuplicateMatch["reasons"] = [];
      if (input.identificationNumber && norm(o.identificationNumber) === norm(input.identificationNumber)) reasons.push("identification");
      if (input.mobile && digits(input.mobile).length >= 7 && digits(o.mobile) === digits(input.mobile)) reasons.push("mobile");
      if (input.firstName && input.lastName && input.dateOfBirth &&
        norm(o.firstName) === norm(input.firstName) && norm(o.lastName) === norm(input.lastName) && o.dateOfBirth === input.dateOfBirth) reasons.push("name_dob");
      if (reasons.length) out.push({ owner: o, reasons });
    }
    return out;
  }

  async create(input: OwnerInput): Promise<Owner> {
    requirePermission("registration.create", "create owners");
    await mockDelay();
    simulateNetwork();
    if (consumeError("save_failed")) throw new ServiceError("storage", "The application could not be saved locally.");
    const ts = nowIso();
    const owner: Owner = { ...input, id: uuid(), createdAt: ts, updatedAt: ts };
    upsert("owners", owner);
    audit("owner_created", "Owner", `Owner ${fullName(owner)} created`, { id: owner.id, label: fullName(owner) });
    return owner;
  }

  async update(id: string, input: Partial<OwnerInput>): Promise<Owner> {
    requirePermission("registration.edit", "edit owners");
    await mockDelay();
    simulateNetwork();
    const current = findById("owners", id);
    if (!current) throw new ServiceError("not_found", "Owner not found.");
    const next = { ...current, ...input, updatedAt: nowIso() };
    upsert("owners", next);
    audit("registration_updated", "Owner", `Owner ${fullName(next)} updated`, { id, label: fullName(next) });
    return next;
  }
}
