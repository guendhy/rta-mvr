import type { BaseRecord } from "./common";

export interface Office extends BaseRecord {
  name: string;
  code: string;
  province: string;
  district: string;
  address: string;
  phone: string;
  email: string;
  status: "active" | "inactive";
}
