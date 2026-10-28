import type { Plate, PlateStatus } from "@/types";
import { OFFICE_IDS } from "./offices";

const id = (n: number) => `1d2e3f40-5a6b-4c7d-9e8f-${String(n).padStart(12, "0")}`;

/** Non-available statuses seeded for inventory demos (by plate index, 0-based). */
const SPECIAL: Record<number, { status: PlateStatus; notes: string }> = {
  44: { status: "damaged", notes: "Bent during transport — return to supplier" },
  45: { status: "damaged", notes: "Paint defect on characters" },
  46: { status: "lost", notes: "Reported lost at Lae counter" },
  47: { status: "cancelled", notes: "Duplicate number printed in error" },
  48: { status: "released", notes: "Released after registration cancellation" },
  49: { status: "reserved", notes: "Reserved for government fleet batch" },
};

function officeFor(i: number) {
  if (i < 30) return OFFICE_IDS.POM;
  if (i < 36) return OFFICE_IDS.LAE;
  if (i < 41) return OFFICE_IDS.HGN;
  if (i < 45) return OFFICE_IDS.KKP;
  return OFFICE_IDS.MAD;
}

export function buildPlates(receivedDate: string): Plate[] {
  return Array.from({ length: 50 }, (_, i) => {
    const special = SPECIAL[i];
    return {
      id: id(i + 1),
      plateNumber: `MC-${1001 + i}`,
      type: "Motorcycle",
      officeId: officeFor(i),
      status: special?.status ?? "available",
      receivedDate,
      notes: special?.notes,
      createdAt: `${receivedDate}T08:00:00.000Z`,
      updatedAt: `${receivedDate}T08:00:00.000Z`,
    };
  });
}
