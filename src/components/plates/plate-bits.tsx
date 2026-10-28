import { PLATE_CATEGORIES, plateCategoryLabel, VEHICLE_USAGES } from "@/config/vehicle-usage";
import { VEHICLE_TYPES } from "@/config/vehicle-types";
import type { PlateCategory } from "@/types";

/** Matches the low-stock notification threshold in the plate service. */
export { LOW_PLATE_STOCK } from "@/config/vehicle-usage";

/** Plate number as received into stock — mirrors `plateService.receiveBatch`. */
export function platePreview(category: PlateCategory | string | undefined, n: number | string): string {
  const prefix = PLATE_CATEGORIES.find((c) => c.value === category)?.prefix ?? "B";
  return category === "motorcycle" ? `${prefix}-${n}` : `${prefix} ${n}`;
}

/** Plate number styled like a physical plate. */
export function PlateChip({ number, size = "md" }: { number: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "px-6 py-3 text-[30px] border-2" : size === "sm" ? "px-1.5 py-0.5 text-[12.5px] border-[1.5px]" : "px-2 py-[3px] text-[13.5px] border-[1.5px]";
  return <span className={`mono inline-block rounded-[4px] border-[#0b0b0f] bg-white font-bold tracking-[.06em] whitespace-nowrap text-[#0b0b0f] ${cls}`}>{number}</span>;
}

/** Who each plate series is issued for, derived from the vehicle type and use configuration. */
export function plateCategoryRules(): { category: PlateCategory; label: string; issuedFor: string; example: string }[] {
  return PLATE_CATEGORIES.map((c) => {
    const usages = VEHICLE_USAGES.filter((u) => u.plateCategory === c.value).map((u) => u.label);
    const types = VEHICLE_TYPES.filter((t) => t.active && t.defaultPlateCategory === c.value && (t.group === "two_wheeler" || t.group === "towed" || !usages.length)).map((t) => t.label);
    const parts = [types.length ? types.join(", ") : "", usages.length ? `${usages.join(", ")} use` : ""].filter(Boolean);
    return { category: c.value, label: plateCategoryLabel(c.value), issuedFor: parts.join(" · ") || "As configured", example: platePreview(c.value, c.value === "motorcycle" ? 1001 : 100) };
  });
}
