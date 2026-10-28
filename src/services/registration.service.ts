import { appConfig } from "@/lib/config";
import type { RegistrationService } from "./interfaces";
import { MockRegistrationService } from "./mock/registration.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): RegistrationService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockRegistrationService();
}

export const registrationService: RegistrationService = create();
