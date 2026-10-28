import type { BaseRecord, FileMeta, ISODate } from "./common";

/**
 * Every motor vehicle category the registry supports. Motorcycle is one category among
 * many — labels, groups and rules live in `src/config/vehicle-types.ts`.
 */
export type VehicleType =
  | "motorcycle"
  | "scooter"
  | "sedan"
  | "hatchback"
  | "suv"
  | "utility"
  | "pickup"
  | "van"
  | "minibus"
  | "bus"
  | "taxi"
  | "pmv"
  | "truck"
  | "light-commercial"
  | "heavy-commercial"
  | "prime-mover"
  | "trailer"
  | "semi-trailer"
  | "special-purpose"
  | "construction"
  | "government"
  | "diplomatic"
  | "emergency"
  | "agricultural"
  | "other";

/** Groups drive shared rules (field sets, inspection checklists, fee basis, plate series). */
export type VehicleGroup = "two_wheeler" | "passenger" | "passenger_transport" | "commercial" | "towed" | "special";

/** Purpose of use — recorded separately from the type (a Van can be Private, Rental or PMV). */
export type VehicleUsage =
  | "private"
  | "commercial"
  | "public_transport"
  | "taxi"
  | "pmv"
  | "government"
  | "diplomatic"
  | "emergency"
  | "rental"
  | "corporate"
  | "agricultural"
  | "construction"
  | "other";

export type FuelType = "petrol" | "diesel" | "electric" | "hybrid" | "lpg" | "none";
export type TransmissionType = "manual" | "automatic" | "cvt" | "semi_automatic" | "not_applicable";
export type ImportStatus = "new_import" | "used_import" | "locally_assembled" | "local_resale";
export type PlateCategory = "private" | "commercial" | "pmv" | "taxi" | "government" | "diplomatic" | "motorcycle" | "trailer" | "emergency" | "special";
export type PhotoSlot = "front" | "rear" | "left" | "right" | "interior" | "engine_number" | "chassis_number" | "vin_plate";

/**
 * Registration status held on the vehicle record. "Expiring Soon" is derived from the
 * expiry date (see `vehicleRegistrationState` in `src/config/statuses.ts`).
 */
export type VehicleStatus = "unregistered" | "active" | "expired" | "suspended" | "cancelled" | "deregistered";

/** Type, class, use and body type — the inputs to fees, documents and inspections. */
export interface VehicleClassification {
  vehicleType: VehicleType;
  /** Key from the vehicle type's class list, e.g. "light_vehicle". */
  vehicleClass: string;
  vehicleUsage: VehicleUsage;
  bodyType: string;
}

/**
 * Type-specific technical values keyed by field key from `VEHICLE_FIELD_CONFIG`
 * (engineCapacityCc, grossVehicleMassKg, seatingCapacity, axleCount, …).
 */
export type VehicleSpecifications = Record<string, string | number | boolean | undefined>;

/** One row per owner for the life of the vehicle — never overwritten. */
export interface OwnershipPeriod {
  ownerId: string;
  ownerName: string;
  from: ISODate;
  to?: ISODate;
  /** Transaction that started this ownership. */
  applicationId?: string;
  transactionNumber?: string;
  reason: "first_registration" | "transfer" | "legacy_import" | "reinstatement";
}

export interface Vehicle extends BaseRecord, VehicleClassification {
  ownerId: string;
  make: string;
  model: string;
  variant?: string;
  /** Year of manufacture. */
  year: number;
  modelYear?: number;
  color: string;
  secondaryColor?: string;
  /** Empty for vehicles without an engine (trailers). */
  engineNumber: string;
  chassisNumber: string;
  vin: string;
  fuelType: FuelType;
  transmission: TransmissionType;
  countryOfManufacture: string;
  importStatus: ImportStatus;
  provinceOfOperation: string;
  officeId: string;
  previousRegistrationNumber?: string;
  specifications: VehicleSpecifications;
  photos: Partial<Record<PhotoSlot, FileMeta>>;
  registrationStatus: VehicleStatus;
  plateCategory?: PlateCategory;
  registrationNumber?: string;
  plateNumber?: string;
  registrationDate?: ISODate;
  registrationExpiry?: ISODate;
  currentApplicationId?: string;
  ownershipHistory: OwnershipPeriod[];
  statusReason?: string;
  /** Set when the record was converted from the Phase 1 motorcycle-only model. */
  legacySource?: "motorcycle";
}

export type VehicleInput = Omit<
  Vehicle,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "registrationStatus"
  | "registrationNumber"
  | "plateNumber"
  | "registrationDate"
  | "registrationExpiry"
  | "currentApplicationId"
  | "ownershipHistory"
  | "statusReason"
  | "legacySource"
>;

export type VehicleIdentifierField = "engineNumber" | "chassisNumber" | "vin";

export interface VehicleDuplicateMatch {
  vehicle: Vehicle;
  fields: VehicleIdentifierField[];
}

/** Fields searched by registry, renewal and transfer lookups. */
export type VehicleLookupField = "any" | "registrationNumber" | "plateNumber" | "vin" | "chassisNumber" | "engineNumber" | "ownerName" | "phone";
