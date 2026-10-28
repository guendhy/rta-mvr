import { formatSpecValue, specLabel, vehicleFieldsFor } from "@/config/vehicle-fields";
import { DescriptionList } from "@/components/ui/layout-bits";
import type { Vehicle } from "@/types";

/** Technical specifications for the vehicle's type, in configuration order. */
export function SpecList({ vehicle, title = "Technical specifications" }: { vehicle: Pick<Vehicle, "vehicleType" | "fuelType" | "specifications">; title?: string }) {
  const fields = vehicleFieldsFor(vehicle.vehicleType, { fuelType: vehicle.fuelType });
  const known = new Set(fields.map((f) => f.key));
  const extra = Object.keys(vehicle.specifications ?? {}).filter((k) => !known.has(k) && vehicle.specifications[k] !== undefined && vehicle.specifications[k] !== "");
  const items: [string, React.ReactNode][] = [
    ...fields.map((f) => [f.label, formatSpecValue(f.key, vehicle.specifications?.[f.key])] as [string, React.ReactNode]),
    ...extra.map((k) => [specLabel(k), formatSpecValue(k, vehicle.specifications[k])] as [string, React.ReactNode]),
  ];
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="eb">{title}</p>
      <DescriptionList items={items} />
    </div>
  );
}
