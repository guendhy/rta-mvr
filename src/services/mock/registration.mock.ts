import { addMonths } from "date-fns";
import { emptyDocuments, expiryFrom } from "@/data/mock/builder";
import { provinceCode, REGISTRATION_STATUS } from "@/lib/constants";
import { ServiceError } from "@/lib/errors";
import { fullName } from "@/lib/formatting";
import { generators, token, uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import { approvalChecklist, assertTransition, documentsChecklist, isEditable, nextAfterSubmission } from "@/lib/workflow";
import type { RegistrationDetail, RegistrationListFilter, RegistrationService } from "../interfaces";
import type {
  ApplicationDocument,
  CreateRegistrationInput,
  DocumentType,
  FileMeta,
  RegistrationApplication,
  RegistrationStatus,
  UpdateRegistrationInput,
  WizardDraft,
} from "@/types";
import {
  actor,
  actorName,
  audit,

  consumeError,
  findById,
  mustFind,
  notify,
  nowIso,
  read,
  requirePermission,
  simulateNetwork,
  upsert,
} from "./core";
import { refreshExpiry } from "./motorcycle.mock";

/** Applies a validated status change and appends history. Shared by other mock services. */
export function transition(app: RegistrationApplication, to: RegistrationStatus, note?: string): RegistrationApplication {
  assertTransition(app.status, to);
  const a = actor();
  app.history = [...app.history, { from: app.status, to, at: nowIso(), by: a.id, byName: actorName(), note }];
  app.status = to;
  app.updatedAt = nowIso();
  return app;
}

export function saveApp(app: RegistrationApplication) {
  app.updatedAt = nowIso();
  upsert("applications", app);
  return app;
}

export function loadApp(id: string): RegistrationApplication {
  return mustFind("applications", id, "Registration application");
}

export function detailFor(app: RegistrationApplication): RegistrationDetail {
  const inspections = read("inspections").filter((i) => i.applicationId === app.id).sort((a, b) => b.attempt - a.attempt);
  const payments = read("payments").filter((p) => p.applicationId === app.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const motorcycle = findById("motorcycles", app.motorcycleId);
  return {
    application: app,
    owner: findById("owners", app.ownerId),
    motorcycle,
    inspection: findById("inspections", app.inspectionId) ?? inspections[0] ?? null,
    inspections,
    insurance: findById("insurance", app.insuranceId),
    payment: findById("payments", app.paymentId) ?? payments.find((p) => p.status === "successful") ?? null,
    payments,
    plate: app.plateNumber ? read("plates").find((p) => p.plateNumber === app.plateNumber) ?? null : null,
    office: findById("offices", app.officeId),
    previous: findById("applications", app.previousApplicationId),
  };
}

function matches(app: RegistrationApplication, q: string) {
  const owner = findById("owners", app.ownerId);
  const moto = findById("motorcycles", app.motorcycleId);
  const hay = [app.transactionNumber, app.registrationNumber, app.plateNumber, owner && fullName(owner), owner?.mobile, moto?.engineNumber, moto?.chassisNumber, moto?.vin, moto?.make, moto?.model]
    .filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

// FUTURE: Replace MockRegistrationService with SupabaseRegistrationService.
export class MockRegistrationService implements RegistrationService {
  async list(filter: RegistrationListFilter = {}): Promise<RegistrationApplication[]> {
    await mockDelay();
    let list = read("applications");
    if (filter.status) {
      const set = Array.isArray(filter.status) ? filter.status : [filter.status];
      list = list.filter((a) => set.includes(a.status));
    }
    if (filter.type) list = list.filter((a) => a.type === filter.type);
    if (filter.officeId) list = list.filter((a) => a.officeId === filter.officeId);
    if (filter.query?.trim()) list = list.filter((a) => matches(a, filter.query!.trim()));
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getById(id: string): Promise<RegistrationApplication | null> {
    await mockDelay(100, 300);
    return findById("applications", id);
  }

  async getDetail(id: string): Promise<RegistrationDetail | null> {
    await mockDelay(250, 600);
    refreshExpiry(read("motorcycles"));
    const app = findById("applications", id) ?? read("applications").find((a) => a.transactionNumber === id) ?? null;
    return app ? detailFor(app) : null;
  }

  async create(input: CreateRegistrationInput): Promise<RegistrationApplication> {
    requirePermission(input.type === "renewal" ? "renewal.create" : "registration.create", "create registrations");
    await mockDelay();
    simulateNetwork();
    const a = actor();
    const ts = nowIso();
    const app: RegistrationApplication = {
      id: uuid(),
      transactionNumber: generators.transactionNumber(),
      type: input.type,
      status: "draft",
      currentStep: 1,
      officeId: input.officeId,
      createdBy: a.id,
      createdByName: actorName(),
      ownerId: input.ownerId,
      motorcycleId: input.motorcycleId,
      previousApplicationId: input.previousApplicationId,
      draft: { ownerMode: "search" },
      documents: emptyDocuments(input.type),
      verificationToken: token(),
      history: [{ from: null, to: "draft", at: ts, by: a.id, byName: actorName() }],
      createdAt: ts,
      updatedAt: ts,
    };
    upsert("applications", app);
    audit(input.type === "renewal" ? "renewal_created" : "registration_created", "Registration", `${input.type === "renewal" ? "Renewal" : "New registration"} ${app.transactionNumber} started`, { id: app.id, label: app.transactionNumber });
    if (input.type === "new") notify("New Registration Created", `${app.transactionNumber} started by ${actorName()}.`, "info", `/registrations/${app.id}`);
    return app;
  }

  async update(id: string, input: UpdateRegistrationInput): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "edit registrations");
    await mockDelay();
    simulateNetwork();
    const app = loadApp(id);
    Object.assign(app, input);
    saveApp(app);
    audit("registration_updated", "Registration", `${app.transactionNumber} updated`, { id, label: app.transactionNumber });
    return app;
  }

  async changeStatus(id: string, status: RegistrationStatus, note?: string): Promise<void> {
    requirePermission("registration.edit", "change application status");
    await mockDelay();
    const app = loadApp(id);
    transition(app, status, note);
    saveApp(app);
    audit("registration_updated", "Registration", `${app.transactionNumber} → ${REGISTRATION_STATUS[status].label}`, { id, label: app.transactionNumber });
  }

  /** Autosave — works offline because it is local-only. */
  async saveDraft(id: string, draft: WizardDraft, step: number): Promise<RegistrationApplication> {
    await mockDelay(250, 500);
    if (consumeError("save_failed")) throw new ServiceError("storage", "The application could not be saved locally.");
    const app = loadApp(id);
    if (!isEditable(app)) return app;
    app.draft = { ...app.draft, ...draft, owner: { ...app.draft.owner, ...draft.owner }, motorcycle: { ...app.draft.motorcycle, ...draft.motorcycle } };
    app.currentStep = Math.max(1, Math.min(step, 3));
    return saveApp(app);
  }

  async attachOwner(id: string, ownerId: string): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "edit registrations");
    await mockDelay(150, 400);
    const app = loadApp(id);
    if (!isEditable(app)) throw new ServiceError("workflow", "This application can no longer be edited.");
    mustFind("owners", ownerId, "Owner");
    app.ownerId = ownerId;
    app.currentStep = Math.max(app.currentStep, 2);
    return saveApp(app);
  }

  async attachMotorcycle(id: string, motorcycleId: string): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "edit registrations");
    await mockDelay(150, 400);
    const app = loadApp(id);
    if (!isEditable(app)) throw new ServiceError("workflow", "This application can no longer be edited.");
    const moto = mustFind("motorcycles", motorcycleId, "Motorcycle");
    const active = read("applications").find((a) => a.id !== id && a.motorcycleId === motorcycleId && !["registered", "rejected", "cancelled", "draft"].includes(a.status));
    if (active) throw new ServiceError("conflict", `Motorcycle already has an active application (${active.transactionNumber}).`);
    app.motorcycleId = moto.id;
    app.currentStep = Math.max(app.currentStep, 3);
    moto.currentApplicationId = app.id;
    upsert("motorcycles", { ...moto, updatedAt: nowIso() });
    return saveApp(app);
  }

  async uploadDocument(id: string, type: DocumentType, file: FileMeta): Promise<ApplicationDocument> {
    requirePermission("registration.edit", "upload documents");
    await mockDelay(300, 700);
    simulateNetwork();
    const app = loadApp(id);
    let doc = app.documents.find((d) => d.type === type);
    if (!doc) {
      doc = { id: uuid(), type, status: "missing" };
      app.documents.push(doc);
    }
    Object.assign(doc, { status: "uploaded", file, rejectionReason: undefined, verifiedAt: undefined, verifiedBy: undefined });
    saveApp(app);
    audit("document_uploaded", "Document", `${type.replace(/_/g, " ")} uploaded (${file.name})`, { id, label: app.transactionNumber });
    return doc;
  }

  async verifyDocument(id: string, documentId: string): Promise<ApplicationDocument> {
    requirePermission("documents.verify", "verify documents");
    await mockDelay(200, 500);
    const app = loadApp(id);
    const doc = app.documents.find((d) => d.id === documentId);
    if (!doc?.file) throw new ServiceError("validation", "Upload the document before verifying it.");
    Object.assign(doc, { status: "verified", verifiedBy: actorName(), verifiedAt: nowIso(), rejectionReason: undefined });
    saveApp(app);
    audit("document_verified", "Document", `${doc.type.replace(/_/g, " ")} verified`, { id, label: app.transactionNumber });
    return doc;
  }

  async rejectDocument(id: string, documentId: string, reason: string): Promise<ApplicationDocument> {
    requirePermission("documents.verify", "reject documents");
    if (!reason.trim()) throw new ServiceError("validation", "A rejection reason is required.");
    await mockDelay(200, 500);
    const app = loadApp(id);
    const doc = app.documents.find((d) => d.id === documentId);
    if (!doc) throw new ServiceError("not_found", "Document not found.");
    Object.assign(doc, { status: "rejected", rejectionReason: reason.trim(), verifiedBy: actorName(), verifiedAt: nowIso() });
    saveApp(app);
    audit("document_rejected", "Document", `${doc.type.replace(/_/g, " ")} rejected: ${reason}`, { id, label: app.transactionNumber });
    return doc;
  }

  async submit(id: string): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "submit registrations");
    await mockDelay(400, 800);
    simulateNetwork();
    const app = loadApp(id);
    if (!app.ownerId) throw new ServiceError("validation", "Select or create the owner first.");
    if (!app.motorcycleId) throw new ServiceError("validation", "Capture the motorcycle details first.");
    const docs = documentsChecklist(app);
    if (!docs.present) throw new ServiceError("validation", "Upload all required documents before submitting.");
    if (app.documents.some((d) => docs.required.includes(d.type) && d.status === "rejected")) throw new ServiceError("validation", "Replace rejected documents before submitting.");
    if (app.status === "returned") transition(app, "pending", "Corrections made — resubmitted");
    if (app.status === "draft") {
      app.submittedAt = nowIso();
      transition(app, "pending", "Submitted");
    }
    const d = detailFor(app);
    const next = nextAfterSubmission(app, { inspection: d.inspection, insurance: d.insurance, payment: d.payment, settings: read("settings") });
    transition(app, next, next === "for_approval" ? "Resubmitted for approval" : "Ready for processing");
    saveApp(app);
    audit("registration_submitted", "Registration", `${app.transactionNumber} submitted — now ${REGISTRATION_STATUS[next].label}`, { id, label: app.transactionNumber });
    if (next === "for_approval") notify("Registration Ready for Approval", `${app.transactionNumber} was corrected and resubmitted.`, "info", `/registrations/${app.id}`);
    return app;
  }

  async cancel(id: string, reason: string): Promise<void> {
    requirePermission("registration.edit", "cancel registrations");
    await mockDelay();
    const app = loadApp(id);
    if (read("payments").some((p) => p.applicationId === id && p.status === "successful")) {
      throw new ServiceError("workflow", "A paid application cannot be cancelled. Ask a supervisor to reject it instead.");
    }
    transition(app, "cancelled", reason || "Cancelled by officer");
    saveApp(app);
    const moto = findById("motorcycles", app.motorcycleId);
    if (moto?.currentApplicationId === id) upsert("motorcycles", { ...moto, currentApplicationId: undefined, updatedAt: nowIso() });
    audit("registration_cancelled", "Registration", `${app.transactionNumber} cancelled: ${reason}`, { id, label: app.transactionNumber });
  }

  async approvalChecklist(id: string) {
    await mockDelay(100, 300);
    const d = detailFor(loadApp(id));
    return approvalChecklist(d.application, { inspection: d.inspection, insurance: d.insurance, payment: d.payment, settings: read("settings") });
  }

  async approve(id: string): Promise<RegistrationApplication> {
    requirePermission("approval.decide", "approve registrations");
    await mockDelay(500, 900);
    simulateNetwork();
    const app = loadApp(id);
    if (app.status !== "for_approval") throw new ServiceError("workflow", "Only applications waiting for approval can be approved.");
    const d = detailFor(app);
    const settings = read("settings");
    const failed = approvalChecklist(app, { inspection: d.inspection, insurance: d.insurance, payment: d.payment, settings }).filter((c) => !c.ok);
    if (failed.length) throw new ServiceError("workflow", `Cannot approve: ${failed.map((f) => f.label).join(", ")}.`);
    const moto = d.motorcycle!;
    const now = new Date();
    const previous = d.previous;
    app.registrationNumber = previous?.registrationNumber ?? moto.registrationNumber ?? generators.registrationNumber(provinceCode(moto.provinceOfOperation), now);
    app.certificateNumber = generators.certificateNumber(now);
    app.labelNumber = generators.labelNumber(now);
    app.registrationDate = now.toISOString();
    const months = settings.registration.validityMonths;
    const prevExpiry = moto.registrationExpiry ? new Date(moto.registrationExpiry) : null;
    app.expiryDate = (app.type === "renewal" && prevExpiry && prevExpiry > now ? addMonths(prevExpiry, months) : expiryFrom(now, months)).toISOString();
    app.approval = { decision: "approved", by: actor().id, byName: actorName(), at: nowIso() };

    const needsPlate = app.type === "new" && settings.registration.requirePlateBeforeCompletion && !moto.plateNumber;
    if (needsPlate) {
      transition(app, "approved", "Approved — awaiting plate assignment");
    } else {
      app.plateNumber = moto.plateNumber;
      app.completedAt = nowIso();
      transition(app, "registered", app.type === "renewal" ? "Renewal approved" : "Approved and registered");
      upsert("motorcycles", {
        ...moto,
        registrationNumber: app.registrationNumber,
        registrationStatus: "registered",
        registrationDate: app.type === "renewal" && moto.registrationDate ? moto.registrationDate : app.registrationDate,
        registrationExpiry: app.expiryDate,
        updatedAt: nowIso(),
      });
    }
    saveApp(app);
    audit("registration_approved", "Registration", `${app.transactionNumber} approved — ${app.registrationNumber}`, { id, label: app.transactionNumber });
    notify("Registration Approved", `${app.transactionNumber} approved${needsPlate ? " — assign a number plate" : ""}.`, "success", needsPlate ? "/plates" : `/registrations/${id}`);
    return app;
  }

  async returnForCorrection(id: string, reason: string): Promise<RegistrationApplication> {
    requirePermission("approval.decide", "return registrations");
    if (!reason.trim()) throw new ServiceError("validation", "A reason is required to return an application.");
    await mockDelay(400, 800);
    const app = loadApp(id);
    app.approval = { decision: "returned", by: actor().id, byName: actorName(), at: nowIso(), reason: reason.trim() };
    app.returnReason = reason.trim();
    transition(app, "returned", reason.trim());
    saveApp(app);
    audit("registration_returned", "Registration", `${app.transactionNumber} returned: ${reason}`, { id, label: app.transactionNumber });
    notify("Registration Returned", `${app.transactionNumber} returned for correction.`, "warning", `/registrations/${id}`);
    return app;
  }

  async reject(id: string, reason: string): Promise<RegistrationApplication> {
    requirePermission("approval.decide", "reject registrations");
    if (!reason.trim()) throw new ServiceError("validation", "A reason is required to reject an application.");
    await mockDelay(400, 800);
    const app = loadApp(id);
    app.approval = { decision: "rejected", by: actor().id, byName: actorName(), at: nowIso(), reason: reason.trim() };
    app.rejectReason = reason.trim();
    transition(app, "rejected", reason.trim());
    saveApp(app);
    const moto = findById("motorcycles", app.motorcycleId);
    if (moto?.currentApplicationId === id) upsert("motorcycles", { ...moto, currentApplicationId: undefined, updatedAt: nowIso() });
    audit("registration_rejected", "Registration", `${app.transactionNumber} rejected: ${reason}`, { id, label: app.transactionNumber });
    notify("Registration Rejected", `${app.transactionNumber} was rejected.`, "danger", `/registrations/${id}`);
    return app;
  }

  async createRenewal(motorcycleId: string): Promise<RegistrationApplication> {
    requirePermission("renewal.create", "process renewals");
    await mockDelay(400, 800);
    simulateNetwork();
    const moto = mustFind("motorcycles", motorcycleId, "Motorcycle");
    if (!moto.registrationNumber) throw new ServiceError("workflow", "Only registered motorcycles can be renewed.");
    const open = read("applications").find((a) => a.motorcycleId === motorcycleId && !["registered", "rejected", "cancelled"].includes(a.status));
    if (open) throw new ServiceError("conflict", `An application is already open for this motorcycle (${open.transactionNumber}).`);
    const previous = read("applications")
      .filter((a) => a.motorcycleId === motorcycleId && a.status === "registered")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
    const app = await this.create({ type: "renewal", officeId: actor().officeId, ownerId: moto.ownerId, motorcycleId, previousApplicationId: previous?.id });
    // Owner and motorcycle are already on record — the renewal goes straight to inspection.
    app.submittedAt = nowIso();
    app.currentStep = 4;
    transition(app, "pending", "Renewal started");
    const settings = read("settings");
    transition(app, settings.registration.requireInspection ? "for_inspection" : settings.registration.requireInsuranceVerification ? "for_insurance_verification" : "for_assessment", "Owner and motorcycle reviewed");
    saveApp(app);
    upsert("motorcycles", { ...moto, currentApplicationId: app.id, updatedAt: nowIso() });
    return app;
  }

  async recordPrint(id: string, what: "certificate" | "label" | "receipt"): Promise<void> {
    const app = findById("applications", id);
    audit(what === "certificate" ? "certificate_printed" : what === "label" ? "label_printed" : "receipt_printed", "Document", `${what[0].toUpperCase()}${what.slice(1)} printed`, { id, label: app?.transactionNumber });
  }

  async findByToken(tok: string) {
    await mockDelay(300, 600);
    refreshExpiry(read("motorcycles"));
    const app = read("applications").find((a) => a.verificationToken === tok && a.registrationNumber);
    if (!app) return null;
    const moto = findById("motorcycles", app.motorcycleId);
    if (!moto) return null;
    // Return the newest registration for this motorcycle so renewals are reflected.
    const latest = read("applications").filter((a) => a.motorcycleId === moto.id && a.status === "registered").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0] ?? app;
    return { motorcycle: moto, application: latest };
  }
}

