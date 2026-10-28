import type { BaseRecord, ISODate } from "./common";
import type { PlateCategory } from "./vehicle";

export type PlateStatus = "available" | "reserved" | "assigned" | "released" | "damaged" | "lost" | "cancelled";

export interface Plate extends BaseRecord {
  plateNumber: string;
  /** Plate series — private, commercial, PMV, motorcycle, trailer, … */
  category: PlateCategory;
  officeId: string;
  status: PlateStatus;
  vehicleId?: string;
  applicationId?: string;
  receivedDate: string;
  assignedDate?: ISODate;
  notes?: string;
}
