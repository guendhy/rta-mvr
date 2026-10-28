import type { FuelType, ImportStatus, PlateCategory, TransmissionType, VehicleType, VehicleUsage } from "@/types";
import { getVehicleType } from "./vehicle-types";

/** Purpose of use. Kept separate from vehicle type — fees, documents and plate series depend on both. */
export const VEHICLE_USAGES: { value: VehicleUsage; label: string; plateCategory?: PlateCategory }[] = [
  { value: "private", label: "Private" },
  { value: "commercial", label: "Commercial", plateCategory: "commercial" },
  { value: "public_transport", label: "Public Transport", plateCategory: "pmv" },
  { value: "taxi", label: "Taxi", plateCategory: "taxi" },
  { value: "pmv", label: "PMV", plateCategory: "pmv" },
  { value: "government", label: "Government", plateCategory: "government" },
  { value: "diplomatic", label: "Diplomatic", plateCategory: "diplomatic" },
  { value: "emergency", label: "Emergency Service", plateCategory: "emergency" },
  { value: "rental", label: "Rental", plateCategory: "commercial" },
  { value: "corporate", label: "Company / Corporate", plateCategory: "commercial" },
  { value: "agricultural", label: "Agricultural" },
  { value: "construction", label: "Construction" },
  { value: "other", label: "Other" },
];

export function vehicleUsageLabel(value: VehicleUsage | string | undefined): string {
  return VEHICLE_USAGES.find((u) => u.value === value)?.label ?? (value ? String(value) : "—");
}

export const PLATE_CATEGORIES: { value: PlateCategory; label: string; prefix: string }[] = [
  { value: "private", label: "Private", prefix: "B" },
  { value: "commercial", label: "Commercial", prefix: "C" },
  { value: "pmv", label: "PMV", prefix: "P" },
  { value: "taxi", label: "Taxi", prefix: "T" },
  { value: "government", label: "Government", prefix: "ZG" },
  { value: "diplomatic", label: "Diplomatic", prefix: "CD" },
  { value: "motorcycle", label: "Motorcycle", prefix: "MC" },
  { value: "trailer", label: "Trailer", prefix: "TR" },
  { value: "emergency", label: "Emergency", prefix: "EM" },
  { value: "special", label: "Special / Plant", prefix: "SP" },
];

/** Available plates per series and office below which a low-stock warning is raised. */
export const LOW_PLATE_STOCK = 10;

export function plateCategoryLabel(value: PlateCategory | string | undefined): string {
  return PLATE_CATEGORIES.find((p) => p.value === value)?.label ?? (value ? String(value) : "—");
}

/**
 * Plate series for a vehicle. Two-wheelers and towed equipment keep their own series;
 * otherwise the use decides (PMV, taxi, government…), falling back to the type default.
 */
export function plateCategoryFor(type: VehicleType | string | undefined, usage: VehicleUsage | string | undefined): PlateCategory {
  const def = getVehicleType(type);
  if (def.group === "two_wheeler" || def.group === "towed") return def.defaultPlateCategory;
  return VEHICLE_USAGES.find((u) => u.value === usage)?.plateCategory ?? def.defaultPlateCategory;
}

export const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
  { value: "lpg", label: "LPG" },
  { value: "none", label: "Not applicable (no engine)" },
];

export const TRANSMISSION_TYPES: { value: TransmissionType; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "cvt", label: "CVT" },
  { value: "semi_automatic", label: "Semi-automatic" },
  { value: "not_applicable", label: "Not applicable" },
];

export const IMPORT_STATUSES: { value: ImportStatus; label: string }[] = [
  { value: "new_import", label: "New import" },
  { value: "used_import", label: "Used import" },
  { value: "locally_assembled", label: "Locally assembled" },
  { value: "local_resale", label: "Local resale" },
];

export const VEHICLE_COLORS = ["White", "Silver", "Grey", "Black", "Red", "Blue", "Green", "Yellow", "Orange", "Brown", "Beige", "Gold", "Maroon"];

export const COUNTRIES_OF_MANUFACTURE = ["Japan", "Thailand", "China", "India", "South Korea", "Indonesia", "Malaysia", "Philippines", "Vietnam", "Australia", "Germany", "United States", "Papua New Guinea", "Other"];

/** Common makes per vehicle group. "Other" lets officers type any make. */
export const MAKES_BY_GROUP: Record<string, Record<string, string[]>> = {
  two_wheeler: {
    Honda: ["XR150L", "CB125F", "Wave 110", "CRF250L", "CG125"],
    Yamaha: ["YBR125", "XTZ125", "Crypton", "AG200", "FZ150", "NMAX"],
    Suzuki: ["GN125", "DR200", "TF125", "AX100", "Address 110"],
    Kawasaki: ["KLX150", "KLR650", "Barako 175"],
    Bajaj: ["Boxer 150", "Pulsar 180", "Discover 125"],
    TVS: ["Apache 160", "HLX 125", "Star City"],
    Haojue: ["DK150", "HJ125"],
  },
  passenger: {
    Toyota: ["Hilux", "Land Cruiser", "Land Cruiser Prado", "Corolla", "Camry", "RAV4", "HiAce", "Fortuner", "Yaris"],
    Nissan: ["Navara", "Patrol", "X-Trail", "Urvan", "Almera"],
    Mitsubishi: ["Triton", "Pajero", "Pajero Sport", "Outlander", "L300"],
    Mazda: ["BT-50", "CX-5", "Mazda 3"],
    Isuzu: ["D-Max", "MU-X"],
    Ford: ["Ranger", "Everest"],
    Hyundai: ["Tucson", "Accent", "H-1"],
    Kia: ["Sportage", "Rio"],
    Suzuki: ["Swift", "Jimny", "APV"],
  },
  passenger_transport: {
    Toyota: ["Coaster", "HiAce Commuter", "Corolla", "Land Cruiser 78 Troop Carrier"],
    Nissan: ["Civilian", "Urvan"],
    Isuzu: ["NQR Bus", "Journey"],
    Hino: ["Liesse", "Rainbow"],
    Mitsubishi: ["Rosa"],
  },
  commercial: {
    Isuzu: ["NPR", "NQR", "FRR", "FVZ", "Giga"],
    Hino: ["300 Series", "500 Series", "700 Series"],
    "Mitsubishi Fuso": ["Canter", "Fighter", "Shogun"],
    "UD Trucks": ["Croner", "Quester"],
    Kenworth: ["T409", "T659"],
    Volvo: ["FM", "FH"],
    Toyota: ["Dyna", "Land Cruiser 79 Cab Chassis"],
  },
  towed: { "Local manufacturer": ["Box trailer", "Flatbed", "Low-loader"], Vawdrey: ["Flat top", "Skel"], Maxitrans: ["Freighter", "Tanker"] },
  special: {
    Caterpillar: ["320 Excavator", "950 Loader", "140 Grader"],
    Komatsu: ["PC200", "WA380"],
    "John Deere": ["5075E", "6120M"],
    Toyota: ["Land Cruiser 78 Ambulance", "Land Cruiser 200", "Hilux"],
    Isuzu: ["FSS Fire Appliance"],
  },
};

export function makesFor(type: VehicleType | string | undefined): Record<string, string[]> {
  return MAKES_BY_GROUP[getVehicleType(type).group] ?? {};
}
