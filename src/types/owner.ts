import type { BaseRecord } from "./common";

export type IdentificationType = "drivers_licence" | "passport" | "national_id" | "other_government_id";
export type Gender = "male" | "female" | "unspecified";

/** Who the vehicle is registered to. Organisation types use the organisation fields. */
export type OwnershipType = "individual" | "company" | "government" | "diplomatic" | "other_entity";

export interface Owner extends BaseRecord {
  ownershipType: OwnershipType;
  /** Individual: the person. Organisation: the authorized representative. */
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: Gender;
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
  /** Organisation, agency or mission name. */
  organizationName?: string;
  /** IPA company number, agency code or mission accreditation number. */
  organizationRegistrationNumber?: string;
  authorizedRepresentative?: string;
  representativePosition?: string;
  businessPhone?: string;
}

export type OwnerInput = Omit<Owner, "id" | "createdAt" | "updatedAt">;

export interface OwnerDuplicateMatch {
  owner: Owner;
  reasons: ("identification" | "mobile" | "name_dob" | "organization")[];
}
