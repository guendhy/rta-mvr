import { appConfig } from "@/lib/config";
import type { UserService } from "./interfaces";
import { MockUserService } from "./mock/admin.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): UserService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockUserService();
}

export const userService: UserService = create();
