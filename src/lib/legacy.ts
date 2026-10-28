import { SEED_FEE_RULES } from "@/config/fee-rules";
import { plateCategoryFor } from "@/config/vehicle-usage";
import { suggestVehicleClass } from "@/config/vehicle-types";
import { resolveApplicationRequirements, syncDocuments } from "./requirements";
import type {
  ApplicationDocument,
  Assessment,
  DocumentType,
  FeeRule,
  Inspection,
  InsuranceRecord,
  LegacyFee,
  Owner,
  Plate,
  RegistrationApplication,
  Vehicle,
  VehicleStatus,
  VehicleUsage,
} from "@/types";

/**
 * Phase 1 → motor vehicle model compatibility. Existing motorcycle records are converted,
 * not discarded: `vehicleType = "motorcycle"`, registration numbers, owners, transaction
 * history and payments are preserved exactly. Pure functions — the mock backend runs them
 * once over localStorage; `docs/migrations/` holds the matching SQL for Supabase.
 */

/** Shape of a Phase 1 motorcycle record (`rta:motorcycles`). */
export interface LegacyMotorcycle {
  id: string;
  ownerId: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  bodyType: string;
  color: string;
  engineNumber: string;
  chassisNumber: string;
  vin: string;
  engineCapacityCc: number;
  fuelType: "petrol" | "diesel" | "electric" | "hybrid";
  countryOfManufacture: string;
  importStatus: Vehicle["importStatus"];
  intendedUse: "private" | "commercial" | "government" | "other";
  sidecar: boolean;
  provinceOfOperation: string;
  officeId: string;
  photos: Vehicle["photos"];
  registrationStatus: "unregistered" | "registered" | "expired" | "suspended" | "cancelled";
  registrationNumber?: string;
  plateNumber?: string;
  registrationDate?: string;
  registrationExpiry?: string;
  currentApplicationId?: string;
  createdAt: string;
  updatedAt: string;
}

type LegacyApplication = Omit<RegistrationApplication, "vehicleId" | "inspectionRequired" | "insuranceRequired" | "plateRequired" | "documents" | "assessment"> & {
  motorcycleId?: string;
  vehicleId?: string;
  documents: (Omit<ApplicationDocument, "type" | "required"> & { type: string; required?: boolean })[];
  assessment?: Omit<Assessment, "totals" | "ruleSet" | "containsSampleAmounts" | "lines"> & { lines: { feeCode: string; name: string; amount: number }[] } & Partial<Assessment>;
  inspectionRequired?: boolean;
  insuranceRequired?: boolean;
  plateRequired?: boolean;
};

const LEGACY_DOC_TYPES: Record<string, DocumentType> = {
  owner_identification: "proof_of_identity",
  proof_of_ownership: "proof_of_ownership",
  import_purchase: "import_documentation",
  roadworthiness_certificate: "inspection_certificate",
  insurance_certificate: "insurance_certificate",
  other_supporting: "other_supporting",
};

const LEGACY_USAGE: Record<LegacyMotorcycle["intendedUse"], VehicleUsage> = {
  private: "private",
  commercial: "commercial",
  government: "government",
  other: "other",
};

const LEGACY_STATUS: Record<LegacyMotorcycle["registrationStatus"], VehicleStatus> = {
  unregistered: "unregistered",
  registered: "active",
  expired: "expired",
  suspended: "suspended",
  cancelled: "cancelled",
};

export function isLegacyMotorcycle(v: unknown): v is LegacyMotorcycle {
  return !!v && typeof v === "object" && "engineCapacityCc" in v && !("vehicleType" in v);
}

export function migrateLegacyMotorcycle(m: LegacyMotorcycle, owner?: Pick<Owner, "firstName" | "lastName">): Vehicle {
  const usage = LEGACY_USAGE[m.intendedUse] ?? "private";
  const specifications = { engineCapacityCc: m.engineCapacityCc, sidecar: m.sidecar, wheelCount: m.sidecar ? 3 : 2, motorcycleCategory: m.bodyType.includes("Trail") || m.bodyType.includes("Off-road") ? "Trail / Dual-sport" : "Standard" };
  return {
    id: m.id,
    ownerId: m.ownerId,
    vehicleType: "motorcycle",
    vehicleClass: suggestVehicleClass("motorcycle", specifications),
    vehicleUsage: usage,
    bodyType: m.sidecar ? "With sidecar" : m.bodyType === "Off-road / Trail" ? "Trail / Dual-sport" : m.bodyType,
    make: m.make,
    model: m.model,
    variant: m.variant,
    year: m.year,
    color: m.color,
    engineNumber: m.engineNumber,
    chassisNumber: m.chassisNumber,
    vin: m.vin,
    fuelType: m.fuelType,
    transmission: "manual",
    countryOfManufacture: m.countryOfManufacture,
    importStatus: m.importStatus,
    provinceOfOperation: m.provinceOfOperation,
    officeId: m.officeId,
    specifications,
    photos: m.photos ?? {},
    registrationStatus: LEGACY_STATUS[m.registrationStatus] ?? "unregistered",
    plateCategory: plateCategoryFor("motorcycle", usage),
    registrationNumber: m.registrationNumber,
    plateNumber: m.plateNumber,
    registrationDate: m.registrationDate,
    registrationExpiry: m.registrationExpiry,
    currentApplicationId: m.currentApplicationId,
    ownershipHistory: [{ ownerId: m.ownerId, ownerName: owner ? `${owner.firstName} ${owner.lastName}` : "Owner on record", from: m.registrationDate ?? m.createdAt, reason: "legacy_import" }],
    legacySource: "motorcycle",
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

export function migrateLegacyOwner(o: Owner | (Omit<Owner, "ownershipType"> & { ownershipType?: Owner["ownershipType"] })): Owner {
  return { ...o, ownershipType: o.ownershipType ?? "individual" } as Owner;
}

export function migrateLegacyApplication(a: LegacyApplication, vehicle: Vehicle | undefined, owner: Owner | undefined): RegistrationApplication {
  const docs = a.documents.map((d) => ({ ...d, type: LEGACY_DOC_TYPES[d.type] ?? (d.type as DocumentType), required: d.required ?? false })) as ApplicationDocument[];
  const req = resolveApplicationRequirements({ transactionType: a.type, vehicleType: vehicle?.vehicleType ?? "motorcycle", vehicleUsage: vehicle?.vehicleUsage, ownershipType: owner?.ownershipType ?? "individual", importStatus: vehicle?.importStatus });
  let assessment: Assessment | undefined;
  if (a.assessment) {
    const lines = a.assessment.lines.map((l) => ({ ...l, component: l.feeCode.startsWith("REG") ? ("registration" as const) : l.feeCode.includes("PLATE") ? ("plate" as const) : l.feeCode === "TRANSFER" ? ("transfer" as const) : ("other" as const), sample: false }));
    const sum = (c: string) => lines.filter((l) => l.component === c).reduce((s, l) => s + l.amount, 0);
    assessment = {
      ...a.assessment,
      lines,
      totals: { registrationFee: sum("registration"), inspectionFee: 0, plateFee: sum("plate"), transferFee: sum("transfer"), penalty: 0, serviceFee: 0, otherFees: sum("other"), total: a.assessment.total },
      ruleSet: "PHASE1-MOTORCYCLE",
      containsSampleAmounts: false,
    };
  }
  const { motorcycleId, ...rest } = a;
  return {
    ...rest,
    vehicleId: a.vehicleId ?? motorcycleId,
    documents: a.type === "new" ? syncDocuments(docs, req.documents) : docs,
    inspectionRequired: a.inspectionRequired ?? true,
    insuranceRequired: a.insuranceRequired ?? true,
    plateRequired: a.plateRequired ?? a.type === "new",
    assessment,
  };
}

export function migrateLegacyInspection(i: Inspection & { motorcycleId?: string }): Inspection {
  const { motorcycleId, ...rest } = i;
  return { ...rest, vehicleId: i.vehicleId ?? motorcycleId ?? "" };
}

export function migrateLegacyInsurance(i: InsuranceRecord & { motorcycleId?: string }): InsuranceRecord {
  const { motorcycleId, ...rest } = i;
  return { ...rest, vehicleId: i.vehicleId ?? motorcycleId ?? "" };
}

export function migrateLegacyPlate(p: Plate & { type?: string; motorcycleId?: string }): Plate {
  const { motorcycleId, type, ...rest } = p;
  void type;
  return { ...rest, category: p.category ?? "motorcycle", vehicleId: p.vehicleId ?? motorcycleId };
}

/** Keeps any amount an administrator changed on a Phase 1 fee. */
export function migrateLegacyFees(legacy: LegacyFee[] | null): FeeRule[] {
  const rules = JSON.parse(JSON.stringify(SEED_FEE_RULES)) as FeeRule[];
  for (const f of legacy ?? []) {
    const rule = rules.find((r) => r.code === f.code);
    if (rule) Object.assign(rule, { amount: f.amount, active: f.active, name: f.name, effectiveDate: f.effectiveDate });
  }
  return rules;
}
