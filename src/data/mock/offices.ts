import type { InspectionCenter, Office } from "@/types";

const ts = "2024-01-15T08:00:00.000Z";

export const SEED_OFFICES: Office[] = [
  { id: "7d1b6b0e-1a5e-4c39-9a51-000000000001", name: "Port Moresby RTA", code: "POM", province: "National Capital District", district: "Moresby North-East", address: "Section 38, Allotment 5, Waigani Drive, Waigani", phone: "+675 300 1000", email: "pom.office@rta.gov.pg", status: "active", createdAt: ts, updatedAt: ts },
  { id: "7d1b6b0e-1a5e-4c39-9a51-000000000002", name: "Lae RTA", code: "LAE", province: "Morobe", district: "Lae", address: "Milfordhaven Road, Top Town, Lae", phone: "+675 472 2000", email: "lae.office@rta.gov.pg", status: "active", createdAt: ts, updatedAt: ts },
  { id: "7d1b6b0e-1a5e-4c39-9a51-000000000003", name: "Madang RTA", code: "MAD", province: "Madang", district: "Madang", address: "Modilon Road, Madang Town", phone: "+675 422 3000", email: "madang.office@rta.gov.pg", status: "active", createdAt: ts, updatedAt: ts },
  { id: "7d1b6b0e-1a5e-4c39-9a51-000000000004", name: "Mount Hagen RTA", code: "HGN", province: "Western Highlands", district: "Hagen Central", address: "Hagen Drive, Mount Hagen", phone: "+675 542 4000", email: "hagen.office@rta.gov.pg", status: "active", createdAt: ts, updatedAt: ts },
  { id: "7d1b6b0e-1a5e-4c39-9a51-000000000005", name: "Kokopo RTA", code: "KKP", province: "East New Britain", district: "Kokopo", address: "Williams Road, Kokopo", phone: "+675 982 5000", email: "kokopo.office@rta.gov.pg", status: "active", createdAt: ts, updatedAt: ts },
];

export const OFFICE_IDS = {
  POM: SEED_OFFICES[0].id,
  LAE: SEED_OFFICES[1].id,
  MAD: SEED_OFFICES[2].id,
  HGN: SEED_OFFICES[3].id,
  KKP: SEED_OFFICES[4].id,
};

/** Which office services a province in the seed data. */
export function officeForProvince(province: string): string {
  if (["Morobe"].includes(province)) return OFFICE_IDS.LAE;
  if (["Madang", "East Sepik", "West Sepik"].includes(province)) return OFFICE_IDS.MAD;
  if (["Western Highlands", "Southern Highlands", "Jiwaka", "Enga", "Eastern Highlands"].includes(province)) return OFFICE_IDS.HGN;
  if (["East New Britain", "West New Britain"].includes(province)) return OFFICE_IDS.KKP;
  return OFFICE_IDS.POM;
}

export const SEED_CENTERS: InspectionCenter[] = [
  { id: "a3c0d1f2-5b6e-4a7d-8c9b-000000000001", name: "Waigani Inspection Centre", code: "IC-POM-01", province: "National Capital District", district: "Moresby North-East", address: "Waigani Drive, behind RTA Head Office", status: "active", createdAt: ts, updatedAt: ts },
  { id: "a3c0d1f2-5b6e-4a7d-8c9b-000000000002", name: "Gordons Vehicle Testing Station", code: "IC-POM-02", province: "National Capital District", district: "Moresby North-West", address: "Kennedy Road, Gordons", status: "active", createdAt: ts, updatedAt: ts },
  { id: "a3c0d1f2-5b6e-4a7d-8c9b-000000000003", name: "Lae Inspection Centre", code: "IC-LAE-01", province: "Morobe", district: "Lae", address: "Independence Drive, Lae", status: "active", createdAt: ts, updatedAt: ts },
  { id: "a3c0d1f2-5b6e-4a7d-8c9b-000000000004", name: "Mount Hagen Testing Station", code: "IC-HGN-01", province: "Western Highlands", district: "Hagen Central", address: "Kuri Street, Mount Hagen", status: "active", createdAt: ts, updatedAt: ts },
  { id: "a3c0d1f2-5b6e-4a7d-8c9b-000000000005", name: "Kokopo Inspection Centre", code: "IC-KKP-01", province: "East New Britain", district: "Kokopo", address: "Bita Paka Road, Kokopo", status: "active", createdAt: ts, updatedAt: ts },
  { id: "a3c0d1f2-5b6e-4a7d-8c9b-000000000006", name: "Madang Testing Station", code: "IC-MAD-01", province: "Madang", district: "Madang", address: "Coastwatchers Avenue, Madang", status: "inactive", createdAt: ts, updatedAt: ts },
];

export function centerForOffice(officeId: string): string {
  switch (officeId) {
    case OFFICE_IDS.LAE: return SEED_CENTERS[2].id;
    case OFFICE_IDS.HGN: return SEED_CENTERS[3].id;
    case OFFICE_IDS.KKP: return SEED_CENTERS[4].id;
    case OFFICE_IDS.MAD: return SEED_CENTERS[5].id;
    default: return SEED_CENTERS[0].id;
  }
}
