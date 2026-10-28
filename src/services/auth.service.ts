import { appConfig } from "@/lib/config";
import type { AuthService } from "./interfaces";
import { MockAuthService } from "./mock/auth.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): AuthService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockAuthService();
}

export const authService: AuthService = create();
