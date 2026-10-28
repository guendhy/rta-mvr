import type { BaseRecord, ISODate } from "./common";

export type RoleKey =
  | "super_admin"
  | "rta_admin"
  | "registration_officer"
  | "verification_officer"
  | "inspection_officer"
  | "cashier"
  | "supervisor"
  | "plate_officer"
  | "auditor";

export type Permission =
  | "dashboard.view"
  | "registration.view"
  | "registration.create"
  | "registration.edit"
  | "documents.view"
  | "documents.verify"
  | "registry.view"
  | "renewal.view"
  | "renewal.create"
  | "transfer.view"
  | "transfer.create"
  | "inspection.view"
  | "inspection.submit"
  | "insurance.view"
  | "insurance.verify"
  | "assessment.generate"
  | "payment.view"
  | "payment.process"
  | "approval.view"
  | "approval.decide"
  | "plates.view"
  | "plates.assign"
  | "plates.manage"
  | "reports.view"
  | "users.manage"
  | "roles.manage"
  | "offices.manage"
  | "terminals.manage"
  | "fees.manage"
  | "vehicle_config.manage"
  | "requirements.manage"
  | "centers.manage"
  | "settings.manage"
  | "audit.view";

export type RolePermissionMatrix = Record<RoleKey, Permission[]>;

export interface Role {
  key: RoleKey;
  name: string;
  description: string;
  readOnly?: boolean;
}

export type UserStatus = "active" | "disabled";

export interface User extends BaseRecord {
  firstName: string;
  lastName: string;
  email: string;
  /** Demo only — never store plain passwords outside the mock backend. */
  password: string;
  employeeNumber: string;
  role: RoleKey;
  officeId: string;
  phone: string;
  status: UserStatus;
  lastLoginAt?: ISODate;
}

export type SafeUser = Omit<User, "password">;

export interface Session {
  userId: string;
  /** QA role override from the demo role switcher; defaults to the user's own role. */
  activeRole: RoleKey;
  startedAt: ISODate;
}
