import type { PlateCategory, VehicleGroup, VehicleType, VehicleUsage } from "@/types";

/**
 * Central vehicle type catalogue. Pages, forms, filters, fee rules, inspections and reports
 * read from here — never from their own arrays. Phase 2 loads the same shape from the
 * `vehicle_types` / `vehicle_classes` tables (Administration → Vehicle Configuration).
 */

export interface VehicleClassDef {
  key: string;
  label: string;
}

export interface VehicleTypeDef {
  key: VehicleType;
  label: string;
  group: VehicleGroup;
  classes: VehicleClassDef[];
  bodyTypes: string[];
  /** false for towed equipment: no engine number, fuel or transmission. */
  hasEngine: boolean;
  defaultUsage: VehicleUsage;
  /** Plate series used when the usage does not imply its own (see `plateCategoryFor`). */
  defaultPlateCategory: PlateCategory;
  /** Report / dashboard bucket. */
  reportBucket: VehicleReportBucket;
  active: boolean;
}

export type VehicleReportBucket = "motorcycles" | "cars" | "suvs" | "pickups" | "vans" | "buses" | "pmvs" | "trucks" | "commercial" | "other";

export const VEHICLE_GROUPS: { key: VehicleGroup; label: string; description: string }[] = [
  { key: "two_wheeler", label: "Two-wheelers", description: "Motorcycles, scooters and mopeds" },
  { key: "passenger", label: "Passenger vehicles", description: "Cars, SUVs, utilities, pickups and vans" },
  { key: "passenger_transport", label: "Passenger transport", description: "Buses, taxis and Public Motor Vehicles" },
  { key: "commercial", label: "Commercial & heavy", description: "Light and heavy commercial vehicles, trucks and prime movers" },
  { key: "towed", label: "Towed", description: "Trailers and semi-trailers" },
  { key: "special", label: "Special", description: "Special purpose, plant, agricultural, emergency, government and diplomatic" },
];

const MOTO_CLASSES: VehicleClassDef[] = [
  { key: "moto_le_125", label: "Motorcycle ≤ 125 cc" },
  { key: "moto_126_250", label: "Motorcycle 126–250 cc" },
  { key: "moto_gt_250", label: "Motorcycle > 250 cc" },
];
const LIGHT_CLASSES: VehicleClassDef[] = [{ key: "light_vehicle", label: "Light Vehicle (GVM ≤ 4.5 t)" }];
const PASSENGER_TRANSPORT_CLASSES: VehicleClassDef[] = [
  { key: "pt_up_to_15", label: "Public Passenger — up to 15 seats" },
  { key: "pt_16_30", label: "Public Passenger — 16 to 30 seats" },
  { key: "pt_over_30", label: "Public Passenger — over 30 seats" },
];
const HEAVY_CLASSES: VehicleClassDef[] = [
  { key: "light_commercial", label: "Light Commercial (GVM ≤ 4.5 t)" },
  { key: "medium_rigid", label: "Medium Rigid (4.5–12 t)" },
  { key: "heavy_rigid", label: "Heavy Rigid (> 12 t)" },
  { key: "heavy_combination", label: "Heavy Combination" },
];
const TRAILER_CLASSES: VehicleClassDef[] = [
  { key: "light_trailer", label: "Light Trailer (ATM ≤ 3.5 t)" },
  { key: "heavy_trailer", label: "Heavy Trailer (> 3.5 t)" },
];
const SPECIAL_CLASSES: VehicleClassDef[] = [
  { key: "special_purpose", label: "Special Purpose" },
  { key: "plant_equipment", label: "Plant / Equipment" },
  { key: "agricultural", label: "Agricultural" },
  { key: "light_vehicle", label: "Light Vehicle (GVM ≤ 4.5 t)" },
  { key: "heavy_rigid", label: "Heavy Rigid (> 12 t)" },
];

const t = (
  key: VehicleType,
  label: string,
  group: VehicleGroup,
  classes: VehicleClassDef[],
  bodyTypes: string[],
  defaultUsage: VehicleUsage,
  defaultPlateCategory: PlateCategory,
  reportBucket: VehicleReportBucket,
  hasEngine = true,
): VehicleTypeDef => ({ key, label, group, classes, bodyTypes, hasEngine, defaultUsage, defaultPlateCategory, reportBucket, active: true });

export const VEHICLE_TYPES: VehicleTypeDef[] = [
  t("motorcycle", "Motorcycle", "two_wheeler", MOTO_CLASSES, ["Standard", "Trail / Dual-sport", "Underbone", "Cruiser", "Sport", "With sidecar"], "private", "motorcycle", "motorcycles"),
  t("scooter", "Scooter / Moped", "two_wheeler", MOTO_CLASSES.slice(0, 2), ["Scooter", "Moped", "Electric scooter"], "private", "motorcycle", "motorcycles"),
  t("sedan", "Sedan", "passenger", LIGHT_CLASSES, ["Sedan", "Coupe", "Wagon"], "private", "private", "cars"),
  t("hatchback", "Hatchback", "passenger", LIGHT_CLASSES, ["Hatch", "Liftback"], "private", "private", "cars"),
  t("suv", "SUV", "passenger", LIGHT_CLASSES, ["Wagon", "4WD Wagon", "Crossover"], "private", "private", "suvs"),
  t("utility", "Utility Vehicle", "passenger", LIGHT_CLASSES, ["Single cab utility", "Double cab utility", "Cab chassis"], "private", "private", "pickups"),
  t("pickup", "Pickup", "passenger", LIGHT_CLASSES, ["Double cab utility", "Single cab utility", "Extra cab"], "private", "private", "pickups"),
  t("van", "Van", "passenger", LIGHT_CLASSES, ["Panel van", "Window van", "Crew van"], "private", "private", "vans"),
  t("minibus", "Minibus", "passenger", [...LIGHT_CLASSES, PASSENGER_TRANSPORT_CLASSES[0]], ["Minibus", "Commuter"], "private", "private", "vans"),
  t("bus", "Bus", "passenger_transport", PASSENGER_TRANSPORT_CLASSES, ["Bus", "Coach", "Minibus"], "public_transport", "pmv", "buses"),
  t("taxi", "Taxi", "passenger_transport", [PASSENGER_TRANSPORT_CLASSES[0]], ["Sedan (Taxi)", "Wagon (Taxi)", "Van (Taxi)"], "taxi", "taxi", "cars"),
  t("pmv", "Public Motor Vehicle (PMV)", "passenger_transport", PASSENGER_TRANSPORT_CLASSES, ["Bus", "Minibus", "Truck (PMV)"], "pmv", "pmv", "pmvs"),
  t("light-commercial", "Light Commercial Vehicle", "commercial", [HEAVY_CLASSES[0]], ["Tray", "Box", "Cab chassis", "Panel van"], "commercial", "commercial", "commercial"),
  t("truck", "Truck", "commercial", HEAVY_CLASSES.slice(1, 3), ["Tray", "Tipper", "Box", "Tanker", "Curtainsider"], "commercial", "commercial", "trucks"),
  t("heavy-commercial", "Heavy Commercial Vehicle", "commercial", HEAVY_CLASSES.slice(2), ["Tipper", "Tanker", "Concrete agitator", "Refrigerated box"], "commercial", "commercial", "trucks"),
  t("prime-mover", "Prime Mover", "commercial", [HEAVY_CLASSES[3]], ["Tractor unit"], "commercial", "commercial", "trucks"),
  t("trailer", "Trailer", "towed", TRAILER_CLASSES, ["Box trailer", "Flatbed", "Boat trailer", "Tanker"], "commercial", "trailer", "commercial", false),
  t("semi-trailer", "Semi-Trailer", "towed", [TRAILER_CLASSES[1]], ["Flatbed", "Low-loader", "Skeletal", "Tanker", "Curtainsider"], "commercial", "trailer", "commercial", false),
  t("special-purpose", "Special Purpose Vehicle", "special", SPECIAL_CLASSES.slice(0, 2), ["Crane", "Tow truck", "Mobile workshop", "As configured"], "commercial", "special", "other"),
  t("construction", "Construction Vehicle / Equipment", "special", [SPECIAL_CLASSES[1]], ["Excavator", "Loader", "Grader", "Roller", "Forklift"], "construction", "special", "other"),
  t("agricultural", "Agricultural Vehicle", "special", [SPECIAL_CLASSES[2]], ["Tractor", "Harvester", "Plantation trailer"], "agricultural", "special", "other"),
  t("emergency", "Emergency Vehicle", "special", [SPECIAL_CLASSES[3], SPECIAL_CLASSES[4]], ["Ambulance", "Fire appliance", "Police vehicle", "Rescue"], "emergency", "emergency", "other"),
  t("government", "Government Vehicle", "special", [SPECIAL_CLASSES[3], SPECIAL_CLASSES[4]], ["Sedan", "Wagon", "Double cab utility", "Truck"], "government", "government", "other"),
  t("diplomatic", "Diplomatic Vehicle", "special", [SPECIAL_CLASSES[3]], ["Sedan", "Wagon", "4WD Wagon"], "diplomatic", "diplomatic", "other"),
  t("other", "Other Motor Vehicle", "special", SPECIAL_CLASSES.slice(0, 1), ["As configured"], "other", "private", "other"),
];

const BY_KEY = new Map(VEHICLE_TYPES.map((v) => [v.key, v]));

export function getVehicleType(key: VehicleType | string | undefined): VehicleTypeDef {
  return BY_KEY.get(key as VehicleType) ?? BY_KEY.get("other")!;
}

export function vehicleTypeLabel(key: VehicleType | string | undefined): string {
  return key ? getVehicleType(key).label : "—";
}

export function vehicleGroupOf(key: VehicleType | string | undefined): VehicleGroup {
  return getVehicleType(key).group;
}

export function vehicleClassLabel(type: VehicleType | string | undefined, classKey: string | undefined): string {
  if (!classKey) return "—";
  const all = VEHICLE_TYPES.flatMap((v) => v.classes);
  return getVehicleType(type).classes.find((c) => c.key === classKey)?.label ?? all.find((c) => c.key === classKey)?.label ?? classKey;
}

export function vehicleTypesByGroup(): { group: (typeof VEHICLE_GROUPS)[number]; types: VehicleTypeDef[] }[] {
  return VEHICLE_GROUPS.map((group) => ({ group, types: VEHICLE_TYPES.filter((v) => v.group === group.key && v.active) }));
}

export const VEHICLE_TYPE_OPTIONS = VEHICLE_TYPES.map((v) => ({ value: v.key, label: v.label }));

export const VEHICLE_REPORT_BUCKETS: { key: VehicleReportBucket; label: string }[] = [
  { key: "motorcycles", label: "Motorcycles" },
  { key: "cars", label: "Cars (sedan / hatchback / taxi)" },
  { key: "suvs", label: "SUVs" },
  { key: "pickups", label: "Pickups / utility" },
  { key: "vans", label: "Vans / minibuses" },
  { key: "buses", label: "Buses" },
  { key: "pmvs", label: "PMVs" },
  { key: "trucks", label: "Trucks" },
  { key: "commercial", label: "Other commercial / towed" },
  { key: "other", label: "Other" },
];

/** Picks a sensible default class from the specification (engine cc, seats, GVM). */
export function suggestVehicleClass(type: VehicleType, specs: Record<string, unknown> = {}): string {
  const def = getVehicleType(type);
  const n = (k: string) => Number(specs[k] ?? 0);
  if (def.group === "two_wheeler") {
    const cc = n("engineCapacityCc");
    const key = cc > 250 ? "moto_gt_250" : cc > 125 ? "moto_126_250" : "moto_le_125";
    return def.classes.some((c) => c.key === key) ? key : def.classes[0].key;
  }
  if (def.group === "passenger_transport") {
    const seats = n("seatingCapacity");
    const key = seats > 30 ? "pt_over_30" : seats > 15 ? "pt_16_30" : "pt_up_to_15";
    return def.classes.some((c) => c.key === key) ? key : def.classes[0].key;
  }
  if (def.group === "commercial") {
    const gvm = n("grossVehicleMassKg");
    const key = type === "prime-mover" ? "heavy_combination" : gvm > 12000 ? "heavy_rigid" : gvm > 4500 ? "medium_rigid" : "light_commercial";
    return def.classes.some((c) => c.key === key) ? key : def.classes[0].key;
  }
  if (def.group === "towed") {
    const atm = n("grossVehicleMassKg");
    return atm > 3500 || type === "semi-trailer" ? "heavy_trailer" : "light_trailer";
  }
  return def.classes[0].key;
}
