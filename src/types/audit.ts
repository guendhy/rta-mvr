import type { ISODate } from "./common";
import type { RoleKey } from "./user";

export type AuditAction =
  | "login" | "logout" | "role_switched"
  | "registration_created" | "registration_updated" | "registration_submitted" | "registration_cancelled"
  | "owner_created" | "motorcycle_created"
  | "document_uploaded" | "document_verified" | "document_rejected"
  | "inspection_submitted" | "inspection_scheduled"
  | "insurance_verified" | "insurance_flagged"
  | "assessment_generated"
  | "payment_processed" | "payment_failed" | "payment_status_checked"
  | "registration_approved" | "registration_returned" | "registration_rejected"
  | "plate_assigned" | "plate_status_changed" | "plates_received"
  | "certificate_printed" | "receipt_printed" | "label_printed"
  | "renewal_created"
  | "fee_changed" | "settings_changed" | "permissions_changed"
  | "user_created" | "user_updated" | "user_status_changed"
  | "office_saved" | "terminal_saved" | "center_saved"
  | "demo_reset";

export interface AuditEvent {
  id: string;
  userId: string;
  userName: string;
  role: RoleKey;
  action: AuditAction;
  entity: string;
  recordId?: string;
  recordLabel?: string;
  description: string;
  timestamp: ISODate;
}

export type NotificationSeverity = "info" | "success" | "warning" | "danger";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  link?: string;
  read: boolean;
  createdAt: ISODate;
}
