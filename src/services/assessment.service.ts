import { appConfig } from "@/lib/config";
import type { AssessmentService } from "./interfaces";
import { MockAssessmentService } from "./mock/assessment.mock";

// FUTURE: When appConfig.backendMode === "supabase", return the Supabase implementation here.
function create(): AssessmentService {
  if (appConfig.backendMode === "supabase") {
    throw new Error("Supabase backend is planned for Phase 2.");
  }
  return new MockAssessmentService();
}

export const assessmentService: AssessmentService = create();
