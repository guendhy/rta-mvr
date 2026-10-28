import { Ambulance, Bike, Bus, Car, CarFront, Caravan, Forklift, Landmark, Tractor, Truck, type LucideIcon } from "lucide-react";
import { getVehicleType } from "@/config/vehicle-types";
import type { VehicleType } from "@/types";

const BY_TYPE: Partial<Record<VehicleType, LucideIcon>> = {
  motorcycle: Bike,
  scooter: Bike,
  suv: CarFront,
  utility: Truck,
  pickup: Truck,
  van: Bus,
  minibus: Bus,
  bus: Bus,
  pmv: Bus,
  taxi: Car,
  truck: Truck,
  "light-commercial": Truck,
  "heavy-commercial": Truck,
  "prime-mover": Truck,
  trailer: Caravan,
  "semi-trailer": Caravan,
  construction: Forklift,
  agricultural: Tractor,
  emergency: Ambulance,
  government: Landmark,
};

export function vehicleIconFor(type: VehicleType | string | undefined): LucideIcon {
  return BY_TYPE[getVehicleType(type).key] ?? Car;
}

/** Decorative vehicle-type icon — always pair with a visible type label. */
export function VehicleIcon({ type, size = 20, className }: { type: VehicleType | string | undefined; size?: number; className?: string }) {
  const Icon = vehicleIconFor(type);
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" className={className} />;
}
