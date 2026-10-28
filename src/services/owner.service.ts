import { appConfig } from "@/lib/config";
import type { OwnerService } from "./interfaces";
import { MockOwnerService } from "./mock/owner.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): OwnerService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockOwnerService();
}

export const ownerService: OwnerService = create();
