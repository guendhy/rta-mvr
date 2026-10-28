import type { Plate, PlateCategory, PlateStatus } from "@/types";
import { OFFICE_IDS } from "./offices";

const id = (n: number) => `1d2e3f40-5a6b-4c7d-9e8f-${String(n).padStart(12, "0")}`;

/** Fictional plate series per category: [category, count, number formatter]. */
const SERIES: [PlateCategory, number, (i: number) => string][] = [
  ["private", 24, (i) => `BGM ${String(470 + i).padStart(3, "0")}`],
  ["commercial", 14, (i) => `CAA ${String(130 + i).padStart(3, "0")}`],
  ["pmv", 8, (i) => `P ${2400 + i}`],
  ["taxi", 6, (i) => `T ${1180 + i}`],
  ["government", 6, (i) => `ZG ${String(40 + i).padStart(3, "0")}`],
  ["diplomatic", 4, (i) => `CD ${String(12 + i).padStart(3, "0")}`],
  ["motorcycle", 24, (i) => `MC-${1001 + i}`],
  ["trailer", 6, (i) => `TR ${410 + i}`],
  ["emergency", 4, (i) => `EM ${String(20 + i).padStart(3, "0")}`],
  ["special", 4, (i) => `SP ${String(70 + i).padStart(3, "0")}`],
];

/** Non-available statuses seeded for inventory demos: [category, index-in-series]. */
const SPECIAL: [PlateCategory, number, PlateStatus, string][] = [
  ["private", 22, "damaged", "Bent during transport — return to supplier"],
  ["private", 23, "reserved", "Reserved for government fleet batch"],
  ["motorcycle", 21, "damaged", "Paint defect on characters"],
  ["motorcycle", 22, "lost", "Reported lost at Lae counter"],
  ["motorcycle", 23, "cancelled", "Duplicate number printed in error"],
  ["commercial", 13, "released", "Released after registration cancellation"],
];

/** Spread stock across offices, most at Port Moresby. */
function officeFor(i: number, count: number) {
  const r = i / count;
  if (r < 0.55) return OFFICE_IDS.POM;
  if (r < 0.7) return OFFICE_IDS.LAE;
  if (r < 0.82) return OFFICE_IDS.HGN;
  if (r < 0.92) return OFFICE_IDS.KKP;
  return OFFICE_IDS.MAD;
}

export function buildPlates(receivedDate: string): Plate[] {
  let n = 0;
  return SERIES.flatMap(([category, count, fmt]) =>
    Array.from({ length: count }, (_, i) => {
      const special = SPECIAL.find(([c, idx]) => c === category && idx === i);
      return {
        id: id(++n),
        plateNumber: fmt(i),
        category,
        officeId: officeFor(i, count),
        status: special?.[2] ?? "available",
        receivedDate,
        notes: special?.[3],
        createdAt: `${receivedDate}T08:00:00.000Z`,
        updatedAt: `${receivedDate}T08:00:00.000Z`,
      } satisfies Plate;
    }),
  );
}
