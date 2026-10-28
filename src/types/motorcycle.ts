import type { BaseRecord, FileMeta, ISODate } from "./common";

export type IntendedUse = "private" | "commercial" | "government" | "other";
export type FuelType = "petrol" | "diesel" | "electric" | "hybrid";
export type ImportStatus = "new_import" | "used_import" | "locally_assembled" | "local_resale";
export type MotorcycleRegistrationStatus = "unregistered" | "registered" | "expired" | "suspended" | "cancelled";
export type PhotoSlot = "front" | "rear" | "left" | "right" | "engine_number" | "chassis_number";

export interface Motorcycle extends BaseRecord {
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
  fuelType: FuelType;
  countryOfManufacture: string;
  importStatus: ImportStatus;
  intendedUse: IntendedUse;
  sidecar: boolean;
  provinceOfOperation: string;
  officeId: string;
  photos: Partial<Record<PhotoSlot, FileMeta>>;
  registrationStatus: MotorcycleRegistrationStatus;
  registrationNumber?: string;
  plateNumber?: string;
  registrationDate?: ISODate;
  registrationExpiry?: ISODate;
  currentApplicationId?: string;
}

export type MotorcycleInput = Omit<
  Motorcycle,
  "id" | "createdAt" | "updatedAt" | "registrationStatus" | "registrationNumber" | "plateNumber" | "registrationDate" | "registrationExpiry" | "currentApplicationId"
>;

export interface MotorcycleDuplicateMatch {
  motorcycle: Motorcycle;
  fields: ("engineNumber" | "chassisNumber" | "vin")[];
}
