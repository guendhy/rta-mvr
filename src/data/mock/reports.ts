import type { ReportFilterField, ReportKey } from "@/types";

export interface ReportCatalogEntry {
  key: ReportKey;
  title: string;
  description: string;
  group: string;
  /** Filters that apply to this report (others are hidden on the Reports page). */
  filters: ReportFilterField[];
  /** Which date the Date Range filter applies to. */
  dateLabel?: string;
}

const VEHICLE: ReportFilterField[] = ["date", "vehicleType", "registrationStatus", "province", "officeId"];
const TXN: ReportFilterField[] = ["date", "vehicleType", "province", "officeId", "officerId", "status"];
const PAY: ReportFilterField[] = ["date", "vehicleType", "transactionType", "province", "officeId", "officerId", "paymentMethod"];

/** Report catalogue shown on the Reports page. Data is computed by the report service from the mock records. */
export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { key: "registered_vehicles", title: "Total Registered Vehicles", description: "Every vehicle on the registry with its current registration status.", group: "Registry", filters: VEHICLE, dateLabel: "Registration date" },
  { key: "registrations_by_vehicle_type", title: "Registrations by Vehicle Type", description: "Registry totals by vehicle type bucket and registration status.", group: "Registry", filters: VEHICLE, dateLabel: "Registration date" },
  { key: "registrations_by_province", title: "Registrations by Province", description: "Registry totals by province of operation and registration status.", group: "Registry", filters: ["date", "vehicleType", "registrationStatus", "officeId"], dateLabel: "Registration date" },
  { key: "expired_registrations", title: "Expired Registrations", description: "Vehicles whose registration has passed its expiry date.", group: "Registry", filters: ["date", "vehicleType", "province", "officeId"], dateLabel: "Expiry date" },
  { key: "due_for_renewal", title: "Vehicles Due for Renewal", description: "Active registrations inside the Expiring Soon window.", group: "Registry", filters: ["date", "vehicleType", "province", "officeId"], dateLabel: "Expiry date" },
  { key: "new_registrations", title: "New Registrations", description: "New vehicle registration transactions.", group: "Transactions", filters: TXN, dateLabel: "Date started" },
  { key: "renewals", title: "Renewals", description: "Registration renewal transactions.", group: "Transactions", filters: TXN, dateLabel: "Date started" },
  { key: "transfers", title: "Transfers", description: "Transfer of ownership transactions — previous owners are retained.", group: "Transactions", filters: TXN, dateLabel: "Date started" },
  { key: "registration_summary", title: "All Transactions", description: "Every motor vehicle transaction by type, status and office.", group: "Transactions", filters: [...TXN, "transactionType"], dateLabel: "Date started" },
  { key: "inspection_report", title: "Inspection Results", description: "Roadworthiness inspections and results by vehicle type.", group: "Inspection", filters: ["date", "vehicleType", "transactionType", "province", "officeId", "officerId", "status"], dateLabel: "Inspection date" },
  { key: "failed_inspections", title: "Failed Inspections", description: "Failed inspections and failure reasons.", group: "Inspection", filters: ["date", "vehicleType", "transactionType", "province", "officeId", "officerId"], dateLabel: "Inspection date" },
  { key: "revenue_collection", title: "Revenue Collection", description: "Successful payments with receipts.", group: "Revenue", filters: PAY, dateLabel: "Payment date" },
  { key: "revenue_by_transaction_type", title: "Revenue by Transaction Type", description: "Collections by transaction type, split by fee component.", group: "Revenue", filters: ["date", "vehicleType", "province", "officeId", "paymentMethod"], dateLabel: "Payment date" },
  { key: "revenue_by_vehicle_type", title: "Revenue by Vehicle Type", description: "Collections by vehicle type bucket.", group: "Revenue", filters: ["date", "transactionType", "province", "officeId", "paymentMethod"], dateLabel: "Payment date" },
  { key: "payment_method_breakdown", title: "Payment Method Breakdown", description: "Attempts, success rate and collections per payment channel.", group: "Revenue", filters: ["date", "vehicleType", "transactionType", "province", "officeId", "officerId"], dateLabel: "Payment date" },
  { key: "failed_payments", title: "Failed Transactions", description: "Declined, timed out, cancelled and unknown payment attempts.", group: "Revenue", filters: [...PAY, "status"], dateLabel: "Attempt date" },
  { key: "cash_collection", title: "Cash Collection", description: "Cash receipts with tendered and change amounts.", group: "Revenue", filters: ["date", "vehicleType", "transactionType", "officeId", "officerId"], dateLabel: "Payment date" },
  { key: "pos_transactions", title: "POS Transactions", description: "All POS card attempts by terminal.", group: "Revenue", filters: ["date", "vehicleType", "transactionType", "officeId", "officerId", "status"], dateLabel: "Attempt date" },
  { key: "payment_history", title: "Payment History", description: "Every payment attempt across methods.", group: "Revenue", filters: [...PAY, "status"], dateLabel: "Attempt date" },
  { key: "plate_inventory", title: "Plate Inventory by Category", description: "Plates by category, status and office.", group: "Plates", filters: ["date", "officeId", "status"], dateLabel: "Received date" },
  { key: "officer_activity", title: "Officer Activity", description: "Actions recorded per officer.", group: "Audit", filters: ["date", "officeId", "officerId"], dateLabel: "Activity date" },
  { key: "audit_report", title: "Audit Report", description: "Full audit trail with filters.", group: "Audit", filters: ["date", "officeId", "officerId", "status"], dateLabel: "Event date" },
];

/** Reports reachable by URL but not listed (kept for old links). */
export const REPORT_ALIASES: Partial<Record<ReportKey, ReportKey>> = { registration_expiry: "due_for_renewal" };
