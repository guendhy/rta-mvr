import { appConfig } from "@/lib/config";
import type { PlateService } from "./interfaces";
import { MockPlateService } from "./mock/plate.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): PlateService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockPlateService();
}

export const plateService: PlateService = create();
