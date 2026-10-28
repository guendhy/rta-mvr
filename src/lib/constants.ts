import type {
  ChecklistCategoryDef,
  DocumentType,
  IdentificationType,
  InspectionStatus,
  InsuranceStatus,
  IntendedUse,
  PaymentMethod,
  PaymentStatus,
  PhotoSlot,
  PlateStatus,
  Province,
  RegistrationStatus,
  RoleKey,
  TerminalAdminStatus,
  TerminalStatus,
  MotorcycleRegistrationStatus,
  FuelType,
  ImportStatus,
  Gender,
} from "@/types";

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
  super_admin: "Super Admin",
  rta_admin: "RTA Admin",
  registration_officer: "Registration Officer",
  inspection_officer: "Inspection Officer",
  cashier: "Cashier",
  supervisor: "Supervisor",
  plate_officer: "Plate Officer",
  auditor: "Auditor",
};

export const ROLE_ORDER: RoleKey[] = [
  "super_admin",
  "rta_admin",
  "registration_officer",
  "inspection_officer",
  "cashier",
  "supervisor",
  "plate_officer",
  "auditor",
];

export type BadgeTone = "draft" | "pend" | "insp" | "assess" | "payq" | "ok" | "bad" | "susp";

export const REGISTRATION_STATUS: Record<RegistrationStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "draft" },
  pending: { label: "Pending", tone: "pend" },
  for_inspection: { label: "For Inspection", tone: "insp" },
  inspection_failed: { label: "Inspection Failed", tone: "bad" },
  for_insurance_verification: { label: "Insurance Verification", tone: "insp" },
  for_assessment: { label: "For Assessment", tone: "assess" },
  payment_required: { label: "Payment Required", tone: "payq" },
  paid: { label: "Paid", tone: "ok" },
  for_approval: { label: "For Approval", tone: "insp" },
  approved: { label: "Approved · Awaiting Plate", tone: "ok" },
  registered: { label: "Registered", tone: "ok" },
  returned: { label: "Returned", tone: "payq" },
  rejected: { label: "Rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "draft" },
};

export const MOTORCYCLE_STATUS: Record<MotorcycleRegistrationStatus, { label: string; tone: BadgeTone }> = {
  unregistered: { label: "Unregistered", tone: "draft" },
  registered: { label: "Registered", tone: "ok" },
  expired: { label: "Expired", tone: "bad" },
  suspended: { label: "Suspended", tone: "susp" },
  cancelled: { label: "Cancelled", tone: "draft" },
};

export const INSPECTION_STATUS: Record<InspectionStatus, { label: string; tone: BadgeTone }> = {
  not_inspected: { label: "Not Inspected", tone: "draft" },
  scheduled: { label: "Scheduled", tone: "pend" },
  in_progress: { label: "In Progress", tone: "insp" },
  passed: { label: "Passed", tone: "ok" },
  failed: { label: "Failed", tone: "bad" },
  reinspection_required: { label: "Reinspection Required", tone: "payq" },
};

export const INSURANCE_STATUS: Record<InsuranceStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "pend" },
  verified: { label: "Verified", tone: "ok" },
  expired: { label: "Expired", tone: "bad" },
  invalid: { label: "Invalid", tone: "bad" },
  rejected: { label: "Rejected", tone: "bad" },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone }> = {
  processing: { label: "Processing", tone: "insp" },
  successful: { label: "Successful", tone: "ok" },
  declined: { label: "Declined", tone: "bad" },
  timeout: { label: "Timeout", tone: "payq" },
  unknown: { label: "Status Unknown", tone: "payq" },
  failed: { label: "Failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "draft" },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pos: "POS Card",
  cash: "Cash",
  online: "Online Payment",
  bank_transfer: "Bank Transfer",
};

export const PLATE_STATUS: Record<PlateStatus, { label: string; tone: BadgeTone }> = {
  available: { label: "Available", tone: "ok" },
  reserved: { label: "Reserved", tone: "pend" },
  assigned: { label: "Assigned", tone: "insp" },
  released: { label: "Released", tone: "draft" },
  damaged: { label: "Damaged", tone: "payq" },
  lost: { label: "Lost", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "draft" },
};

export const TERMINAL_STATUS: Record<TerminalStatus, { label: string; tone: BadgeTone }> = {
  connected: { label: "Connected", tone: "ok" },
  connecting: { label: "Connecting", tone: "insp" },
  disconnected: { label: "Disconnected", tone: "draft" },
  offline: { label: "Offline", tone: "bad" },
  error: { label: "Device Error", tone: "bad" },
  unsupported: { label: "Unsupported", tone: "draft" },
  printer_error: { label: "Printer Error", tone: "payq" },
};

export const TERMINAL_ADMIN_STATUS: Record<TerminalAdminStatus, { label: string; tone: BadgeTone }> = {
  online: { label: "Online", tone: "ok" },
  idle: { label: "Idle", tone: "pend" },
  offline: { label: "Offline", tone: "bad" },
  maintenance: { label: "Maintenance", tone: "payq" },
  disabled: { label: "Disabled", tone: "draft" },
};

export const DOCUMENT_TYPES: { type: DocumentType; label: string; required: boolean; help: string }[] = [
  { type: "owner_identification", label: "Owner Identification", required: true, help: "Driver's licence, passport or national ID — front and back." },
  { type: "proof_of_ownership", label: "Proof of Ownership", required: true, help: "Sales invoice, deed of sale or previous registration." },
  { type: "import_purchase", label: "Import / Purchase Documents", required: true, help: "Customs entry or dealer purchase documents." },
  { type: "roadworthiness_certificate", label: "Roadworthiness Certificate", required: false, help: "Issued automatically when the inspection passes." },
  { type: "insurance_certificate", label: "Insurance Certificate", required: false, help: "Third-party certificate — attached at insurance verification." },
  { type: "other_supporting", label: "Other Supporting Documents", required: false, help: "Letters of authority, company registration, etc." },
];

export const REQUIRED_DOCUMENTS: DocumentType[] = DOCUMENT_TYPES.filter((d) => d.required).map((d) => d.type);

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

export const INTENDED_USES: { value: IntendedUse; label: string }[] = [
  { value: "private", label: "Private" },
  { value: "commercial", label: "Commercial" },
  { value: "government", label: "Government" },
  { value: "other", label: "Other" },
];

export const FUEL_TYPES: { value: FuelType; label: string }[] = [
  { value: "petrol", label: "Petrol" },
  { value: "diesel", label: "Diesel" },
  { value: "electric", label: "Electric" },
  { value: "hybrid", label: "Hybrid" },
];

export const IMPORT_STATUSES: { value: ImportStatus; label: string }[] = [
  { value: "new_import", label: "New import" },
  { value: "used_import", label: "Used import" },
  { value: "locally_assembled", label: "Locally assembled" },
  { value: "local_resale", label: "Local resale" },
];

export const BODY_TYPES = ["Standard", "Off-road / Trail", "Scooter", "Underbone", "Cruiser", "Sport", "Tricycle (Sidecar)"];

export const MAKES: Record<string, string[]> = {
  Honda: ["XR150L", "CB125F", "Wave 110", "CRF250L", "CG125"],
  Yamaha: ["YBR125", "XTZ125", "Crypton", "AG200", "FZ150"],
  Suzuki: ["GN125", "DR200", "TF125", "AX100"],
  Kawasaki: ["KLX150", "KLR650", "Barako 175"],
  Bajaj: ["Boxer 150", "Pulsar 180", "Discover 125"],
  TVS: ["Apache 160", "HLX 125", "Star City"],
  Haojue: ["DK150", "HJ125"],
};

export const MOTORCYCLE_COLORS = ["Red", "Black", "Blue", "White", "Silver", "Green", "Yellow", "Orange", "Grey"];

export const COUNTRIES_OF_MANUFACTURE = ["Japan", "Thailand", "India", "China", "Indonesia", "Malaysia", "Philippines", "Vietnam", "Other"];

export const INSURANCE_PROVIDERS = [
  "Motor Vehicles Insurance Limited (MVIL)",
  "Capital Insurance Group",
  "Tower Insurance PNG",
  "Pacific MMI Insurance",
  "Hollard Insurance PNG",
];

export const PHOTO_SLOTS: { slot: PhotoSlot; label: string }[] = [
  { slot: "front", label: "Front" },
  { slot: "rear", label: "Rear" },
  { slot: "left", label: "Left side" },
  { slot: "right", label: "Right side" },
  { slot: "engine_number", label: "Engine number" },
  { slot: "chassis_number", label: "Chassis number" },
];

export const INSPECTION_CHECKLIST: ChecklistCategoryDef[] = [
  { key: "identification", label: "Identification", items: [
    { key: "engine_match", label: "Engine Number Matches" },
    { key: "chassis_match", label: "Chassis Number Matches" },
  ] },
  { key: "tires", label: "Tires", items: [
    { key: "front_tire", label: "Front Tire" },
    { key: "rear_tire", label: "Rear Tire" },
  ] },
  { key: "brakes", label: "Brakes", items: [
    { key: "front_brake", label: "Front Brake" },
    { key: "rear_brake", label: "Rear Brake" },
  ] },
  { key: "lights", label: "Lights", items: [
    { key: "headlight", label: "Headlight" },
    { key: "brake_light", label: "Brake Light" },
    { key: "left_indicator", label: "Left Indicator" },
    { key: "right_indicator", label: "Right Indicator" },
  ] },
  { key: "electrical", label: "Electrical", items: [
    { key: "horn", label: "Horn" },
    { key: "battery", label: "Battery" },
  ] },
  { key: "body", label: "Body & Safety", items: [
    { key: "frame", label: "Frame" },
    { key: "suspension", label: "Suspension" },
    { key: "mirrors", label: "Mirrors" },
    { key: "seat", label: "Seat" },
    { key: "exhaust", label: "Exhaust" },
  ] },
];

export const CHECKLIST_KEYS = INSPECTION_CHECKLIST.flatMap((c) => c.items.map((i) => i.key));

export const FAILURE_REASONS = [
  "Brakes not effective",
  "Tire tread below minimum",
  "Lights / indicators not working",
  "Engine or chassis number mismatch",
  "Frame or suspension damage",
  "Excessive exhaust emissions / noise",
  "Other — see notes",
];

export const DECLINE_REASONS = ["Insufficient funds", "Card expired", "Do not honour", "Incorrect PIN"];

export const WIZARD_STEPS = [
  { n: 1, key: "owner", label: "Owner" },
  { n: 2, key: "motorcycle", label: "Motorcycle" },
  { n: 3, key: "documents", label: "Documents" },
  { n: 4, key: "inspection", label: "Inspection" },
  { n: 5, key: "insurance", label: "Insurance" },
  { n: 6, key: "assessment", label: "Assessment" },
  { n: 7, key: "payment", label: "Payment" },
  { n: 8, key: "approval", label: "Approval" },
] as const;

export const PAGE_SIZES = [25, 50, 100];
