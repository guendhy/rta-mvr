import type { DocumentType, ImportStatus, OwnershipType, TransactionType, VehicleGroup, VehicleType, VehicleUsage } from "@/types";
import { getVehicleType } from "./vehicle-types";

/**
 * Supporting-document catalogue and the rules that decide which are required. Administrators
 * edit the same structure under Administration → Requirements (Phase 2: `document_rules`).
 */
export const DOCUMENT_DEFS: Record<DocumentType, { label: string; help: string }> = {
  proof_of_identity: { label: "Proof of Identity", help: "Driver's licence, passport or national ID of the owner or authorized representative." },
  proof_of_ownership: { label: "Proof of Ownership", help: "Sales invoice, deed of sale or bill of sale." },
  purchase_receipt: { label: "Purchase Receipt / Invoice", help: "Dealer or private-sale receipt." },
  import_documentation: { label: "Import Documentation", help: "Bill of lading and export certificate for imported vehicles." },
  customs_clearance: { label: "Customs Clearance", help: "PNG Customs entry showing duty paid or exempted." },
  previous_registration: { label: "Previous Registration Certificate", help: "Current certificate for the vehicle on record." },
  inspection_certificate: { label: "Vehicle Inspection Certificate", help: "Issued automatically when the inspection passes." },
  insurance_certificate: { label: "Insurance Documentation", help: "Third-party (CTP) cover for the registration period — attached at insurance verification." },
  transfer_documents: { label: "Transfer Documents", help: "Transfer form signed by the seller and the buyer." },
  company_registration: { label: "Company Registration Documents", help: "IPA certificate of incorporation and letter of authority for the representative." },
  government_authorization: { label: "Government Authorization", help: "Departmental letter authorising the registration." },
  operating_permit: { label: "Operating Permit / Licence", help: "PMV route permit or taxi licence from the Land Transport Board." },
  diplomatic_clearance: { label: "Diplomatic Clearance", help: "DFA clearance for diplomatic registration." },
  police_report: { label: "Police Report / Statutory Declaration", help: "For lost or stolen certificates and plates." },
  other_supporting: { label: "Other Supporting Documents", help: "Any other document requested by the officer." },
};

export const DOCUMENT_TYPE_OPTIONS = (Object.keys(DOCUMENT_DEFS) as DocumentType[]).map((k) => ({ value: k, label: DOCUMENT_DEFS[k].label }));

export function documentLabel(type: DocumentType | string): string {
  return DOCUMENT_DEFS[type as DocumentType]?.label ?? String(type).replace(/_/g, " ");
}

export interface DocumentRequirementContext {
  transactionType: TransactionType;
  vehicleType?: VehicleType;
  vehicleUsage?: VehicleUsage;
  ownershipType?: OwnershipType;
  importStatus?: ImportStatus;
}

export interface DocumentRule {
  id: string;
  document: DocumentType;
  required: boolean;
  /** Empty / omitted = any. */
  transactionTypes?: TransactionType[];
  vehicleTypes?: VehicleType[];
  vehicleGroups?: VehicleGroup[];
  usages?: VehicleUsage[];
  ownershipTypes?: OwnershipType[];
  importStatuses?: ImportStatus[];
  reason: string;
  active: boolean;
}

const NEW_LIKE: TransactionType[] = ["new"];
const EXISTING_PROOF: TransactionType[] = ["transfer", "change_vehicle", "change_owner", "reclassification", "registration_transfer", "replacement_plate", "deregistration", "reinstatement"];
const ORGS: OwnershipType[] = ["company", "other_entity"];

/** Seed rules. Order matters only for display. */
export const DEFAULT_DOCUMENT_RULES: DocumentRule[] = [
  { id: "DR-01", document: "proof_of_identity", required: true, transactionTypes: ["new", "transfer", "change_vehicle", "change_owner", "replacement_certificate", "replacement_plate", "duplicate_certificate", "reclassification", "deregistration", "reinstatement", "registration_transfer", "other"], reason: "Owner or authorized representative", active: true },
  { id: "DR-02", document: "company_registration", required: true, ownershipTypes: ORGS, reason: "Ownership = Company / organization", active: true },
  { id: "DR-03", document: "government_authorization", required: true, ownershipTypes: ["government"], reason: "Ownership = Government agency", active: true },
  { id: "DR-04", document: "government_authorization", required: true, usages: ["government", "emergency"], reason: "Use = Government / emergency service", active: true },
  { id: "DR-05", document: "diplomatic_clearance", required: true, ownershipTypes: ["diplomatic"], reason: "Ownership = Diplomatic mission", active: true },
  { id: "DR-06", document: "proof_of_ownership", required: true, transactionTypes: NEW_LIKE, reason: "New registration", active: true },
  { id: "DR-07", document: "purchase_receipt", required: true, transactionTypes: NEW_LIKE, reason: "New registration", active: true },
  { id: "DR-08", document: "import_documentation", required: true, transactionTypes: NEW_LIKE, importStatuses: ["new_import", "used_import"], reason: "Imported vehicle", active: true },
  { id: "DR-09", document: "customs_clearance", required: true, transactionTypes: NEW_LIKE, importStatuses: ["new_import", "used_import"], reason: "Imported vehicle", active: true },
  { id: "DR-10", document: "previous_registration", required: true, transactionTypes: EXISTING_PROOF, reason: "Existing registration on record", active: true },
  { id: "DR-11", document: "transfer_documents", required: true, transactionTypes: ["transfer"], reason: "Signed by seller and buyer", active: true },
  { id: "DR-12", document: "proof_of_ownership", required: true, transactionTypes: ["transfer"], reason: "Bill of sale / deed of transfer", active: true },
  { id: "DR-13", document: "operating_permit", required: true, usages: ["pmv", "public_transport", "taxi"], transactionTypes: ["new", "renewal", "transfer", "reclassification", "reinstatement"], reason: "Use = PMV / taxi / public transport", active: true },
  { id: "DR-14", document: "police_report", required: true, transactionTypes: ["replacement_certificate", "replacement_plate"], reason: "Lost or stolen item", active: true },
  { id: "DR-15", document: "inspection_certificate", required: false, reason: "Generated from the inspection when it passes", active: true },
  { id: "DR-16", document: "insurance_certificate", required: false, transactionTypes: ["new", "renewal", "transfer", "reclassification", "reinstatement"], reason: "Attached at insurance verification", active: true },
  { id: "DR-17", document: "other_supporting", required: false, reason: "Optional", active: true },
];

function matchesRule(rule: DocumentRule, ctx: DocumentRequirementContext): boolean {
  if (!rule.active) return false;
  if (rule.transactionTypes?.length && !rule.transactionTypes.includes(ctx.transactionType)) return false;
  if (rule.vehicleTypes?.length && (!ctx.vehicleType || !rule.vehicleTypes.includes(ctx.vehicleType))) return false;
  if (rule.vehicleGroups?.length && (!ctx.vehicleType || !rule.vehicleGroups.includes(getVehicleType(ctx.vehicleType).group))) return false;
  if (rule.usages?.length && (!ctx.vehicleUsage || !rule.usages.includes(ctx.vehicleUsage))) return false;
  if (rule.ownershipTypes?.length && (!ctx.ownershipType || !rule.ownershipTypes.includes(ctx.ownershipType))) return false;
  if (rule.importStatuses?.length && (!ctx.importStatus || !rule.importStatuses.includes(ctx.importStatus))) return false;
  return true;
}

export interface ResolvedDocumentRequirement {
  type: DocumentType;
  required: boolean;
  reason: string;
}

/** Which documents apply. A document required by any matching rule is required. */
export function resolveDocumentRequirements(ctx: DocumentRequirementContext, rules: DocumentRule[] = DEFAULT_DOCUMENT_RULES): ResolvedDocumentRequirement[] {
  const out = new Map<DocumentType, ResolvedDocumentRequirement>();
  for (const rule of rules) {
    if (!matchesRule(rule, ctx)) continue;
    const prev = out.get(rule.document);
    if (!prev) out.set(rule.document, { type: rule.document, required: rule.required, reason: rule.reason });
    else if (rule.required && !prev.required) out.set(rule.document, { type: rule.document, required: true, reason: rule.reason });
  }
  return [...out.values()].sort((a, b) => Number(b.required) - Number(a.required));
}
