import type { BaseRecord } from "./common";

export type IdentificationType = "drivers_licence" | "passport" | "national_id" | "other_government_id";
export type Gender = "male" | "female" | "unspecified";

export interface Owner extends BaseRecord {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  nationality: string;
  identificationType: IdentificationType;
  identificationNumber: string;
  mobile: string;
  email?: string;
  province: string;
  district: string;
  llg: string;
  ward?: string;
  street: string;
  postalAddress?: string;
}

export type OwnerInput = Omit<Owner, "id" | "createdAt" | "updatedAt">;

export interface OwnerDuplicateMatch {
  owner: Owner;
  reasons: ("identification" | "mobile" | "name_dob")[];
}
