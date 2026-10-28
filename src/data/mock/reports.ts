import type { ReportKey } from "@/types";

/** Report catalogue shown on the Reports page. Data is computed by the report service. */
export const REPORT_CATALOG: { key: ReportKey; title: string; description: string; group: string }[] = [
  { key: "registration_summary", title: "Registration Summary", description: "Applications by status, type and office.", group: "Registration" },
  { key: "registration_expiry", title: "Registration Expiry", description: "Registrations expired or expiring soon.", group: "Registration" },
  { key: "revenue_collection", title: "Revenue Collection", description: "Successful payments by channel.", group: "Revenue" },
  { key: "cash_collection", title: "Cash Collection", description: "Cash receipts with tendered and change amounts.", group: "Revenue" },
  { key: "pos_transactions", title: "POS Transactions", description: "All POS card attempts by terminal.", group: "Revenue" },
  { key: "payment_history", title: "Payment History", description: "Every payment attempt across methods.", group: "Revenue" },
  { key: "failed_payments", title: "Failed Payments", description: "Declined, timed out and unknown payments.", group: "Revenue" },
  { key: "inspection_report", title: "Inspection Report", description: "Roadworthiness inspections and results.", group: "Inspection" },
  { key: "failed_inspections", title: "Failed Inspection Report", description: "Failed inspections and failure reasons.", group: "Inspection" },
  { key: "plate_inventory", title: "Plate Inventory", description: "Plates by status and office.", group: "Plates" },
  { key: "officer_activity", title: "Officer Activity", description: "Actions recorded per officer.", group: "Audit" },
  { key: "audit_report", title: "Audit Report", description: "Full audit trail with filters.", group: "Audit" },
];
