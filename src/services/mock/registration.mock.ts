import { documentsFor } from "@/data/mock/builder";
import { firstCaptureStep, getTransactionType, transactionLabel } from "@/config/transaction-types";
import { REGISTRATION_STATUS } from "@/config/statuses";
import { applyCompletionToVehicle, applyOwnerChanges, approvalNumbers, labelOwnership, needsPlateAssignment } from "@/lib/completion";
import { ServiceError } from "@/lib/errors";
import { fullName } from "@/lib/formatting";
import { generators, token, uuid } from "@/lib/generators";
import { mockDelay } from "@/lib/mock-delay";
import { approvalChecklist, assertTransition, documentsChecklist, isEditable, nextAfterSubmission } from "@/lib/workflow";
import type { RegistrationDetail, RegistrationListFilter, RegistrationService } from "../interfaces";
import type {
  ApplicationDocument,
  ChangeRequest,
  CreateRegistrationInput,
  DocumentType,
  FileMeta,
  RegistrationApplication,
  RegistrationStatus,
  TransactionType,
  TransferDetails,
  UpdateRegistrationInput,
  VehicleClassification,
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
import { refreshExpiry } from "./vehicle.mock";

const CLOSED: RegistrationStatus[] = ["registered", "rejected", "cancelled"];

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
  return {
    application: app,
    owner: findById("owners", app.ownerId),
    vehicle: findById("vehicles", app.vehicleId),
    newOwner: findById("owners", app.transfer?.newOwnerId),
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

/** Re-resolves documents, inspection, insurance and plate rules for the current data. */
export function applyRequirements(app: RegistrationApplication): RegistrationApplication {
  const vehicle = findById("vehicles", app.vehicleId);
  const owner = findById("owners", app.transfer?.newOwnerId) ?? findById("owners", app.ownerId);
  Object.assign(app, documentsFor({ documentRules: read("documentRules") }, app, vehicle, owner));
  return app;
}

function matches(app: RegistrationApplication, q: string) {
  const owner = findById("owners", app.ownerId);
  const v = findById("vehicles", app.vehicleId);
  const hay = [app.transactionNumber, app.registrationNumber, app.plateNumber, owner && fullName(owner), owner?.mobile, v?.engineNumber, v?.chassisNumber, v?.vin, v?.make, v?.model, v?.plateNumber, v?.registrationNumber]
    .filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

function releaseVehicle(vehicleId: string | undefined, appId: string) {
  const v = findById("vehicles", vehicleId);
  if (v?.currentApplicationId === appId) upsert("vehicles", { ...v, currentApplicationId: undefined, updatedAt: nowIso() });
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
    if (filter.type) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      list = list.filter((a) => types.includes(a.type));
    }
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
    refreshExpiry(read("vehicles"));
    const app = findById("applications", id) ?? read("applications").find((a) => a.transactionNumber === id) ?? null;
    return app ? detailFor(app) : null;
  }

  async create(input: CreateRegistrationInput): Promise<RegistrationApplication> {
    const permission = input.type === "renewal" ? "renewal.create" : input.type === "transfer" ? "transfer.create" : "registration.create";
    requirePermission(permission, `start a ${transactionLabel(input.type).toLowerCase()}`);
    await mockDelay();
    simulateNetwork();
    const a = actor();
    const ts = nowIso();
    const app: RegistrationApplication = {
      id: uuid(),
      transactionNumber: generators.transactionNumber(),
      type: input.type,
      status: "draft",
      currentStep: 2,
      officeId: input.officeId,
      createdBy: a.id,
      createdByName: actorName(),
      assignedOfficerId: a.id,
      assignedOfficerName: actorName(),
      ownerId: input.ownerId,
      vehicleId: input.vehicleId,
      previousApplicationId: input.previousApplicationId,
      draft: { ownerMode: "search" },
      documents: [],
      inspectionRequired: false,
      insuranceRequired: false,
      plateRequired: false,
      verificationToken: token(),
      history: [{ from: null, to: "draft", at: ts, by: a.id, byName: actorName() }],
      createdAt: ts,
      updatedAt: ts,
    };
    applyRequirements(app);
    upsert("applications", app);
    audit(input.type === "renewal" ? "renewal_created" : "registration_created", "Registration", `${transactionLabel(input.type)} ${app.transactionNumber} started`, { id: app.id, label: app.transactionNumber });
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
    app.draft = {
      ...app.draft,
      ...draft,
      owner: { ...app.draft.owner, ...draft.owner },
      classification: { ...app.draft.classification, ...draft.classification },
      vehicle: { ...app.draft.vehicle, ...draft.vehicle },
    };
    app.currentStep = Math.max(2, Math.min(step, 5));
    return saveApp(app);
  }

  async attachOwner(id: string, ownerId: string): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "edit registrations");
    await mockDelay(150, 400);
    const app = loadApp(id);
    if (!isEditable(app)) throw new ServiceError("workflow", "This application can no longer be edited.");
    mustFind("owners", ownerId, "Owner");
    if (app.type === "transfer") {
      if (!app.transfer) throw new ServiceError("workflow", "Start the transfer from the vehicle record.");
      if (ownerId === app.transfer.previousOwnerId) throw new ServiceError("validation", "The new owner must be different from the current owner.");
      app.transfer = { ...app.transfer, newOwnerId: ownerId };
    } else {
      app.ownerId = ownerId;
    }
    app.currentStep = Math.max(app.currentStep, 3);
    applyRequirements(app);
    return saveApp(app);
  }

  async attachVehicle(id: string, vehicleId: string): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "edit registrations");
    await mockDelay(150, 400);
    const app = loadApp(id);
    if (!isEditable(app)) throw new ServiceError("workflow", "This application can no longer be edited.");
    const v = mustFind("vehicles", vehicleId, "Vehicle");
    const active = read("applications").find((a) => a.id !== id && a.vehicleId === vehicleId && !CLOSED.includes(a.status) && a.status !== "draft");
    if (active) throw new ServiceError("conflict", `Vehicle already has an active application (${active.transactionNumber}).`);
    app.vehicleId = v.id;
    app.currentStep = Math.max(app.currentStep, 5);
    applyRequirements(app);
    upsert("vehicles", { ...v, currentApplicationId: app.id, updatedAt: nowIso() });
    return saveApp(app);
  }

  async saveClassification(id: string, classification: VehicleClassification): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "edit registrations");
    await mockDelay(150, 350);
    const app = loadApp(id);
    if (!isEditable(app)) throw new ServiceError("workflow", "This application can no longer be edited.");
    app.draft = { ...app.draft, classification };
    app.currentStep = Math.max(app.currentStep, 4);
    // A new-registration vehicle already captured follows its classification.
    const v = findById("vehicles", app.vehicleId);
    if (v && app.type === "new") {
      upsert("vehicles", { ...v, ...classification, updatedAt: nowIso() });
    }
    applyRequirements(app);
    return saveApp(app);
  }

  async refreshRequirements(id: string): Promise<RegistrationApplication> {
    await mockDelay(100, 250);
    const app = loadApp(id);
    if (!isEditable(app)) return app;
    applyRequirements(app);
    return saveApp(app);
  }

  async setTransfer(id: string, transfer: TransferDetails): Promise<RegistrationApplication> {
    requirePermission("transfer.create", "process transfers");
    await mockDelay(150, 350);
    const app = loadApp(id);
    if (!isEditable(app)) throw new ServiceError("workflow", "This transfer can no longer be edited.");
    if (transfer.newOwnerId && transfer.newOwnerId === transfer.previousOwnerId) throw new ServiceError("validation", "The new owner must be different from the current owner.");
    app.transfer = transfer;
    applyRequirements(app);
    return saveApp(app);
  }

  async setChangeRequest(id: string, change: ChangeRequest, draft?: WizardDraft, closureReason?: string): Promise<RegistrationApplication> {
    requirePermission("registration.edit", "edit registrations");
    await mockDelay(150, 350);
    const app = loadApp(id);
    if (!isEditable(app)) throw new ServiceError("workflow", "This application can no longer be edited.");
    app.changeRequest = change;
    if (draft) app.draft = { ...app.draft, ...draft };
    if (closureReason !== undefined) app.closureReason = closureReason;
    applyRequirements(app);
    return saveApp(app);
  }

  async uploadDocument(id: string, type: DocumentType, file: FileMeta): Promise<ApplicationDocument> {
    requirePermission("registration.edit", "upload documents");
    await mockDelay(300, 700);
    simulateNetwork();
    const app = loadApp(id);
    let doc = app.documents.find((d) => d.type === type);
    if (!doc) {
      doc = { id: uuid(), type, status: "missing", required: false, reason: "Added by officer" };
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
    if (!app.ownerId) throw new ServiceError("validation", "Application incomplete — select or create the registered owner first.");
    if (!app.vehicleId) throw new ServiceError("validation", "Application incomplete — capture the vehicle details first.");
    if (app.type === "transfer" && !app.transfer?.newOwnerId) throw new ServiceError("validation", "Application incomplete — select the new owner.");
    if (["change_vehicle", "reclassification", "registration_transfer"].includes(app.type) && !app.changeRequest?.changes.length) throw new ServiceError("validation", "Application incomplete — record the requested changes.");
    if (app.type === "deregistration" && !app.closureReason?.trim()) throw new ServiceError("validation", "Application incomplete — record the reason for deregistration.");
    applyRequirements(app);
    const docs = documentsChecklist(app);
    if (!docs.present) throw new ServiceError("validation", `Required document missing: ${docs.missing.map((m) => m.replace(/_/g, " ")).join(", ")}.`);
    if (app.documents.some((d) => d.required && d.status === "rejected")) throw new ServiceError("validation", "Replace rejected documents before submitting.");
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
    releaseVehicle(app.vehicleId, id);
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
    const vehicle = d.vehicle!;
    const now = new Date();
    Object.assign(app, approvalNumbers(app, vehicle, settings, now));
    app.approval = { decision: "approved", by: actor().id, byName: actorName(), at: nowIso() };

    const needsPlate = needsPlateAssignment(app, settings);
    if (needsPlate) {
      transition(app, "approved", "Approved — awaiting plate assignment");
    } else {
      app.plateNumber = vehicle.plateNumber;
      app.completedAt = nowIso();
      transition(app, "registered", `${transactionLabel(app.type)} approved`);
      completeVehicle(app);
    }
    saveApp(app);
    audit("registration_approved", "Registration", `${app.transactionNumber} approved — ${app.registrationNumber}`, { id, label: app.transactionNumber });
    notify("Transaction Approved", `${app.transactionNumber} approved${needsPlate ? " — assign a number plate" : ""}.`, "success", needsPlate ? "/plates?tab=assign" : `/registrations/${id}`);
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
    notify("Application Returned", `${app.transactionNumber} returned for correction.`, "warning", `/registrations/${id}`);
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
    releaseVehicle(app.vehicleId, id);
    audit("registration_rejected", "Registration", `${app.transactionNumber} rejected: ${reason}`, { id, label: app.transactionNumber });
    notify("Application Rejected", `${app.transactionNumber} was rejected.`, "danger", `/registrations/${id}`);
    return app;
  }

  async createRenewal(vehicleId: string): Promise<RegistrationApplication> {
    return this.createForVehicle("renewal", vehicleId);
  }

  async createForVehicle(type: TransactionType, vehicleId: string): Promise<RegistrationApplication> {
    const def = getTransactionType(type);
    if (!def.needsExistingVehicle) throw new ServiceError("validation", "This transaction starts from a new vehicle.");
    await mockDelay(300, 600);
    simulateNetwork();
    refreshExpiry(read("vehicles"));
    const v = mustFind("vehicles", vehicleId, "Vehicle");
    if (!v.registrationNumber) throw new ServiceError("workflow", "No registrations found — this vehicle has never been registered.");
    if (v.registrationStatus === "deregistered") throw new ServiceError("workflow", "This vehicle is deregistered. Only RTA administrators can restore it.");
    if (type === "reinstatement" && !["suspended", "cancelled"].includes(v.registrationStatus)) throw new ServiceError("workflow", "Only suspended or cancelled registrations can be reinstated.");
    if (type !== "reinstatement" && ["suspended", "cancelled"].includes(v.registrationStatus)) throw new ServiceError("workflow", `This registration is ${v.registrationStatus}. Resolve the registration issue (reinstatement) first.`);
    if (type === "renewal" && v.registrationExpiry && new Date(v.registrationExpiry).getTime() - Date.now() > 90 * 86_400_000) {
      throw new ServiceError("workflow", "Registration already renewed — the current registration is valid for more than 90 days.");
    }
    const open = read("applications").find((a) => a.vehicleId === vehicleId && !CLOSED.includes(a.status));
    if (open) throw new ServiceError("conflict", `An application is already open for this vehicle (${open.transactionNumber}).`);
    const previous = read("applications")
      .filter((a) => a.vehicleId === vehicleId && a.status === "registered")
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
    const app = await this.create({ type, officeId: actor().officeId, ownerId: v.ownerId, vehicleId, previousApplicationId: previous?.id });
    if (type === "transfer") app.transfer = { previousOwnerId: v.ownerId, reason: "sale", sellerConsent: false };
    if (type === "reclassification") app.draft = { ...app.draft, classification: { vehicleType: v.vehicleType, vehicleClass: v.vehicleClass, vehicleUsage: v.vehicleUsage, bodyType: v.bodyType } };
    app.currentStep = firstCaptureStep(type);
    applyRequirements(app);
    // Renewals with nothing to upload go straight to processing.
    if (type === "renewal" && documentsChecklist(app).present) {
      app.submittedAt = nowIso();
      transition(app, "pending", "Renewal started — owner and vehicle on record");
      const d = detailFor(app);
      transition(app, nextAfterSubmission(app, { inspection: d.inspection, insurance: d.insurance, payment: d.payment, settings: read("settings") }), "Owner and vehicle reviewed");
    }
    saveApp(app);
    upsert("vehicles", { ...v, currentApplicationId: app.id, updatedAt: nowIso() });
    return app;
  }

  async recordPrint(id: string, what: "certificate" | "label" | "receipt"): Promise<void> {
    const app = findById("applications", id);
    audit(what === "certificate" ? "certificate_printed" : what === "label" ? "label_printed" : "receipt_printed", "Document", `${what[0].toUpperCase()}${what.slice(1)} printed`, { id, label: app?.transactionNumber });
  }

  async findByToken(tok: string) {
    await mockDelay(300, 600);
    refreshExpiry(read("vehicles"));
    const app = read("applications").find((a) => a.verificationToken === tok && a.registrationNumber);
    if (!app) return null;
    const vehicle = findById("vehicles", app.vehicleId);
    if (!vehicle) return null;
    // Return the newest completed transaction for this vehicle so renewals and transfers are reflected.
    const latest = read("applications").filter((a) => a.vehicleId === vehicle.id && a.status === "registered").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0] ?? app;
    return { vehicle, owner: findById("owners", vehicle.ownerId), application: latest };
  }
}

/** Writes the completed transaction onto the vehicle (and owner) records. */
export function completeVehicle(app: RegistrationApplication) {
  const vehicle = mustFind("vehicles", app.vehicleId, "Vehicle");
  const newOwner = findById("owners", app.transfer?.newOwnerId);
  const now = new Date();
  const next = labelOwnership(applyCompletionToVehicle(app, vehicle, { now, newOwner }), read("owners"));
  upsert("vehicles", next);
  if (app.type === "transfer" && newOwner) {
    audit("ownership_transferred", "Vehicle", `Ownership of ${next.registrationNumber} transferred from ${fullName(findById("owners", vehicle.ownerId))} to ${fullName(newOwner)}`, { id: vehicle.id, label: next.registrationNumber });
  }
  if (app.type === "change_owner") {
    const owner = findById("owners", app.ownerId);
    if (owner) upsert("owners", applyOwnerChanges(owner, app, nowIso()));
  }
  if (app.type === "deregistration" && vehicle.plateNumber) {
    const plate = read("plates").find((p) => p.plateNumber === vehicle.plateNumber);
    if (plate) upsert("plates", { ...plate, status: "released", vehicleId: undefined, applicationId: undefined, notes: "Returned at deregistration", updatedAt: nowIso() });
  }
  if (vehicle.registrationStatus !== next.registrationStatus) {
    audit("vehicle_status_changed", "Vehicle", `${next.registrationNumber}: ${vehicle.registrationStatus} → ${next.registrationStatus}`, { id: vehicle.id, label: next.registrationNumber });
  }
}
