import { appConfig } from "@/lib/config";
import type { SettingsService } from "./interfaces";
import { MockSettingsService } from "./mock/admin.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): SettingsService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockSettingsService();
}

export const settingsService: SettingsService = create();
