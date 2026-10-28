import { appConfig } from "@/lib/config";
import type { MotorcycleService } from "./interfaces";
import { MockMotorcycleService } from "./mock/motorcycle.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): MotorcycleService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockMotorcycleService();
}

export const motorcycleService: MotorcycleService = create();
