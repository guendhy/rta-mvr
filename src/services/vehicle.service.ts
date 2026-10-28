import { appConfig } from "@/lib/config";
import type { VehicleService } from "./interfaces";
import { MockVehicleService } from "./mock/vehicle.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): VehicleService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockVehicleService();
}

export const vehicleService: VehicleService = create();
