import { DEFAULT_DOCUMENT_RULES } from "@/config/document-requirements";
import {
  isLegacyMotorcycle,
  migrateLegacyApplication,
  migrateLegacyFees,
  migrateLegacyInspection,
  migrateLegacyInsurance,
  migrateLegacyMotorcycle,
  migrateLegacyOwner,
  migrateLegacyPlate,
  type LegacyMotorcycle,
} from "@/lib/legacy";
import { KEYS, mockStorage } from "@/lib/mock-storage";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_SETTINGS } from "@/data/mock/settings";
import { SEED_USERS } from "@/data/mock/users";
import type { AppSettings, Inspection, InsuranceRecord, LegacyFee, Owner, Plate, RegistrationApplication, RolePermissionMatrix, User, Vehicle } from "@/types";

/**
 * One-time upgrade of Phase 1 (motorcycle-only) local data to the motor vehicle model.
 * Nothing is deleted until every collection has been converted; registration numbers,
 * owners, transaction history and payments are carried over unchanged.
 * Returns false when there is nothing to migrate (the caller then seeds fresh data).
 */
export function migrateLegacyStorage(): boolean {
  const legacy = mockStorage.get<LegacyMotorcycle[]>(KEYS.legacyMotorcycles);
  if (!legacy?.length || !legacy.every(isLegacyMotorcycle)) return false;

  const owners = (mockStorage.get<Owner[]>(KEYS.owners) ?? []).map(migrateLegacyOwner);
  const vehicles: Vehicle[] = legacy.map((m) => migrateLegacyMotorcycle(m, owners.find((o) => o.id === m.ownerId)));
  const applications = (mockStorage.get<Parameters<typeof migrateLegacyApplication>[0][]>(KEYS.applications) ?? []).map((a) => {
    const vehicleId = a.vehicleId ?? a.motorcycleId;
    return migrateLegacyApplication(a, vehicles.find((v) => v.id === vehicleId), owners.find((o) => o.id === a.ownerId));
  }) as RegistrationApplication[];
  const inspections = (mockStorage.get<(Inspection & { motorcycleId?: string })[]>(KEYS.inspections) ?? []).map(migrateLegacyInspection);
  const insurance = (mockStorage.get<(InsuranceRecord & { motorcycleId?: string })[]>(KEYS.insurance) ?? []).map(migrateLegacyInsurance);
  const plates = (mockStorage.get<(Plate & { motorcycleId?: string; type?: string })[]>(KEYS.plates) ?? []).map(migrateLegacyPlate);
  const feeRules = migrateLegacyFees(mockStorage.get<LegacyFee[]>(KEYS.legacyFees));

  const settings = mockStorage.get<AppSettings>(KEYS.settings) ?? DEFAULT_SETTINGS;
  const nextSettings: AppSettings = {
    ...settings,
    general: { ...settings.general, systemName: DEFAULT_SETTINGS.general.systemName },
    registration: { ...DEFAULT_SETTINGS.registration, ...settings.registration },
    payments: { ...DEFAULT_SETTINGS.payments, ...settings.payments },
  };

  const permissions = mockStorage.get<RolePermissionMatrix>(KEYS.permissions);
  const nextPermissions: RolePermissionMatrix = { ...DEFAULT_PERMISSIONS, ...(permissions ?? {}), verification_officer: permissions?.verification_officer ?? DEFAULT_PERMISSIONS.verification_officer };
  for (const role of Object.keys(DEFAULT_PERMISSIONS) as (keyof RolePermissionMatrix)[]) {
    // New permission keys default from the new role definitions.
    const added = DEFAULT_PERMISSIONS[role].filter((p) => ["transfer.view", "transfer.create", "vehicle_config.manage", "requirements.manage"].includes(p));
    nextPermissions[role] = [...new Set([...(nextPermissions[role] ?? []), ...added])];
  }

  const users = mockStorage.get<User[]>(KEYS.users) ?? [];
  const missingUsers = SEED_USERS.filter((u) => !users.some((x) => x.id === u.id));

  mockStorage.set(KEYS.owners, owners);
  mockStorage.set(KEYS.vehicles, vehicles);
  mockStorage.set(KEYS.applications, applications);
  mockStorage.set(KEYS.inspections, inspections);
  mockStorage.set(KEYS.insurance, insurance);
  mockStorage.set(KEYS.plates, plates);
  mockStorage.set(KEYS.feeRules, feeRules);
  mockStorage.set(KEYS.documentRules, DEFAULT_DOCUMENT_RULES);
  mockStorage.set(KEYS.settings, nextSettings);
  mockStorage.set(KEYS.permissions, nextPermissions);
  if (missingUsers.length) mockStorage.set(KEYS.users, [...users, ...missingUsers]);
  mockStorage.remove(KEYS.legacyMotorcycles);
  mockStorage.remove(KEYS.legacyFees);
  return true;
}
