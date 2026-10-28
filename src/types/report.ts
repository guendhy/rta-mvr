export type ReportKey =
  | "registered_vehicles"
  | "registrations_by_vehicle_type"
  | "registrations_by_province"
  | "new_registrations"
  | "renewals"
  | "transfers"
  | "expired_registrations"
  | "due_for_renewal"
  | "revenue_by_transaction_type"
  | "revenue_by_vehicle_type"
  | "payment_method_breakdown"
  | "registration_summary"
  | "revenue_collection"
  | "cash_collection"
  | "pos_transactions"
  | "payment_history"
  | "failed_payments"
  | "inspection_report"
  | "failed_inspections"
  | "plate_inventory"
  | "registration_expiry"
  | "officer_activity"
  | "audit_report";

export interface ReportFilters {
  from?: string;
  to?: string;
  province?: string;
  officeId?: string;
  officerId?: string;
  status?: string;
  paymentMethod?: string;
  vehicleType?: string;
  transactionType?: string;
  registrationStatus?: string;
}

/** Filters a report understands — the Reports page only shows these. */
export type ReportFilterField = "date" | "vehicleType" | "registrationStatus" | "transactionType" | "province" | "officeId" | "officerId" | "status" | "paymentMethod";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
  /** Numeric value formatted as Kina. */
  money?: boolean;
}

export interface ReportResult {
  key: ReportKey;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summary: { label: string; value: string }[];
  chart?: { type: "bar" | "pie"; data: { name: string; value: number }[]; valueFormat: "money" | "count" };
  statusOptions: string[];
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface CountDatum {
  key: string;
  label: string;
  count: number;
}

export interface DashboardStats {
  totalVehicles: number;
  activeRegistrations: number;
  expiringRegistrations: number;
  expiredRegistrations: number;
  newToday: number;
  renewalsToday: number;
  transfersToday: number;
  failedOrPendingPayments: number;
  /** Chart-ready datasets. */
  vehicleTypeDistribution: CountDatum[];
  registrationStatusDistribution: CountDatum[];
  /** Transactions started in the last 30 days, by TRANSACTION_BUCKETS. */
  transactionTypeDistribution: CountDatum[];
  /** Same buckets, today only. */
  transactionTypeDistributionToday: CountDatum[];
  /** Vehicle type buckets counting only Active / Expiring Soon registrations. */
  activeVehicleTypeDistribution: CountDatum[];
  /** Successful payments today by method. */
  collectionsToday: { method: string; label: string; amount: number; count: number }[];
  /** Window used for "Expiring Soon" (settings.registration.expiringSoonDays). */
  expiringSoonDays: number;
  registrationsToday: number;
  pendingApplications: number;
  awaitingInspection: number;
  awaitingPayment: number;
  awaitingApproval: number;
  awaitingPlate: number;
  completedToday: number;
  revenueToday: number;
  paymentsToday: number;
  failedInspections: number;
  availablePlates: number;
  revenueByMethod: { method: string; label: string; amount: number }[];
  statusDistribution: { status: string; label: string; count: number }[];
  transactions: { daily: TrendPoint[]; weekly: TrendPoint[]; monthly: TrendPoint[] };
}
