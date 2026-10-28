import { buildAssessment } from "@/data/mock/builder";
import { ServiceError } from "@/lib/errors";
import { mockDelay } from "@/lib/mock-delay";
import { assessmentChecklist } from "@/lib/workflow";
import type { AssessmentOptions, AssessmentService } from "../interfaces";
import type { FeeRule } from "@/types";
import { actorName, audit, mustFind, nowIso, read, requirePermission, simulateNetwork, upsert } from "./core";
import { detailFor, loadApp, saveApp, transition } from "./registration.mock";

// FUTURE: Replace MockAssessmentService with SupabaseAssessmentService (fee_rules table + Edge Function).
export class MockAssessmentService implements AssessmentService {
  async listFeeRules(): Promise<FeeRule[]> {
    await mockDelay(150, 400);
    return read("feeRules");
  }

  async updateFeeRule(id: string, changes: Partial<Pick<FeeRule, "name" | "amount" | "bands" | "active" | "effectiveDate" | "notes">>): Promise<FeeRule> {
    requirePermission("fees.manage", "change fees");
    await mockDelay();
    simulateNetwork();
    const rule = mustFind("feeRules", id, "Fee rule");
    if (changes.amount !== undefined && (!Number.isFinite(changes.amount) || changes.amount < 0)) throw new ServiceError("validation", "Fee amount must be zero or more.");
    if (changes.bands?.some((b) => !Number.isFinite(b.amount) || b.amount < 0)) throw new ServiceError("validation", "Band amounts must be zero or more.");
    const next: FeeRule = { ...rule, ...changes, updatedAt: nowIso() };
    upsert("feeRules", next);
    const parts: string[] = [];
    if (changes.amount !== undefined && changes.amount !== rule.amount) parts.push(`K${rule.amount} → K${changes.amount}`);
    if (changes.bands) parts.push("bands updated");
    if (changes.active !== undefined && changes.active !== rule.active) parts.push(changes.active ? "activated" : "deactivated");
    audit("fee_changed", "Fee", `${rule.name}: ${parts.join(", ") || "details updated"}`, { id, label: rule.code });
    return next;
  }

  async preview(applicationId: string, options: AssessmentOptions = {}) {
    await mockDelay(150, 400);
    const app = loadApp(applicationId);
    const d = detailFor(app);
    if (!d.vehicle) throw new ServiceError("validation", "Vehicle details are missing.");
    return buildAssessment({ feeRules: read("feeRules") }, app, d.vehicle, actorName(), nowIso(), options);
  }

  async generate(applicationId: string, options: AssessmentOptions = {}) {
    requirePermission("assessment.generate", "generate assessments");
    await mockDelay(300, 700);
    simulateNetwork();
    const app = loadApp(applicationId);
    if (app.status !== "for_assessment") throw new ServiceError("workflow", "The application is not ready for assessment.");
    const d = detailFor(app);
    const checks = assessmentChecklist(app, {
      ownerComplete: !!d.owner,
      vehicleComplete: !!d.vehicle,
      inspection: d.inspection,
      insurance: d.insurance,
      settings: read("settings"),
    }).filter((c) => c.key !== "assessment" && !c.ok);
    if (checks.length) throw new ServiceError("workflow", `Resolve first: ${checks.map((c) => c.label).join(", ")}.`);
    app.assessment = buildAssessment({ feeRules: read("feeRules") }, app, d.vehicle!, actorName(), nowIso(), options);
    transition(app, "payment_required", `Total due K ${app.assessment.total.toFixed(2)}`);
    if (app.assessment.total === 0) {
      transition(app, "paid", "No amount due");
      transition(app, "for_approval", "Sent for supervisor approval");
    }
    saveApp(app);
    audit("assessment_generated", "Assessment", `Assessment generated — K ${app.assessment.total.toFixed(2)}`, { id: app.id, label: app.transactionNumber });
    return app;
  }

  async checklist(applicationId: string) {
    await mockDelay(100, 300);
    const app = loadApp(applicationId);
    const d = detailFor(app);
    return assessmentChecklist(app, { ownerComplete: !!d.owner, vehicleComplete: !!d.vehicle, inspection: d.inspection, insurance: d.insurance, settings: read("settings") });
  }
}
