import type { OwnershipType } from "@/types";

export const OWNERSHIP_TYPES: { value: OwnershipType; label: string; description: string; organization: boolean; orgNameLabel: string; orgNumberLabel: string }[] = [
  { value: "individual", label: "Individual", description: "A private person", organization: false, orgNameLabel: "", orgNumberLabel: "" },
  { value: "company", label: "Company / Organization", description: "IPA-registered company, NGO or association", organization: true, orgNameLabel: "Organization Name", orgNumberLabel: "IPA Registration Number" },
  { value: "government", label: "Government Agency", description: "National, provincial or local government", organization: true, orgNameLabel: "Agency / Department Name", orgNumberLabel: "Agency Code" },
  { value: "diplomatic", label: "Diplomatic Mission", description: "Embassy, high commission or international organisation", organization: true, orgNameLabel: "Mission Name", orgNumberLabel: "DFA Accreditation Number" },
  { value: "other_entity", label: "Other Entity", description: "Church, school, trust or other body", organization: true, orgNameLabel: "Entity Name", orgNumberLabel: "Registration / Reference Number" },
];

export function ownershipTypeDef(value: OwnershipType | string | undefined) {
  return OWNERSHIP_TYPES.find((o) => o.value === value) ?? OWNERSHIP_TYPES[0];
}

export function isOrganization(value: OwnershipType | string | undefined): boolean {
  return ownershipTypeDef(value).organization;
}

export function ownershipTypeLabel(value: OwnershipType | string | undefined): string {
  return ownershipTypeDef(value).label;
}
