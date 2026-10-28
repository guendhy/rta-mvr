import type { Gender, IdentificationType, Owner } from "@/types";

/** Fictional Papua New Guinea owners. Any resemblance to real people is coincidental. */
type OwnerSeed = [
  first: string, middle: string, last: string, dob: string, gender: Gender,
  idType: IdentificationType, idNumber: string, mobile: string,
  province: string, district: string, street: string, postal: string,
];

const OWNERS: OwnerSeed[] = [
  ["John", "Mareva", "Kila", "1988-03-14", "male", "drivers_licence", "DL-POM-0482196", "+675 7123 4842", "National Capital District", "Moresby North-East", "Section 14, Lot 22, Gerehu Stage 2", "PO Box 1187, Boroko"],
  ["Mary", "", "Tau", "1992-07-02", "female", "national_id", "NID-1902-554120", "+675 7230 1188", "National Capital District", "Moresby South", "Allotment 9, Hohola", "PO Box 402, Waigani"],
  ["Ruth", "Iamo", "Gaba", "1985-11-23", "female", "drivers_licence", "DL-CEN-0177342", "+675 7012 7741", "Central", "Kairuku-Hiri", "Bautama Village", ""],
  ["Joseph", "Ani", "Wanpis", "1979-01-30", "male", "passport", "P-PNG-7718203", "+675 7345 9021", "Morobe", "Lae", "Section 5, Lot 11, Eriku", "PO Box 2210, Lae"],
  ["Anna", "", "Bire", "1995-05-18", "female", "national_id", "NID-1905-883104", "+675 7456 3320", "Morobe", "Bulolo", "Wau Road, Bulolo Station", ""],
  ["Samuel", "Kaul", "Kewa", "1983-09-09", "male", "drivers_licence", "DL-MAD-0290118", "+675 7567 2209", "Madang", "Madang", "Modilon Hill, Lot 3", "PO Box 88, Madang"],
  ["Helen", "", "Naime", "1990-12-01", "female", "national_id", "NID-1912-120776", "+675 7678 4410", "Gulf", "Kerema", "Kerema Town, Section 2", ""],
  ["David", "Ika", "Yalu", "1987-04-27", "male", "drivers_licence", "DL-EHP-0381925", "+675 7789 1133", "Eastern Highlands", "Goroka", "North Goroka, Lot 47", "PO Box 501, Goroka"],
  ["Esther", "Kopi", "Mond", "1993-08-15", "female", "drivers_licence", "DL-WHP-0466710", "+675 7890 6655", "Western Highlands", "Hagen Central", "Kagamuga Road, Lot 12", "PO Box 300, Mount Hagen"],
  ["Paul", "", "Kerenga", "1975-02-11", "male", "other_government_id", "PSID-0091283", "+675 7901 2290", "Western Highlands", "Tambul-Nebilyer", "Tambul Station", ""],
  ["Grace", "Liria", "Sapau", "1998-06-06", "female", "national_id", "NID-1906-310552", "+675 7112 8854", "Southern Highlands", "Mendi-Munihu", "Mendi Town, Section 4", ""],
  ["Michael", "Ken", "Kuman", "1984-10-19", "male", "drivers_licence", "DL-JIW-0128876", "+675 7223 0098", "Jiwaka", "North Wahgi", "Banz Station, Lot 6", "PO Box 19, Banz"],
  ["Rose", "", "Lapan", "1991-03-03", "female", "national_id", "NID-1903-772910", "+675 7334 7712", "Enga", "Wabag", "Wabag Town, Section 1", ""],
  ["Francis", "Tovue", "ToPurana", "1980-07-28", "male", "drivers_licence", "DL-ENB-0217734", "+675 7445 3367", "East New Britain", "Kokopo", "Takubar, Lot 15", "PO Box 270, Kokopo"],
  ["Lynette", "", "Tavul", "1996-01-12", "female", "passport", "P-PNG-8820145", "+675 7556 9081", "East New Britain", "Rabaul", "Malaguna Road, Rabaul", ""],
  ["Benjamin", "Sau", "Kaio", "1989-09-30", "male", "drivers_licence", "DL-WNB-0093312", "+675 7667 4425", "West New Britain", "Talasea", "Kimbe Town, Section 8", "PO Box 155, Kimbe"],
  ["Agnes", "", "Wamo", "1994-11-08", "female", "national_id", "NID-1911-440187", "+675 7778 2203", "East Sepik", "Wewak", "Kreer Heights, Lot 30", ""],
  ["Simon", "Paru", "Yapi", "1986-05-21", "male", "drivers_licence", "DL-WSP-0055419", "+675 7889 6631", "West Sepik", "Vanimo-Green River", "Vanimo Town, Section 3", ""],
  ["Doris", "Kila", "Lauma", "1982-12-17", "female", "drivers_licence", "DL-MBA-0146623", "+675 7990 1157", "Milne Bay", "Alotau", "Charles Abel Road, Alotau", "PO Box 61, Alotau"],
  ["Kevin", "", "Embogi", "1997-04-04", "male", "national_id", "NID-1904-662318", "+675 7101 5560", "Oro", "Ijivitari", "Popondetta Town, Section 6", ""],
];

const id = (n: number) => `0a1b2c3d-4e5f-4a6b-8c7d-${String(n).padStart(12, "0")}`;

export const SEED_OWNERS: Owner[] = OWNERS.map((o, i) => ({
  id: id(i + 1),
  firstName: o[0],
  middleName: o[1] || undefined,
  lastName: o[2],
  dateOfBirth: o[3],
  gender: o[4],
  nationality: "Papua New Guinean",
  identificationType: o[5],
  identificationNumber: o[6],
  mobile: o[7],
  email: `${o[0].toLowerCase()}.${o[2].toLowerCase()}@example.com`,
  province: o[8],
  district: o[9],
  llg: `${o[9]} Urban LLG`,
  ward: `Ward ${(i % 9) + 1}`,
  street: o[10],
  postalAddress: o[11] || undefined,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
}));
