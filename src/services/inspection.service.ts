import { appConfig } from "@/lib/config";
import type { InspectionService } from "./interfaces";
import { MockInspectionService } from "./mock/inspection.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): InspectionService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockInspectionService();
}

export const inspectionService: InspectionService = create();
