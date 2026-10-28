import type { IdentificationType, PhotoSlot, Province, RoleKey, Gender } from "@/types";

export {
  REGISTRATION_STATUS,
  VEHICLE_STATUS,
  INSPECTION_STATUS,
  INSURANCE_STATUS,
  PAYMENT_STATUS,
  PLATE_STATUS,
  TERMINAL_STATUS,
  TERMINAL_ADMIN_STATUS,
  getStatusLabel,
  getStatusVariant,
  type BadgeTone,
} from "@/config/statuses";
export { PAYMENT_METHOD_LABELS } from "@/config/payment-channels";
export { FUEL_TYPES, IMPORT_STATUSES, VEHICLE_COLORS, COUNTRIES_OF_MANUFACTURE, VEHICLE_USAGES } from "@/config/vehicle-usage";
export { FAILURE_REASONS } from "@/config/inspection-checklists";

export const PROVINCES: Province[] = [
  { code: "NCD", name: "National Capital District", districts: ["Moresby North-East", "Moresby North-West", "Moresby South"] },
  { code: "CEN", name: "Central", districts: ["Abau", "Goilala", "Kairuku-Hiri", "Rigo"] },
  { code: "MOR", name: "Morobe", districts: ["Lae", "Huon Gulf", "Markham", "Bulolo", "Nawae", "Finschhafen"] },
  { code: "MAD", name: "Madang", districts: ["Madang", "Bogia", "Sumkar", "Usino Bundi", "Middle Ramu"] },
  { code: "EHP", name: "Eastern Highlands", districts: ["Goroka", "Kainantu", "Henganofi", "Lufa", "Okapa"] },
  { code: "WHL", name: "Western Highlands", districts: ["Hagen Central", "Mul-Baiyer", "Tambul-Nebilyer", "Dei"] },
  { code: "SHP", name: "Southern Highlands", districts: ["Mendi-Munihu", "Ialibu-Pangia", "Imbonggu", "Kagua-Erave", "Nipa-Kutubu"] },
  { code: "JIW", name: "Jiwaka", districts: ["Anglimp-South Wahgi", "Jimi", "North Wahgi"] },
  { code: "ENG", name: "Enga", districts: ["Wabag", "Kandep", "Lagaip", "Kompiam-Ambum", "Wapenamanda"] },
  { code: "ENB", name: "East New Britain", districts: ["Kokopo", "Rabaul", "Gazelle", "Pomio"] },
  { code: "WNB", name: "West New Britain", districts: ["Talasea", "Kandrian-Gloucester"] },
  { code: "ESP", name: "East Sepik", districts: ["Wewak", "Maprik", "Angoram", "Yangoru-Saussia", "Ambunti-Drekikier"] },
  { code: "WSP", name: "West Sepik", districts: ["Vanimo-Green River", "Aitape-Lumi", "Nuku", "Telefomin"] },
  { code: "MBA", name: "Milne Bay", districts: ["Alotau", "Esa'ala", "Kiriwina-Goodenough", "Samarai-Murua"] },
  { code: "ORO", name: "Oro", districts: ["Ijivitari", "Sohe"] },
  { code: "GUL", name: "Gulf", districts: ["Kerema", "Kikori"] },
];

export const PROVINCE_NAMES = PROVINCES.map((p) => p.name);

export function provinceCode(name: string | undefined): string {
  return PROVINCES.find((p) => p.name === name)?.code ?? "NCD";
}

export function districtsFor(province: string | undefined): string[] {
  return PROVINCES.find((p) => p.name === province)?.districts ?? [];
}

/** LLG list per district is simulated — real data arrives with the backend. */
export function llgsFor(district: string | undefined): string[] {
  if (!district) return [];
  return [`${district} Urban LLG`, `${district} Rural LLG`, `${district} North LLG`, `${district} South LLG`];
}

export const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: "Super Administrator",
  rta_admin: "RTA Administrator",
  registration_officer: "Registration Officer",
  verification_officer: "Verification Officer",
  inspection_officer: "Vehicle Inspector",
  cashier: "Cashier / Payment Officer",
  supervisor: "Supervisor / Approver",
  plate_officer: "Plate Officer",
  auditor: "Reporting / Audit User",
};

export const ROLE_ORDER: RoleKey[] = [
  "super_admin",
  "rta_admin",
  "registration_officer",
  "verification_officer",
  "inspection_officer",
  "cashier",
  "supervisor",
  "plate_officer",
  "auditor",
];

export const IDENTIFICATION_TYPES: { value: IdentificationType; label: string }[] = [
  { value: "drivers_licence", label: "Driver's Licence" },
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "other_government_id", label: "Other Government ID" },
];

export const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unspecified", label: "Prefer not to say" },
];

export const INSURANCE_PROVIDERS = [
  "Motor Vehicles Insurance Limited (MVIL)",
  "Capital Insurance Group",
  "Tower Insurance PNG",
  "Pacific MMI Insurance",
  "Hollard Insurance PNG",
];

export const PHOTO_SLOTS: { slot: PhotoSlot; label: string; engineOnly?: boolean }[] = [
  { slot: "front", label: "Front" },
  { slot: "rear", label: "Rear" },
  { slot: "left", label: "Left side" },
  { slot: "right", label: "Right side" },
  { slot: "interior", label: "Interior" },
  { slot: "vin_plate", label: "VIN / compliance plate" },
  { slot: "engine_number", label: "Engine number", engineOnly: true },
  { slot: "chassis_number", label: "Chassis number" },
];

export const DECLINE_REASONS = ["Insufficient funds", "Card expired", "Do not honour", "Incorrect PIN"];

/** New-registration wizard. Steps 1–5 capture data; 6–10 follow the workflow status. */
export const WIZARD_STEPS = [
  { n: 1, key: "transaction", label: "Transaction" },
  { n: 2, key: "owner", label: "Owner" },
  { n: 3, key: "classification", label: "Classification" },
  { n: 4, key: "vehicle", label: "Vehicle Details" },
  { n: 5, key: "documents", label: "Documents" },
  { n: 6, key: "inspection", label: "Inspection" },
  { n: 7, key: "assessment", label: "Fee Assessment" },
  { n: 8, key: "review", label: "Review" },
  { n: 9, key: "payment", label: "Payment" },
  { n: 10, key: "approval", label: "Approval" },
] as const;

/** Last step that captures data (and is editable while the application is a draft). */
export const LAST_CAPTURE_STEP = 5;

export const PAGE_SIZES = [25, 50, 100];
