import { appConfig } from "@/lib/config";
import type { InsuranceService } from "./interfaces";
import { MockInsuranceService } from "./mock/insurance.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): InsuranceService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockInsuranceService();
}

export const insuranceService: InsuranceService = create();
