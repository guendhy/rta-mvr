import type { FuelType, VehicleGroup, VehicleType } from "@/types";
import { getVehicleType } from "./vehicle-types";

/**
 * Dynamic technical-specification fields. The Vehicle Details step, the vehicle record,
 * validation and the fee engine all read this schema, so a new vehicle type only needs a
 * config entry — no new form code.
 */

export type SpecFieldInput = "number" | "text" | "select" | "boolean";

export interface SpecFieldDef {
  key: string;
  label: string;
  input: SpecFieldInput;
  unit?: string;
  options?: string[];
  help?: string;
  min?: number;
  max?: number;
  /** Integer-only number fields. */
  integer?: boolean;
}

/** Field library — every specification field the registry knows about. */
export const SPEC_FIELDS: Record<string, SpecFieldDef> = {
  engineCapacityCc: { key: "engineCapacityCc", label: "Engine Capacity", input: "number", unit: "cc", min: 49, max: 20000, integer: true },
  cylinders: { key: "cylinders", label: "Number of Cylinders", input: "number", min: 1, max: 16, integer: true },
  enginePowerKw: { key: "enginePowerKw", label: "Engine Power", input: "number", unit: "kW", min: 1, max: 1500 },
  wheelCount: { key: "wheelCount", label: "Number of Wheels", input: "number", min: 2, max: 30, integer: true },
  motorcycleCategory: { key: "motorcycleCategory", label: "Motorcycle Category", input: "select", options: ["Standard", "Trail / Dual-sport", "Underbone", "Scooter", "Cruiser", "Sport"] },
  sidecar: { key: "sidecar", label: "Sidecar fitted", input: "boolean", help: "Changes the fee and wheel count." },
  grossVehicleMassKg: { key: "grossVehicleMassKg", label: "Gross Vehicle Mass (GVM)", input: "number", unit: "kg", min: 100, max: 150000, integer: true, help: "From the compliance plate." },
  tareWeightKg: { key: "tareWeightKg", label: "Tare Weight", input: "number", unit: "kg", min: 50, max: 60000, integer: true },
  payloadCapacityKg: { key: "payloadCapacityKg", label: "Payload Capacity", input: "number", unit: "kg", min: 0, max: 120000, integer: true, help: "GVM − tare." },
  seatingCapacity: { key: "seatingCapacity", label: "Seating Capacity", input: "number", min: 1, max: 120, integer: true, help: "Including the driver." },
  standingCapacity: { key: "standingCapacity", label: "Standing Capacity", input: "number", min: 0, max: 120, integer: true },
  axleCount: { key: "axleCount", label: "Number of Axles", input: "number", min: 1, max: 12, integer: true },
  doorCount: { key: "doorCount", label: "Number of Doors", input: "number", min: 0, max: 8, integer: true },
  emergencyExits: { key: "emergencyExits", label: "Emergency Exits", input: "number", min: 0, max: 10, integer: true },
  routePermitNumber: { key: "routePermitNumber", label: "Route / Operating Permit No.", input: "text", help: "From the PMV or taxi permit." },
  routeDescription: { key: "routeDescription", label: "Route / Service Area", input: "text" },
  trailerCoupling: { key: "trailerCoupling", label: "Trailer Coupling", input: "select", options: ["None", "Ball", "Pintle", "Fifth wheel"] },
  linkedTrailerRegistration: { key: "linkedTrailerRegistration", label: "Linked Trailer Registration", input: "text" },
  trailerType: { key: "trailerType", label: "Trailer Type", input: "select", options: ["Box", "Flatbed", "Low-loader", "Tanker", "Skeletal", "Boat", "Curtainsider", "Other"] },
  brakeType: { key: "brakeType", label: "Brake Type", input: "select", options: ["None (unbraked)", "Mechanical", "Hydraulic", "Electric", "Air"] },
  couplingType: { key: "couplingType", label: "Coupling Type", input: "select", options: ["Ball", "Pintle", "Kingpin (fifth wheel)"] },
  lengthMm: { key: "lengthMm", label: "Overall Length", input: "number", unit: "mm", min: 1000, max: 30000, integer: true },
  equipmentType: { key: "equipmentType", label: "Equipment / Body Purpose", input: "text" },
  operatingHours: { key: "operatingHours", label: "Operating Hours", input: "number", unit: "h", min: 0, max: 200000, integer: true },
  authorizationReference: { key: "authorizationReference", label: "Authorization / Exemption Ref.", input: "text" },
  batteryType: { key: "batteryType", label: "Battery Type", input: "select", options: ["Lithium-ion (NMC)", "Lithium iron phosphate (LFP)", "Nickel-metal hydride", "Lead-acid", "Other"] },
  batteryCapacityKwh: { key: "batteryCapacityKwh", label: "Battery Capacity", input: "number", unit: "kWh", min: 0.5, max: 1000 },
  motorPowerKw: { key: "motorPowerKw", label: "Motor Power", input: "number", unit: "kW", min: 0.5, max: 1500 },
};

export interface SpecFieldRule {
  key: keyof typeof SPEC_FIELDS | string;
  required: boolean;
}

const f = (key: string, required = false): SpecFieldRule => ({ key, required });

/** Fields per group, overridable per vehicle type. Order = display order. */
export const VEHICLE_FIELD_CONFIG: Partial<Record<VehicleGroup | VehicleType, SpecFieldRule[]>> = {
  two_wheeler: [f("engineCapacityCc", true), f("cylinders"), f("wheelCount", true), f("motorcycleCategory", true), f("sidecar", true), f("enginePowerKw")],
  scooter: [f("engineCapacityCc", true), f("wheelCount", true), f("enginePowerKw")],
  passenger: [f("engineCapacityCc", true), f("cylinders"), f("enginePowerKw"), f("grossVehicleMassKg", true), f("tareWeightKg"), f("seatingCapacity", true), f("doorCount"), f("axleCount"), f("wheelCount")],
  minibus: [f("engineCapacityCc", true), f("grossVehicleMassKg", true), f("tareWeightKg"), f("seatingCapacity", true), f("doorCount"), f("axleCount", true)],
  passenger_transport: [f("seatingCapacity", true), f("standingCapacity"), f("grossVehicleMassKg", true), f("axleCount", true), f("engineCapacityCc"), f("doorCount"), f("emergencyExits", true), f("routePermitNumber", true), f("routeDescription")],
  taxi: [f("seatingCapacity", true), f("engineCapacityCc", true), f("grossVehicleMassKg"), f("doorCount"), f("routePermitNumber", true), f("routeDescription")],
  commercial: [f("grossVehicleMassKg", true), f("tareWeightKg", true), f("payloadCapacityKg"), f("axleCount", true), f("wheelCount"), f("engineCapacityCc"), f("enginePowerKw"), f("trailerCoupling", true), f("linkedTrailerRegistration")],
  "light-commercial": [f("grossVehicleMassKg", true), f("tareWeightKg", true), f("payloadCapacityKg"), f("axleCount", true), f("engineCapacityCc", true), f("seatingCapacity")],
  towed: [f("trailerType", true), f("grossVehicleMassKg", true), f("tareWeightKg", true), f("payloadCapacityKg"), f("axleCount", true), f("brakeType", true), f("couplingType", true), f("lengthMm")],
  special: [f("equipmentType", true), f("grossVehicleMassKg", true), f("axleCount"), f("engineCapacityCc"), f("enginePowerKw"), f("operatingHours")],
  emergency: [f("equipmentType", true), f("grossVehicleMassKg", true), f("seatingCapacity", true), f("engineCapacityCc"), f("authorizationReference", true)],
  government: [f("engineCapacityCc", true), f("grossVehicleMassKg", true), f("seatingCapacity", true), f("authorizationReference", true)],
  diplomatic: [f("engineCapacityCc", true), f("grossVehicleMassKg"), f("seatingCapacity", true), f("authorizationReference", true)],
};

/** Shown for every motorised vehicle when the fuel type is electric or hybrid. */
export const EV_FIELDS: SpecFieldRule[] = [f("batteryType", true), f("batteryCapacityKwh", true), f("motorPowerKw", true)];

/** Short explanation shown above the conditional fields. */
export const FIELD_GROUP_REASON: Record<VehicleGroup, string> = {
  two_wheeler: "engine capacity and sidecar determine the motorcycle fee.",
  passenger: "GVM, engine capacity and seating determine the light-vehicle fee band.",
  passenger_transport: "seating capacity, GVM, axles and the route permit decide fees and inspection frequency.",
  commercial: "GVM, payload and axles decide heavy-vehicle fees; trailer coupling links a trailer record.",
  towed: "no engine — mass, axles, brakes and coupling are recorded instead.",
  special: "the equipment purpose and mass determine the applicable rules.",
};

export interface ResolvedSpecField extends SpecFieldDef {
  required: boolean;
}

/** Fields to render (and validate) for a vehicle type, including EV fields when relevant. */
export function vehicleFieldsFor(type: VehicleType | string | undefined, opts: { fuelType?: FuelType | string } = {}): ResolvedSpecField[] {
  if (!type) return [];
  const def = getVehicleType(type);
  const rules = VEHICLE_FIELD_CONFIG[def.key] ?? VEHICLE_FIELD_CONFIG[def.group] ?? [];
  const ev = def.hasEngine && (opts.fuelType === "electric" || opts.fuelType === "hybrid") ? EV_FIELDS : [];
  const electric = opts.fuelType === "electric";
  return [...rules, ...ev]
    .map((r) => {
      const field = SPEC_FIELDS[r.key];
      if (!field) return null;
      // A battery-electric vehicle has no engine displacement.
      const required = electric && (r.key === "engineCapacityCc" || r.key === "cylinders") ? false : r.required;
      return { ...field, required };
    })
    .filter((x): x is ResolvedSpecField => !!x);
}

/** Human-readable specification value with its unit. */
export function formatSpecValue(key: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  const def = SPEC_FIELDS[key];
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (def?.input === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return `${n.toLocaleString("en-US")}${def.unit ? ` ${def.unit}` : ""}`;
  }
  return String(value);
}

export function specLabel(key: string): string {
  return SPEC_FIELDS[key]?.label ?? key;
}
