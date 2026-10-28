/** ISO-8601 timestamp string. */
export type ISODate = string;

/** Fields every persisted record carries — mirrors future Postgres columns. */
export interface BaseRecord {
  id: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type ProvinceCode =
  | "NCD" | "CEN" | "MOR" | "MAD" | "EHP" | "WHL" | "SHP" | "JIW"
  | "ENG" | "ENB" | "WNB" | "ESP" | "WSP" | "MBA" | "ORO" | "GUL";

export interface Province {
  code: ProvinceCode;
  name: string;
  districts: string[];
}

export type FileMeta = {
  name: string;
  size: number;
  type: string;
  uploadedAt: ISODate;
};
