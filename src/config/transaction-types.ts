import type { TransactionType } from "@/types";

/**
 * Motor vehicle transaction catalogue. The selected transaction decides whether an existing
 * vehicle is looked up, which steps follow, and the default inspection / plate behaviour
 * (rule overrides per vehicle type live in `inspection-checklists.ts` and `fee-rules.ts`).
 */
export interface TransactionTypeDef {
  key: TransactionType;
  label: string;
  shortLabel: string;
  description: string;
  /** Starts from a vehicle already on the registry. */
  needsExistingVehicle: boolean;
  /** Owner and vehicle are captured from scratch. */
  capturesNewVehicle: boolean;
  /** Default — vehicle-specific rules may still require an inspection. */
  inspection: "always" | "by_rule" | "never";
  insurance: boolean;
  /** Issues a new plate on completion. */
  issuesPlate: boolean;
  /** Extends or restarts the registration period on completion. */
  renewsPeriod: boolean;
  /** Dedicated screen for this transaction, if any. */
  route?: string;
  /** Steps shown on the transaction-selection screen. */
  steps: string[];
  /** Dashboard / report bucket. */
  bucket: "new" | "renewal" | "transfer" | "replacement" | "other";
  /** Vehicle status the registry record moves to on completion. */
  resultingVehicleStatus?: "active" | "deregistered";
}

export const TRANSACTION_TYPES: TransactionTypeDef[] = [
  { key: "new", label: "New Vehicle Registration", shortLabel: "New Registration", description: "First registration of a vehicle in PNG", needsExistingVehicle: false, capturesNewVehicle: true, inspection: "always", insurance: true, issuesPlate: true, renewsPeriod: true, bucket: "new", resultingVehicleStatus: "active",
    steps: ["Registered owner", "Vehicle classification", "Vehicle details", "Supporting documents", "Inspection / verification", "Fee assessment", "Review application", "Payment", "Approval & certificate"] },
  { key: "renewal", label: "Registration Renewal", shortLabel: "Renewal", description: "Extend an existing registration", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "by_rule", insurance: true, issuesPlate: false, renewsPeriod: true, route: "/renewals", bucket: "renewal", resultingVehicleStatus: "active",
    steps: ["Find vehicle record", "Verify owner & vehicle", "Inspection if required", "Insurance", "Renewal fees & penalties", "Payment", "Approval", "Issue renewed registration"] },
  { key: "transfer", label: "Transfer of Ownership", shortLabel: "Transfer", description: "Vehicle sold or given to a new owner", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: true, issuesPlate: false, renewsPeriod: false, route: "/transfers", bucket: "transfer", resultingVehicleStatus: "active",
    steps: ["Find vehicle record", "Verify registration", "Current owner", "New owner", "Transfer documents", "Validation", "Fees", "Payment", "Approval", "Updated certificate"] },
  { key: "change_vehicle", label: "Change of Vehicle Details", shortLabel: "Change of Details", description: "Colour, engine, body or specification", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "by_rule", insurance: false, issuesPlate: false, renewsPeriod: false, bucket: "other",
    steps: ["Find vehicle record", "Changed details", "Supporting documents", "Inspection if technical", "Fees", "Payment", "Approval", "Updated certificate"] },
  { key: "change_owner", label: "Change of Owner Information", shortLabel: "Owner Details", description: "Address, contact or name correction", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: false, issuesPlate: false, renewsPeriod: false, bucket: "other",
    steps: ["Find vehicle record", "Update owner information", "Proof documents", "Fees", "Approval"] },
  { key: "replacement_certificate", label: "Replacement Registration Certificate", shortLabel: "Replacement Certificate", description: "Lost, stolen or damaged certificate", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: false, issuesPlate: false, renewsPeriod: false, bucket: "replacement",
    steps: ["Find vehicle record", "Verify identity", "Declaration", "Fees", "Payment", "Reprint certificate"] },
  { key: "duplicate_certificate", label: "Duplicate Certificate", shortLabel: "Duplicate Certificate", description: "Additional certified copy", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: false, issuesPlate: false, renewsPeriod: false, bucket: "replacement",
    steps: ["Find vehicle record", "Verify identity", "Fees", "Payment", "Print duplicate"] },
  { key: "replacement_plate", label: "Replacement Plate", shortLabel: "Replacement Plate", description: "Lost, stolen or damaged plate", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: false, issuesPlate: true, renewsPeriod: false, bucket: "replacement",
    steps: ["Find vehicle record", "Police report or plate return", "Fees", "Payment", "Assign plate", "Release old plate"] },
  { key: "reclassification", label: "Vehicle Reclassification", shortLabel: "Reclassification", description: "e.g. Private → Taxi, Van → PMV", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "always", insurance: true, issuesPlate: true, renewsPeriod: false, bucket: "other",
    steps: ["Find vehicle record", "New classification & use", "Documents & permits", "Inspection", "Fee difference", "Payment", "Approval", "Updated certificate & plate"] },
  { key: "deregistration", label: "Deregistration / Cancellation", shortLabel: "Deregistration", description: "Written off, exported or scrapped", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: false, issuesPlate: false, renewsPeriod: false, bucket: "other", resultingVehicleStatus: "deregistered",
    steps: ["Find vehicle record", "Reason & evidence", "Plate return", "Supervisor approval", "Record deregistered"] },
  { key: "reinstatement", label: "Registration Reinstatement", shortLabel: "Reinstatement", description: "Restore a suspended or cancelled record", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "always", insurance: true, issuesPlate: false, renewsPeriod: true, bucket: "other", resultingVehicleStatus: "active",
    steps: ["Find vehicle record", "Resolve cause", "Inspection", "Fees & penalties", "Payment", "Approval"] },
  { key: "registration_transfer", label: "Registration Transfer", shortLabel: "Registration Transfer", description: "Move registration to another province / office", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: false, issuesPlate: false, renewsPeriod: false, bucket: "other",
    steps: ["Find vehicle record", "New province & office", "Documents", "Fees", "Approval"] },
  { key: "other", label: "Other RTA Transaction", shortLabel: "Other", description: "Configured by RTA administrators", needsExistingVehicle: true, capturesNewVehicle: false, inspection: "never", insurance: false, issuesPlate: false, renewsPeriod: false, bucket: "other",
    steps: ["Describe request", "Documents", "Fees", "Approval"] },
];

const BY_KEY = new Map(TRANSACTION_TYPES.map((t) => [t.key, t]));

export function getTransactionType(key: TransactionType | string | undefined): TransactionTypeDef {
  return BY_KEY.get(key as TransactionType) ?? BY_KEY.get("other")!;
}

export function transactionLabel(key: TransactionType | string | undefined, short = false): string {
  if (!key) return "—";
  const def = getTransactionType(key);
  return short ? def.shortLabel : def.label;
}

export const TRANSACTION_TYPE_OPTIONS = TRANSACTION_TYPES.map((t) => ({ value: t.key, label: t.label }));

export const TRANSACTION_BUCKETS: { key: TransactionTypeDef["bucket"]; label: string }[] = [
  { key: "new", label: "New Registration" },
  { key: "renewal", label: "Renewal" },
  { key: "transfer", label: "Transfer" },
  { key: "replacement", label: "Replacement" },
  { key: "other", label: "Other" },
];

/** Where the "Start" button for a transaction goes. */
export function startRouteFor(key: TransactionType): string {
  const def = getTransactionType(key);
  if (def.route) return def.route;
  return key === "new" ? "/registrations/new?type=new" : `/registrations/new?type=${key}`;
}

/** Wizard step an existing-vehicle transaction opens on (2 owner · 3 classification · 4 vehicle · 5 documents). */
export function firstCaptureStep(key: TransactionType): number {
  switch (key) {
    case "new":
    case "transfer":
    case "change_owner":
      return 2;
    case "reclassification":
      return 3;
    case "change_vehicle":
    case "registration_transfer":
    case "deregistration":
    case "other":
      return 4;
    default:
      return 5;
  }
}
