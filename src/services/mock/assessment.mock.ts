import { buildAssessment } from "@/data/mock/builder";
import { ServiceError } from "@/lib/errors";
import { mockDelay } from "@/lib/mock-delay";
import { assessmentChecklist } from "@/lib/workflow";
import type { AssessmentService } from "../interfaces";
import type { Fee, FeeCode } from "@/types";
import { actorName, audit, mustFind, nowIso, read, requirePermission, simulateNetwork, upsert } from "./core";
import { detailFor, loadApp, saveApp, transition } from "./registration.mock";

// FUTURE: Replace MockAssessmentService with SupabaseAssessmentService (fee schedule table).
export class MockAssessmentService implements AssessmentService {
  async listFees(): Promise<Fee[]> {
    await mockDelay(150, 400);
    return read("fees");
  }

  async updateFee(id: string, changes: Partial<Pick<Fee, "name" | "amount" | "active" | "effectiveDate">>): Promise<Fee> {
    requirePermission("fees.manage", "change fees");
    await mockDelay();
    simulateNetwork();
    const fee = mustFind("fees", id, "Fee");
    if (changes.amount !== undefined && (!Number.isFinite(changes.amount) || changes.amount < 0)) throw new ServiceError("validation", "Fee amount must be zero or more.");
    const next = { ...fee, ...changes, updatedAt: nowIso() };
    upsert("fees", next);
    const parts: string[] = [];
    if (changes.amount !== undefined && changes.amount !== fee.amount) parts.push(`K${fee.amount} → K${changes.amount}`);
    if (changes.active !== undefined && changes.active !== fee.active) parts.push(changes.active ? "activated" : "deactivated");
    audit("fee_changed", "Fee", `${fee.name}: ${parts.join(", ") || "details updated"}`, { id, label: fee.code });
    return next;
  }

  async preview(applicationId: string, optionalFees: FeeCode[] = []) {
    await mockDelay(150, 400);
    const app = loadApp(applicationId);
    const d = detailFor(app);
    if (!d.motorcycle) throw new ServiceError("validation", "Motorcycle details are missing.");
    return buildAssessment({ fees: read("fees") }, app, d.motorcycle, actorName(), nowIso(), optionalFees);
  }

  async generate(applicationId: string, optionalFees: FeeCode[] = []) {
    requirePermission("assessment.generate", "generate assessments");
    await mockDelay(300, 700);
    simulateNetwork();
    const app = loadApp(applicationId);
    if (app.status !== "for_assessment") throw new ServiceError("workflow", "The application is not ready for assessment.");
    const d = detailFor(app);
    const checks = assessmentChecklist(app, {
      ownerComplete: !!d.owner,
      motorcycleComplete: !!d.motorcycle,
      inspection: d.inspection,
      insurance: d.insurance,
      settings: read("settings"),
    }).filter((c) => c.key !== "assessment" && !c.ok);
    if (checks.length) throw new ServiceError("workflow", `Resolve first: ${checks.map((c) => c.label).join(", ")}.`);
    app.assessment = buildAssessment({ fees: read("fees") }, app, d.motorcycle!, actorName(), nowIso(), optionalFees);
    transition(app, "payment_required", `Total due K ${app.assessment.total.toFixed(2)}`);
    saveApp(app);
    audit("assessment_generated", "Assessment", `Assessment generated — K ${app.assessment.total.toFixed(2)}`, { id: app.id, label: app.transactionNumber });
    return app;
  }

  async checklist(applicationId: string) {
    await mockDelay(100, 300);
    const app = loadApp(applicationId);
    const d = detailFor(app);
    return assessmentChecklist(app, { ownerComplete: !!d.owner, motorcycleComplete: !!d.motorcycle, inspection: d.inspection, insurance: d.insurance, settings: read("settings") });
  }
}
