import { appConfig } from "@/lib/config";
import type { ReportService } from "./interfaces";
import { MockReportService } from "./mock/report.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): ReportService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockReportService();
}

export const reportService: ReportService = create();
