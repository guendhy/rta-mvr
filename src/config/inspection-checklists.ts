import type { ChecklistCategoryDef, TransactionType, VehicleGroup, VehicleType } from "@/types";
import { getTransactionType } from "./transaction-types";
import { getVehicleType } from "./vehicle-types";

/**
 * Vehicle-aware inspection checklists: a common set for every motorised vehicle, items
 * removed where they do not apply, and extra categories per vehicle group.
 */
const COMMON: ChecklistCategoryDef[] = [
  { key: "identification", label: "Identification", items: [
    { key: "vin_verified", label: "VIN / chassis verification" },
    { key: "engine_verified", label: "Engine number verification" },
    { key: "plate_visibility", label: "Number plate visibility" },
  ] },
  { key: "brakes_steering", label: "Brakes & steering", items: [
    { key: "brakes", label: "Brakes" },
    { key: "steering", label: "Steering" },
  ] },
  { key: "wheels", label: "Wheels", items: [{ key: "tires", label: "Tires" }] },
  { key: "lighting", label: "Lighting", items: [
    { key: "lights", label: "Lights" },
    { key: "indicators", label: "Indicators" },
  ] },
  { key: "visibility", label: "Visibility", items: [
    { key: "mirrors", label: "Mirrors" },
    { key: "windshield", label: "Windshield & wipers" },
  ] },
  { key: "safety", label: "Safety", items: [
    { key: "horn", label: "Horn" },
    { key: "seatbelts", label: "Seatbelts" },
    { key: "safety_equipment", label: "Safety equipment" },
  ] },
  { key: "body_emissions", label: "Body & emissions", items: [
    { key: "exhaust", label: "Exhaust" },
    { key: "body_condition", label: "Body condition" },
  ] },
];

interface GroupProfile {
  code: string;
  label: string;
  /** Common item keys that do not apply. */
  drop: string[];
  extra?: ChecklistCategoryDef;
  note: string;
}

const PROFILES: Record<VehicleGroup, GroupProfile> = {
  two_wheeler: {
    code: "CHK-MC-01", label: "Motorcycle", drop: ["windshield", "seatbelts", "safety_equipment", "steering"], note: "Motorcycle items replace seatbelt, steering-box and windshield checks.",
    extra: { key: "motorcycle", label: "Motorcycle-specific", items: [
      { key: "handlebar_controls", label: "Handlebar & controls" },
      { key: "motorcycle_tires", label: "Motorcycle tires & rims" },
      { key: "motorcycle_lights", label: "Motorcycle lights & reflectors" },
      { key: "chain_sprockets", label: "Chain & sprockets" },
      { key: "footrests_stands", label: "Footrests & stands" },
    ] },
  },
  passenger: { code: "CHK-LV-01", label: "Light vehicle", drop: [], note: "Standard light-vehicle checklist." },
  passenger_transport: {
    code: "CHK-PT-02", label: "Bus / PMV / Taxi", drop: [], note: "Passenger-safety items are added for public transport.",
    extra: { key: "passenger_transport", label: "Passenger transport", items: [
      { key: "emergency_exit", label: "Emergency exits" },
      { key: "passenger_seating", label: "Passenger seats & handrails" },
      { key: "doors", label: "Doors & door controls" },
      { key: "fire_extinguisher", label: "Fire extinguisher & first-aid kit" },
      { key: "pt_safety_equipment", label: "Public transport safety equipment & signage" },
    ] },
  },
  commercial: {
    code: "CHK-HV-01", label: "Heavy vehicle", drop: [], note: "Heavy-vehicle items are added for trucks and prime movers.",
    extra: { key: "heavy_vehicle", label: "Heavy vehicle", items: [
      { key: "load_area", label: "Load area & restraints" },
      { key: "trailer_connection", label: "Trailer connection / fifth wheel" },
      { key: "axle_condition", label: "Axle & suspension condition" },
      { key: "air_brakes", label: "Air brake system" },
      { key: "underrun_protection", label: "Mudguards & under-run protection" },
    ] },
  },
  towed: {
    code: "CHK-TR-01", label: "Trailer", drop: ["engine_verified", "steering", "mirrors", "windshield", "horn", "seatbelts", "exhaust", "safety_equipment"], note: "Trailers have no engine — coupling, axles and brakes are checked instead.",
    extra: { key: "trailer", label: "Trailer", items: [
      { key: "trailer_connection", label: "Coupling & safety chains" },
      { key: "axle_condition", label: "Axle condition" },
      { key: "trailer_brakes", label: "Trailer brakes & breakaway" },
      { key: "load_area", label: "Deck / load area" },
    ] },
  },
  special: {
    code: "CHK-SP-01", label: "Special / plant", drop: [], note: "Configured per equipment type.",
    extra: { key: "special", label: "Special equipment", items: [
      { key: "equipment_secure", label: "Equipment secured for road travel" },
      { key: "warning_devices", label: "Warning lights / beacons" },
    ] },
  },
};

export function inspectionProfileFor(type: VehicleType | string | undefined): GroupProfile {
  return PROFILES[getVehicleType(type).group];
}

export function inspectionChecklistFor(type: VehicleType | string | undefined): ChecklistCategoryDef[] {
  const profile = inspectionProfileFor(type);
  const base = COMMON.map((c) => ({ ...c, items: c.items.filter((i) => !profile.drop.includes(i.key)) })).filter((c) => c.items.length);
  return profile.extra ? [...base, profile.extra] : base;
}

export function checklistKeysFor(type: VehicleType | string | undefined): string[] {
  return inspectionChecklistFor(type).flatMap((c) => c.items.map((i) => i.key));
}

export const FAILURE_REASONS = [
  "Brakes not effective",
  "Tire tread below minimum",
  "Lights / indicators not working",
  "VIN, chassis or engine number mismatch",
  "Structural / body damage",
  "Excessive exhaust emissions / noise",
  "Passenger safety equipment missing",
  "Coupling or load restraint defect",
  "Other — see notes",
];

export interface InspectionRequirementContext {
  transactionType: TransactionType;
  vehicleType?: VehicleType;
  /** Change-of-details only: a technical (engine, body, mass) change was requested. */
  technicalChange?: boolean;
}

/**
 * Inspection requirement rules (sample configuration — replace with the RTA policy table):
 * - transactions marked "always" (new, reclassification, reinstatement) always inspect;
 * - renewals inspect passenger-transport, commercial and towed heavy vehicles;
 * - change of vehicle details inspects when the change is technical.
 */
export const RENEWAL_INSPECTION_GROUPS: VehicleGroup[] = ["passenger_transport", "commercial", "towed"];

export function inspectionRequiredFor(ctx: InspectionRequirementContext): boolean {
  const def = getTransactionType(ctx.transactionType);
  if (def.inspection === "always") return true;
  if (def.inspection === "never") return false;
  if (ctx.transactionType === "change_vehicle") return !!ctx.technicalChange;
  return RENEWAL_INSPECTION_GROUPS.includes(getVehicleType(ctx.vehicleType).group);
}

export function inspectionRuleText(type: VehicleType | string | undefined, transactionType: TransactionType): string {
  const required = inspectionRequiredFor({ transactionType, vehicleType: type as VehicleType });
  if (!required) return "Not required for this transaction";
  if (transactionType === "renewal") return `Required on renewal for ${inspectionProfileFor(type).label.toLowerCase()}s`;
  return `Required for ${getTransactionType(transactionType).shortLabel.toLowerCase()}`;
}
