import { checklistKeysFor } from "@/config/inspection-checklists";
import { provinceCode } from "@/lib/constants";
import { ServiceError } from "@/lib/errors";
import { generators, uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import type { InspectionQueueItem, InspectionService, InspectionSubmitInput } from "../interfaces";
import type { Inspection, InspectionCenter, InspectionStatus } from "@/types";
import { actor, audit, consumeError, findById, mustFind, notify, nowIso, read, requirePermission, simulateNetwork, upsert } from "./core";
import { detailFor, loadApp, saveApp, transition } from "./registration.mock";
import { insuranceSatisfied } from "@/lib/workflow";

function queueStatus(appStatus: string, insp: Inspection | null): InspectionStatus {
  if (appStatus === "inspection_failed") return insp?.status === "reinspection_required" ? "reinspection_required" : "failed";
  if (appStatus === "for_inspection") {
    if (insp?.status === "in_progress") return "in_progress";
    if (insp?.status === "scheduled") return insp.attempt > 1 ? "reinspection_required" : "scheduled";
    return "not_inspected";
  }
  return insp?.status === "passed" ? "passed" : insp?.status ?? "not_inspected";
}

// FUTURE: Replace MockInspectionService with SupabaseInspectionService.
export class MockInspectionService implements InspectionService {
  async list(): Promise<Inspection[]> {
    await mockDelay();
    return [...read("inspections")].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getById(id: string): Promise<Inspection | null> {
    await mockDelay(100, 300);
    return findById("inspections", id);
  }

  async listForApplication(applicationId: string): Promise<Inspection[]> {
    await mockDelay(100, 300);
    return read("inspections").filter((i) => i.applicationId === applicationId).sort((a, b) => b.attempt - a.attempt);
  }

  async queue(): Promise<InspectionQueueItem[]> {
    await mockDelay();
    const inspections = read("inspections");
    return read("applications")
      .filter((a) => a.inspectionId || ["for_inspection", "inspection_failed"].includes(a.status))
      .map((application) => {
        const inspection = findById("inspections", application.inspectionId) ?? inspections.filter((i) => i.applicationId === application.id).sort((a, b) => b.attempt - a.attempt)[0] ?? null;
        return {
          application,
          owner: findById("owners", application.ownerId),
          vehicle: findById("vehicles", application.vehicleId),
          inspection,
          status: queueStatus(application.status, inspection),
        };
      })
      .sort((a, b) => b.application.updatedAt.localeCompare(a.application.updatedAt));
  }

  private current(applicationId: string): Inspection | null {
    const app = loadApp(applicationId);
    const insp = findById("inspections", app.inspectionId);
    if (insp && !["passed", "failed", "conditional", "reinspection_required"].includes(insp.status)) return insp;
    return null;
  }

  private newInspection(applicationId: string, status: InspectionStatus, extra: Partial<Inspection> = {}): Inspection {
    const app = loadApp(applicationId);
    const attempts = read("inspections").filter((i) => i.applicationId === applicationId).length;
    const ts = nowIso();
    const vehicle = findById("vehicles", app.vehicleId);
    const insp: Inspection = {
      id: uuid(),
      reference: generators.inspectionReference(provinceCode(vehicle?.provinceOfOperation)),
      applicationId,
      vehicleId: app.vehicleId!,
      attempt: attempts + 1,
      status,
      checklist: {},
      createdAt: ts,
      updatedAt: ts,
      ...extra,
    };
    upsert("inspections", insp);
    app.inspectionId = insp.id;
    saveApp(app);
    return insp;
  }

  async schedule(applicationId: string, input: { centerId: string; inspectionDate: string }): Promise<Inspection> {
    requirePermission("inspection.submit", "schedule inspections");
    await mockDelay();
    const app = loadApp(applicationId);
    if (app.status !== "for_inspection") throw new ServiceError("workflow", "Only applications waiting for inspection can be scheduled.");
    const existing = this.current(applicationId);
    const insp = existing
      ? upsert("inspections", { ...existing, ...input, status: "scheduled", updatedAt: nowIso() })
      : this.newInspection(applicationId, "scheduled", input);
    audit("inspection_scheduled", "Inspection", `Inspection scheduled for ${input.inspectionDate}`, { id: applicationId, label: app.transactionNumber });
    return insp;
  }

  async start(applicationId: string): Promise<Inspection> {
    requirePermission("inspection.submit", "perform inspections");
    await mockDelay(200, 500);
    const app = loadApp(applicationId);
    if (app.status !== "for_inspection") throw new ServiceError("workflow", app.status === "inspection_failed" ? "Request a reinspection first." : "This application is not waiting for inspection.");
    const existing = this.current(applicationId);
    const inspectorId = actor().id;
    if (existing) {
      if (existing.status === "in_progress") return existing;
      return upsert("inspections", { ...existing, status: "in_progress", inspectorId: existing.inspectorId ?? inspectorId, inspectionDate: existing.inspectionDate ?? nowIso().slice(0, 10), updatedAt: nowIso() });
    }
    return this.newInspection(applicationId, "in_progress", { inspectionDate: nowIso().slice(0, 10), inspectorId });
  }

  async saveProgress(inspectionId: string, changes: Partial<InspectionSubmitInput>): Promise<Inspection> {
    await mockDelay(150, 300);
    const insp = mustFind("inspections", inspectionId, "Inspection");
    if (["passed", "failed", "conditional", "reinspection_required"].includes(insp.status)) return insp;
    const { result: _r, ...rest } = changes;
    void _r;
    return upsert("inspections", { ...insp, ...rest, checklist: { ...insp.checklist, ...rest.checklist }, updatedAt: nowIso() });
  }

  async submit(inspectionId: string, input: InspectionSubmitInput): Promise<Inspection> {
    requirePermission("inspection.submit", "submit inspections");
    await mockDelay(500, 900);
    simulateNetwork();
    if (consumeError("inspection_failed")) throw new ServiceError("simulated", "Inspection submission failed. The result was not saved — please submit again.");
    const insp = mustFind("inspections", inspectionId, "Inspection");
    const app = loadApp(insp.applicationId);
    if (app.status !== "for_inspection") throw new ServiceError("workflow", "This application is not waiting for inspection.");
    const vehicle = findById("vehicles", app.vehicleId);
    if (!vehicle) throw new ServiceError("validation", "Inspection record missing — the application has no vehicle.");
    const keys = checklistKeysFor(vehicle.vehicleType);
    const missing = keys.filter((k) => !input.checklist[k]);
    if (missing.length) throw new ServiceError("validation", `Complete all ${keys.length} checklist items (${missing.length} remaining).`);
    const anyFail = keys.some((k) => input.checklist[k] === "fail");
    if (input.result === "pass" && anyFail) throw new ServiceError("validation", "A vehicle with failed checklist items cannot pass. Select Failed, Conditional Approval or correct the checklist.");
    if (input.result === "fail" && (!input.failureReason || !input.notes?.trim())) throw new ServiceError("validation", "Failure reason and notes are required when the inspection fails.");
    if (input.result === "conditional" && !input.conditions?.trim()) throw new ServiceError("validation", "Record the conditions and repair due date for a conditional approval.");

    const ts = nowIso();
    const passed = input.result === "pass" || input.result === "conditional";
    const certDate = input.inspectionDate;
    const expiry = new Date(certDate);
    expiry.setMonth(expiry.getMonth() + 3);
    const next: Inspection = {
      ...insp,
      ...input,
      status: input.result === "conditional" ? "conditional" : passed ? "passed" : "failed",
      certificateNumber: passed ? generators.inspectionCertificateNumber() : undefined,
      certificateDate: passed ? certDate : undefined,
      certificateExpiry: passed ? expiry.toISOString().slice(0, 10) : undefined,
      submittedAt: ts,
      updatedAt: ts,
    };
    upsert("inspections", next);

    const settings = read("settings");
    if (passed) {
      const doc = app.documents.find((d) => d.type === "inspection_certificate");
      if (doc) Object.assign(doc, { status: "verified", file: { name: `${next.certificateNumber}.pdf`, size: 98_000, type: "application/pdf", uploadedAt: ts }, verifiedBy: "Inspection module", verifiedAt: ts, note: "Generated from inspection" });
      const insuranceDone = insuranceSatisfied(app, detailFor(app).insurance, settings);
      transition(app, insuranceDone ? "for_assessment" : "for_insurance_verification", `${input.result === "conditional" ? "Conditional approval" : "Roadworthy"} — ${next.certificateNumber}`);
    } else {
      transition(app, "inspection_failed", input.failureReason);
      notify("Inspection Failed", `${app.transactionNumber} failed inspection: ${input.failureReason}.`, "danger", `/inspections/${app.id}`);
    }
    app.inspectionId = next.id;
    saveApp(app);
    audit("inspection_submitted", "Inspection", input.result === "conditional" ? `Inspection CONDITIONAL — ${next.certificateNumber}` : passed ? `Inspection PASSED — ${next.certificateNumber}` : `Inspection FAILED — ${input.failureReason}`, { id: app.id, label: app.transactionNumber });
    return next;
  }

  async requestReinspection(applicationId: string): Promise<void> {
    requirePermission("inspection.submit", "request reinspection");
    await mockDelay();
    const app = loadApp(applicationId);
    if (app.status !== "inspection_failed") throw new ServiceError("workflow", "Reinspection is only available after a failed inspection.");
    const failed = findById("inspections", app.inspectionId);
    if (failed?.status === "failed") upsert("inspections", { ...failed, status: "reinspection_required", updatedAt: nowIso() });
    transition(app, "for_inspection", "Reinspection requested");
    saveApp(app);
    this.newInspection(applicationId, "scheduled", { inspectionDate: nowIso().slice(0, 10) });
    audit("inspection_scheduled", "Inspection", "Reinspection scheduled", { id: applicationId, label: app.transactionNumber });
  }

  async listCenters(): Promise<InspectionCenter[]> {
    await mockDelay(100, 300);
    return read("centers");
  }

  async saveCenter(center: Partial<InspectionCenter> & Pick<InspectionCenter, "name" | "code" | "province" | "district" | "address" | "status">): Promise<InspectionCenter> {
    requirePermission("centers.manage", "manage inspection centers");
    await mockDelay();
    if (read("centers").some((c) => c.code.toLowerCase() === center.code.toLowerCase() && c.id !== center.id)) throw new ServiceError("conflict", "Another centre already uses this code.");
    const ts = nowIso();
    const existing = center.id ? findById("centers", center.id) : null;
    const rec: InspectionCenter = { ...(existing ?? { id: uuid(), createdAt: ts }), ...center, updatedAt: ts } as InspectionCenter;
    upsert("centers", rec);
    audit("center_saved", "Inspection Center", `Inspection centre ${rec.name} saved`, { id: rec.id, label: rec.code });
    return rec;
  }
}
