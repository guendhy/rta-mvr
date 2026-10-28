import { appConfig } from "@/lib/config";
import type { SearchService } from "./interfaces";
import { MockSearchService } from "./mock/search.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): SearchService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockSearchService();
}

export const searchService: SearchService = create();
