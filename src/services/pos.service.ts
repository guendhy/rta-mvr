import { appConfig } from "@/lib/config";
import type { PosService } from "./interfaces";
import { MockPosTerminalAdapter } from "./mock/pos.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): PosService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockPosTerminalAdapter();
}

export const posService: PosService = create();
