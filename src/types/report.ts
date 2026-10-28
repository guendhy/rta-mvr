export type ReportKey =
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
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  mono?: boolean;
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

export interface DashboardStats {
  registrationsToday: number;
  pendingApplications: number;
  awaitingInspection: number;
  awaitingPayment: number;
  awaitingApproval: number;
  awaitingPlate: number;
  completedToday: number;
  revenueToday: number;
  paymentsToday: number;
  expiringRegistrations: number;
  failedInspections: number;
  availablePlates: number;
  revenueByMethod: { method: string; label: string; amount: number }[];
  statusDistribution: { status: string; label: string; count: number }[];
  transactions: { daily: TrendPoint[]; weekly: TrendPoint[]; monthly: TrendPoint[] };
}
