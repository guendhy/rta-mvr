import { addMonths, subDays } from "date-fns";
import { getTransactionType } from "@/config/transaction-types";
import { plateCategoryFor } from "@/config/vehicle-usage";
import { provinceCode } from "./constants";
import { fullName } from "./formatting";
import { generators } from "./generators";
import type { AppSettings, Counters, Owner, RegistrationApplication, Vehicle } from "@/types";

/**
 * What happens to the registry when a transaction is approved. Shared by the mock services
 * and the seed builder so seeded and live records follow identical rules. Historical
 * ownership and registration data are appended to, never overwritten.
 */

export function expiryFrom(start: Date, months: number): Date {
  return subDays(addMonths(start, months), 1);
}

/** Numbers and dates issued at approval. Existing registration numbers are always kept. */
export function approvalNumbers(app: RegistrationApplication, vehicle: Vehicle, settings: AppSettings, now: Date, counters?: Counters, periodMonths?: number) {
  const def = getTransactionType(app.type);
  const issuesCertificate = !["deregistration", "other"].includes(app.type);
  const registrationNumber = vehicle.registrationNumber ?? app.registrationNumber ?? generators.registrationNumber(provinceCode(vehicle.provinceOfOperation), now, counters);
  const months = periodMonths ?? settings.registration.validityMonths;
  const prevExpiry = vehicle.registrationExpiry ? new Date(vehicle.registrationExpiry) : null;
  const expiryDate = def.renewsPeriod
    ? (prevExpiry && prevExpiry > now && app.type !== "new" ? addMonths(prevExpiry, months) : expiryFrom(now, months)).toISOString()
    : vehicle.registrationExpiry;
  return {
    registrationNumber,
    certificateNumber: issuesCertificate ? generators.certificateNumber(now, counters) : undefined,
    labelNumber: def.renewsPeriod ? generators.labelNumber(now, counters) : undefined,
    registrationDate: now.toISOString(),
    expiryDate,
  };
}

/** A new plate must be assigned before the transaction completes. */
export function needsPlateAssignment(app: RegistrationApplication, settings: AppSettings): boolean {
  return app.plateRequired && settings.registration.requirePlateBeforeCompletion;
}

export function applyCompletionToVehicle(app: RegistrationApplication, vehicle: Vehicle, ctx: { now: Date; newOwner?: Owner | null }): Vehicle {
  const def = getTransactionType(app.type);
  const at = ctx.now.toISOString();
  const next: Vehicle = {
    ...vehicle,
    ownershipHistory: [...(vehicle.ownershipHistory ?? [])],
    registrationNumber: vehicle.registrationNumber ?? app.registrationNumber,
    plateNumber: app.plateNumber ?? vehicle.plateNumber,
    currentApplicationId: undefined,
    updatedAt: at,
  };

  if (def.renewsPeriod) {
    next.registrationExpiry = app.expiryDate;
    next.registrationDate = app.type === "new" || !vehicle.registrationDate ? app.registrationDate : vehicle.registrationDate;
    next.registrationStatus = app.expiryDate && new Date(app.expiryDate) < ctx.now ? "expired" : "active";
    next.statusReason = undefined;
  } else if (def.resultingVehicleStatus === "deregistered") {
    next.registrationStatus = "deregistered";
    next.statusReason = app.closureReason ?? "Deregistered";
  }

  if (app.type === "new" && next.ownershipHistory.length === 0) {
    next.ownershipHistory.push({ ownerId: vehicle.ownerId, ownerName: "Registered owner", from: app.registrationDate ?? at, reason: "first_registration", applicationId: app.id, transactionNumber: app.transactionNumber });
  }

  if (app.type === "transfer" && app.transfer?.newOwnerId && app.transfer.newOwnerId !== vehicle.ownerId) {
    const open = next.ownershipHistory.find((p) => !p.to && p.ownerId === vehicle.ownerId);
    if (open) open.to = at;
    else next.ownershipHistory.push({ ownerId: vehicle.ownerId, ownerName: "Previous owner", from: vehicle.registrationDate ?? vehicle.createdAt, to: at, reason: "first_registration" });
    next.ownershipHistory.push({ ownerId: app.transfer.newOwnerId, ownerName: ctx.newOwner ? fullName(ctx.newOwner) : "New owner", from: at, reason: "transfer", applicationId: app.id, transactionNumber: app.transactionNumber });
    next.ownerId = app.transfer.newOwnerId;
  }

  if (app.type === "reclassification" && app.draft.classification) {
    Object.assign(next, Object.fromEntries(Object.entries(app.draft.classification).filter(([, v]) => v !== undefined)));
    next.plateCategory = plateCategoryFor(next.vehicleType, next.vehicleUsage);
  }

  if ((app.type === "change_vehicle" || app.type === "registration_transfer") && app.draft.vehicle) {
    const { specifications, ...rest } = app.draft.vehicle;
    Object.assign(next, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== "")));
    if (specifications) next.specifications = { ...vehicle.specifications, ...specifications };
  }

  if (app.type === "reinstatement") {
    next.registrationStatus = next.registrationExpiry && new Date(next.registrationExpiry) < ctx.now ? "expired" : "active";
    next.statusReason = undefined;
  }
  return next;
}

/** Owner-information changes are applied to the owner record on approval. */
export function applyOwnerChanges(owner: Owner, app: RegistrationApplication, now: string): Owner {
  if (app.type !== "change_owner" || !app.draft.owner) return owner;
  const changes = Object.fromEntries(Object.entries(app.draft.owner).filter(([, v]) => v !== undefined && v !== ""));
  return { ...owner, ...changes, updatedAt: now };
}

/** Name for the ownership-history row, filled once owner records are available. */
export function labelOwnership(vehicle: Vehicle, owners: Owner[]): Vehicle {
  return {
    ...vehicle,
    ownershipHistory: vehicle.ownershipHistory.map((p) => {
      const o = owners.find((x) => x.id === p.ownerId);
      return o && (p.ownerName === "Registered owner" || p.ownerName === "Previous owner" || p.ownerName === "New owner") ? { ...p, ownerName: fullName(o) } : p;
    }),
  };
}
