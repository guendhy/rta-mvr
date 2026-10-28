import { appConfig } from "@/lib/config";
import type { AuditService } from "./interfaces";
import { MockAuditService } from "./mock/admin.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): AuditService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockAuditService();
}

export const auditService: AuditService = create();
