import { ServiceError } from "@/lib/errors";
import { uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import type { InsuranceInput, InsuranceService } from "../interfaces";
import type { InsuranceRecord, InsuranceStatus } from "@/types";
import { actorName, audit, findById, mustFind, notify, nowIso, read, requirePermission, simulateNetwork, upsert } from "./core";
import { loadApp, saveApp, transition } from "./registration.mock";

// FUTURE: Connect insurance verification API (MVIL / insurer registry) behind this service.
export class MockInsuranceService implements InsuranceService {
  async list(): Promise<InsuranceRecord[]> {
    await mockDelay();
    return [...read("insurance")].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getById(id: string): Promise<InsuranceRecord | null> {
    await mockDelay(100, 300);
    return findById("insurance", id);
  }

  async getForApplication(applicationId: string): Promise<InsuranceRecord | null> {
    await mockDelay(100, 300);
    const app = findById("applications", applicationId);
    return findById("insurance", app?.insuranceId);
  }

  async capture(applicationId: string, input: InsuranceInput): Promise<InsuranceRecord> {
    requirePermission("insurance.verify", "capture insurance");
    await mockDelay();
    simulateNetwork();
    const app = loadApp(applicationId);
    if (app.status !== "for_insurance_verification") throw new ServiceError("workflow", "Insurance can only be captured while the application is at insurance verification.");
    if (input.coverageExpiry <= input.coverageStart) throw new ServiceError("validation", "Coverage expiry must be after coverage start.");
    const ts = nowIso();
    const existing = findById("insurance", app.insuranceId);
    const rec: InsuranceRecord = {
      ...(existing && existing.status === "pending" ? existing : { id: uuid(), createdAt: ts }),
      ...input,
      applicationId,
      vehicleId: app.vehicleId!,
      status: "pending",
      remarks: undefined,
      verifiedAt: undefined,
      verifiedBy: undefined,
      updatedAt: ts,
    } as InsuranceRecord;
    upsert("insurance", rec);
    app.insuranceId = rec.id;
    saveApp(app);
    return rec;
  }

  private flag(id: string, status: InsuranceStatus, remarks: string) {
    requirePermission("insurance.verify", "update insurance");
    const rec = mustFind("insurance", id, "Insurance record");
    const next = { ...rec, status, remarks, verifiedBy: undefined, verifiedAt: undefined, updatedAt: nowIso() };
    upsert("insurance", next);
    const app = findById("applications", rec.applicationId);
    audit("insurance_flagged", "Insurance", `Policy ${rec.policyNumber} marked ${status}: ${remarks}`, { id: rec.applicationId, label: app?.transactionNumber });
    if (app) notify("Insurance Issue", `${app.transactionNumber}: policy ${rec.policyNumber} is ${status}.`, "warning", `/insurance/${app.id}`);
    return next;
  }

  /** Simulated provider check: dates, VIN match, then marks verified and advances the workflow. */
  async verify(id: string): Promise<InsuranceRecord> {
    requirePermission("insurance.verify", "verify insurance");
    await mockDelay(600, 1200);
    simulateNetwork();
    const rec = mustFind("insurance", id, "Insurance record");
    const app = loadApp(rec.applicationId);
    if (app.status !== "for_insurance_verification") throw new ServiceError("workflow", "This application is not waiting for insurance verification.");
    const today = new Date().toISOString().slice(0, 10);
    if (rec.coverageExpiry < today) {
      this.flag(id, "expired", `Coverage expired on ${rec.coverageExpiry}`);
      throw new ServiceError("validation", `Provider check: policy ${rec.policyNumber} expired on ${rec.coverageExpiry}. It has been marked Expired.`);
    }
    const vehicle = findById("vehicles", app.vehicleId);
    const v = rec.vinOrChassis.replace(/\W/g, "").toUpperCase();
    if (vehicle && v !== vehicle.vin.toUpperCase() && v !== vehicle.chassisNumber.replace(/\W/g, "").toUpperCase()) {
      this.flag(id, "invalid", "VIN / chassis on the policy does not match the vehicle");
      throw new ServiceError("validation", "Provider check: the VIN / chassis on the policy does not match this vehicle. Marked Invalid.");
    }
    const ts = nowIso();
    const next: InsuranceRecord = { ...rec, status: "verified", verifiedBy: actorName(), verifiedAt: ts, remarks: "Verified with provider (simulated)", updatedAt: ts };
    upsert("insurance", next);
    const doc = app.documents.find((d) => d.type === "insurance_certificate");
    if (doc) Object.assign(doc, { status: "verified", file: rec.certificate ?? { name: `${rec.policyNumber}.pdf`, size: 120_000, type: "application/pdf", uploadedAt: ts }, verifiedBy: next.verifiedBy, verifiedAt: ts });
    transition(app, "for_assessment", `Insurance verified — ${rec.policyNumber}`);
    saveApp(app);
    audit("insurance_verified", "Insurance", `Policy ${rec.policyNumber} verified with ${rec.provider}`, { id: app.id, label: app.transactionNumber });
    return next;
  }

  async markInvalid(id: string, remarks: string) {
    await mockDelay();
    return this.flag(id, "invalid", remarks || "Marked invalid by officer");
  }

  async markExpired(id: string, remarks: string) {
    await mockDelay();
    return this.flag(id, "expired", remarks || "Marked expired by officer");
  }

  async reject(id: string, remarks: string) {
    if (!remarks.trim()) throw new ServiceError("validation", "A reason is required to reject the insurance.");
    await mockDelay();
    return this.flag(id, "rejected", remarks);
  }
}
