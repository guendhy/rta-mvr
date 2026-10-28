import type { BaseRecord, ISODate } from "./common";

export type PlateStatus = "available" | "reserved" | "assigned" | "released" | "damaged" | "lost" | "cancelled";

export interface Plate extends BaseRecord {
  plateNumber: string;
  type: "Motorcycle";
  officeId: string;
  status: PlateStatus;
  motorcycleId?: string;
  applicationId?: string;
  receivedDate: string;
  assignedDate?: ISODate;
  notes?: string;
}
