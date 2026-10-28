import { DEFAULT_DOCUMENT_RULES, type DocumentRule } from "@/config/document-requirements";
import { provinceCode } from "@/lib/constants";
import { applyCompletionToVehicle, approvalNumbers, labelOwnership } from "@/lib/completion";
import { calculateVehicleFees, monthsOverdue, toAssessment } from "@/lib/fees";
import { generators, token, uuid } from "@/lib/generators";
import { fullName } from "@/lib/formatting";
import { resolveApplicationRequirements, syncDocuments } from "@/lib/requirements";
import type {
  AppNotification,
  AppSettings,
  ApplicationDocument,
  Assessment,
  AuditEvent,
  Counters,
  FeeRule,
  Inspection,
  InspectionCenter,
  InsuranceRecord,
  Office,
  Owner,
  Payment,
  PaymentMethod,
  Plate,
  PosTerminal,
  RegistrationApplication,
  RegistrationStatus,
  RolePermissionMatrix,
  User,
  Vehicle,
} from "@/types";
import type { ApplicationSpec, TargetStage } from "./applications";
import { auditEvent } from "./audit-logs";
import { buildInspection } from "./inspections";
import { buildInsurance } from "./insurance";
import { centerForOffice, OFFICE_IDS, SEED_CENTERS } from "./offices";
import { buildPayment } from "./payments";
import { USER_IDS } from "./users";

/** In-memory shape of the whole mock database. Mirrors the future Postgres schema. */
export interface MockDb {
  users: User[];
  permissions: RolePermissionMatrix;
  owners: Owner[];
  vehicles: Vehicle[];
  applications: RegistrationApplication[];
  inspections: Inspection[];
  insurance: InsuranceRecord[];
  feeRules: FeeRule[];
  documentRules: DocumentRule[];
  payments: Payment[];
  plates: Plate[];
  audit: AuditEvent[];
  notifications: AppNotification[];
  terminals: PosTerminal[];
  offices: Office[];
  centers: InspectionCenter[];
  settings: AppSettings;
  counters: Counters;
}

const SEED_PLACEHOLDER = "2025-01-01T00:00:00.000Z";

const ORDER: TargetStage[] = [
  "draft",
  "pending",
  "for_inspection",
  "for_insurance_verification",
  "for_assessment",
  "payment_required",
  "for_approval",
  "approved",
  "registered",
];

function effective(target: TargetStage): TargetStage {
  if (target === "returned" || target === "rejected") return "for_approval";
  if (target === "inspection_failed") return "for_inspection";
  return target;
}

function userById(db: MockDb, id: string): User {
  return db.users.find((u) => u.id === id) ?? db.users[0];
}

function staffFor(db: MockDb, officeId: string) {
  return {
    registration: userById(db, officeId === OFFICE_IDS.LAE ? USER_IDS.laeRegistration : USER_IDS.registration),
    verification: userById(db, USER_IDS.verification),
    inspector: userById(db, officeId === OFFICE_IDS.HGN ? USER_IDS.hagenInspection : USER_IDS.inspection),
    cashier: userById(db, officeId === OFFICE_IDS.KKP ? USER_IDS.kokopoCashier : USER_IDS.cashier),
    supervisor: userById(db, USER_IDS.supervisor),
    plate: userById(db, USER_IDS.plate),
  };
}

function terminalFor(db: MockDb, officeId: string): string {
  return db.terminals.find((t) => t.officeId === officeId && t.status === "online")?.terminalId ?? "RTA-POM-001";
}

/** Fee assessment for an application, from the configured rules. */
export function buildAssessment(
  db: Pick<MockDb, "feeRules">,
  app: Pick<RegistrationApplication, "type" | "inspectionRequired" | "plateRequired" | "draft">,
  vehicle: Vehicle,
  by: string,
  at: string,
  opts: { optionalCodes?: string[]; periodMonths?: number; outstandingBalance?: number } = {},
): Assessment {
  const cls = app.type === "reclassification" ? { ...vehicle, ...app.draft.classification } : vehicle;
  const overdue = app.type === "renewal" || app.type === "reinstatement" ? monthsOverdue(vehicle.registrationExpiry, new Date(at)) : 0;
  const result = calculateVehicleFees({
    transactionType: app.type,
    vehicleType: cls.vehicleType,
    vehicleClass: cls.vehicleClass,
    vehicleUsage: cls.vehicleUsage,
    specifications: { ...vehicle.specifications, ...(app.draft.vehicle?.specifications ?? {}) },
    registrationPeriodMonths: opts.periodMonths ?? 12,
    inspectionRequired: app.inspectionRequired,
    newPlate: app.plateRequired,
    monthsOverdue: overdue,
    outstandingBalance: opts.outstandingBalance,
    optionalCodes: opts.optionalCodes,
    rules: db.feeRules,
  });
  return toAssessment(result, by, at);
}

/** Documents that apply to this application right now. */
export function documentsFor(db: Pick<MockDb, "documentRules">, app: Pick<RegistrationApplication, "type" | "documents" | "draft">, vehicle: Vehicle | null | undefined, owner: Owner | null | undefined): { documents: ApplicationDocument[]; inspectionRequired: boolean; insuranceRequired: boolean; plateRequired: boolean } {
  const cls = app.type === "reclassification" ? { ...vehicle, ...app.draft.classification } : vehicle ?? app.draft.classification;
  const req = resolveApplicationRequirements(
    {
      transactionType: app.type,
      vehicleType: cls?.vehicleType,
      vehicleUsage: cls?.vehicleUsage,
      ownershipType: owner?.ownershipType,
      importStatus: vehicle?.importStatus ?? app.draft.vehicle?.importStatus,
      technicalChange: app.type === "change_vehicle" && !!app.draft.vehicle?.specifications,
    },
    db.documentRules?.length ? db.documentRules : DEFAULT_DOCUMENT_RULES,
  );
  return { documents: syncDocuments(app.documents, req.documents), inspectionRequired: req.inspectionRequired, insuranceRequired: req.insuranceRequired, plateRequired: req.plateRequired };
}

/** Takes the next available plate of the right series, preferring the vehicle's office. */
export function pickPlate(plates: Plate[], vehicle: Vehicle, officeId: string): Plate | undefined {
  const cat = vehicle.plateCategory ?? "private";
  return plates.find((p) => p.status === "available" && p.category === cat && p.officeId === officeId) ?? plates.find((p) => p.status === "available" && p.category === cat);
}

/**
 * Builds one transaction and every related record by walking it through the real workflow
 * order. Used by the first-run seed and by Demo Tools scenario loading.
 */
export function buildApplication(db: MockDb, spec: ApplicationSpec & { at: Date; previousApplicationId?: string }, now: Date): RegistrationApplication {
  const vehicle = db.vehicles[spec.vehicle] ?? db.vehicles.find((v) => v.id === String(spec.vehicle));
  if (!vehicle) throw new Error("Seed vehicle missing");
  const owner = db.owners.find((o) => o.id === vehicle.ownerId)!;
  const newOwner = spec.newOwner !== undefined ? db.owners[spec.newOwner] : undefined;
  const staff = staffFor(db, vehicle.officeId);
  const target = effective(spec.target);
  const reach = (s: TargetStage) => ORDER.indexOf(target) >= ORDER.indexOf(s);

  let t = spec.at.getTime();
  const cap = now.getTime() - 60_000;
  const tick = (minutes: number) => {
    t = Math.min(t + minutes * 60_000, cap);
    return new Date(t);
  };
  const iso = () => new Date(t).toISOString();

  const startedAt = new Date(Math.min(t, cap));
  const app: RegistrationApplication = {
    id: uuid(),
    transactionNumber: generators.transactionNumber(now, db.counters),
    type: spec.type,
    status: "draft",
    currentStep: 2,
    officeId: vehicle.officeId,
    createdBy: staff.registration.id,
    createdByName: fullName(staff.registration),
    assignedOfficerId: staff.registration.id,
    assignedOfficerName: fullName(staff.registration),
    ownerId: owner.id,
    vehicleId: vehicle.id,
    previousApplicationId: spec.previousApplicationId,
    draft: spec.reclassifyTo ? { classification: { ...spec.reclassifyTo, vehicleClass: vehicle.vehicleClass } } : {},
    documents: [],
    inspectionRequired: false,
    insuranceRequired: false,
    plateRequired: false,
    verificationToken: token(),
    history: [{ from: null, to: "draft", at: startedAt.toISOString(), by: staff.registration.id, byName: fullName(staff.registration) }],
    scenario: spec.scenario,
    createdAt: startedAt.toISOString(),
    updatedAt: startedAt.toISOString(),
  };
  if (spec.type === "transfer" && newOwner) {
    app.transfer = { previousOwnerId: owner.id, newOwnerId: newOwner.id, saleDate: startedAt.toISOString().slice(0, 10), salePrice: 45_000, reason: "sale", sellerConsent: true };
  }
  if (spec.reclassifyTo) {
    app.changeRequest = { summary: `Reclassify ${vehicle.vehicleUsage} → ${spec.reclassifyTo.vehicleUsage}`, changes: [{ field: "vehicleUsage", label: "Vehicle use", from: vehicle.vehicleUsage, to: spec.reclassifyTo.vehicleUsage }] };
  }
  if (spec.closureReason) app.closureReason = spec.closureReason;
  Object.assign(app, documentsFor(db, app, vehicle, newOwner ?? owner));

  const label = { id: app.id, label: app.transactionNumber };
  const log = (actor: User, action: AuditEvent["action"], entity: string, description: string) =>
    db.audit.push(auditEvent(actor, action, entity, description, iso(), label));
  const move = (to: RegistrationStatus, actor: User, note?: string) => {
    app.history.push({ from: app.status, to, at: iso(), by: actor.id, byName: fullName(actor), note });
    app.status = to;
    app.updatedAt = iso();
  };

  if (owner.createdAt === SEED_PLACEHOLDER || owner.createdAt > app.createdAt) {
    owner.createdAt = app.createdAt;
    owner.updatedAt = app.createdAt;
  }
  if (newOwner && (newOwner.createdAt === SEED_PLACEHOLDER || newOwner.createdAt > app.createdAt)) {
    newOwner.createdAt = app.createdAt;
    newOwner.updatedAt = app.createdAt;
  }
  if (spec.type === "new") {
    vehicle.createdAt = app.createdAt;
    vehicle.updatedAt = app.createdAt;
  }
  vehicle.currentApplicationId = app.id;

  const vLabel = `${vehicle.make} ${vehicle.model}`;
  log(staff.registration, spec.type === "renewal" ? "renewal_created" : "registration_created", "Registration", `${spec.type === "new" ? "New registration" : spec.type.replace(/_/g, " ")} started for ${fullName(owner)} — ${vLabel}`);

  const upload = (type: ApplicationDocument["type"], verified: boolean) => {
    const doc = app.documents.find((d) => d.type === type);
    if (!doc) return;
    doc.status = verified ? "verified" : "uploaded";
    doc.file = { name: `${type.replace(/_/g, "-")}.pdf`, size: 180_000 + Math.round(Math.random() * 900_000), type: "application/pdf", uploadedAt: iso() };
    if (verified) {
      doc.verifiedBy = fullName(staff.verification);
      doc.verifiedAt = iso();
    }
  };
  const generated = new Set(["inspection_certificate", "insurance_certificate"]);

  // Draft: owner and vehicle captured, identity uploaded.
  if (target === "draft") {
    tick(12);
    upload("proof_of_identity", false);
    app.currentStep = 5;
    app.updatedAt = iso();
    db.applications.push(app);
    return app;
  }

  // Documents + submission.
  tick(15);
  for (const d of app.documents) if (d.required && !generated.has(d.type)) upload(d.type, false);
  app.currentStep = 5;
  app.submittedAt = iso();
  move("pending", staff.registration, "Submitted for verification");
  log(staff.registration, "registration_submitted", "Registration", "Application submitted");
  if (target === "pending") {
    db.applications.push(app);
    return app;
  }

  tick(10);
  if (!spec.docsUnverified) {
    for (const d of app.documents) if (d.status === "uploaded") {
      d.status = "verified";
      d.verifiedBy = fullName(staff.verification);
      d.verifiedAt = iso();
    }
    log(staff.verification, "document_verified", "Document", "Supporting documents verified");
  }

  // Inspection (only when the rules require it).
  const centerId = centerForOffice(app.officeId);
  const center = SEED_CENTERS.find((c) => c.id === centerId);
  if (app.inspectionRequired) {
    move("for_inspection", staff.verification, "Documents verified — sent to inspection");
    if (target === "for_inspection" && spec.target !== "inspection_failed") {
      if (spec.scheduledInspection) {
        tick(5);
        const insp = buildInspection({ id: uuid(), applicationId: app.id, vehicleId: vehicle.id, vehicleType: vehicle.vehicleType, attempt: 1, centerId, location: center?.name, inspectorId: staff.inspector.id, at: iso(), outcome: "scheduled", reference: generators.inspectionReference(provinceCode(vehicle.provinceOfOperation), new Date(t), db.counters) });
        db.inspections.push(insp);
        app.inspectionId = insp.id;
        log(staff.inspector, "inspection_scheduled", "Inspection", `Inspection scheduled for ${vLabel}`);
      }
      db.applications.push(app);
      return app;
    }
    tick(45);
    const failed = spec.target === "inspection_failed";
    const odo = 4000 + (spec.vehicle * 7919) % 180000;
    const insp = buildInspection({
      id: uuid(),
      applicationId: app.id,
      vehicleId: vehicle.id,
      vehicleType: vehicle.vehicleType,
      attempt: 1,
      centerId,
      location: center?.name,
      inspectorId: staff.inspector.id,
      at: iso(),
      outcome: failed ? "fail" : "pass",
      reference: generators.inspectionReference(provinceCode(vehicle.provinceOfOperation), new Date(t), db.counters),
      certificateNumber: failed ? undefined : generators.inspectionCertificateNumber(new Date(t), db.counters),
      odometerKm: spec.type === "new" && vehicle.year >= 2024 ? 12 + spec.vehicle : odo,
    });
    db.inspections.push(insp);
    app.inspectionId = insp.id;
    log(staff.inspector, "inspection_submitted", "Inspection", failed ? "Inspection FAILED — reinspection required" : `Inspection PASSED — certificate ${insp.certificateNumber}`);
    if (failed) {
      move("inspection_failed", staff.inspector, insp.failureReason);
      db.applications.push(app);
      return app;
    }
    const rwDoc = app.documents.find((d) => d.type === "inspection_certificate");
    if (rwDoc) Object.assign(rwDoc, { status: "verified", file: { name: `${insp.certificateNumber}.pdf`, size: 98_000, type: "application/pdf", uploadedAt: iso() }, verifiedBy: fullName(staff.inspector), verifiedAt: iso(), note: "Generated from inspection" });
  }

  // Insurance.
  if (app.insuranceRequired) {
    move("for_insurance_verification", app.inspectionRequired ? staff.inspector : staff.verification, app.inspectionRequired ? "Inspection passed" : "Documents verified");
    tick(20);
    const insuranceStatus = target === "for_insurance_verification" ? spec.insuranceStatus ?? "pending" : "verified";
    const holder = newOwner ?? owner;
    const ins = buildInsurance({
      id: uuid(),
      applicationId: app.id,
      vehicleId: vehicle.id,
      policyHolder: fullName(holder),
      vinOrChassis: vehicle.vin,
      at: iso(),
      status: insuranceStatus,
      index: db.insurance.length,
      verifiedBy: fullName(staff.verification),
      premium: vehicle.vehicleType === "motorcycle" || vehicle.vehicleType === "scooter" ? undefined : 240 + (spec.vehicle % 5) * 60,
    });
    db.insurance.push(ins);
    app.insuranceId = ins.id;
    if (target === "for_insurance_verification") {
      if (insuranceStatus === "expired") log(staff.verification, "insurance_flagged", "Insurance", `Policy ${ins.policyNumber} expired on ${ins.coverageExpiry}`);
      db.applications.push(app);
      return app;
    }
    const insDoc = app.documents.find((d) => d.type === "insurance_certificate");
    if (insDoc) Object.assign(insDoc, { status: "verified", file: ins.certificate, verifiedBy: fullName(staff.verification), verifiedAt: iso() });
    log(staff.verification, "insurance_verified", "Insurance", `Policy ${ins.policyNumber} verified with ${ins.provider}`);
    move("for_assessment", staff.verification, `Insurance verified — ${ins.policyNumber}`);
  } else {
    move("for_assessment", staff.verification, "Ready for assessment");
  }
  if (!reach("payment_required")) {
    db.applications.push(app);
    return app;
  }

  // Assessment.
  tick(5);
  app.assessment = buildAssessment(db, app, vehicle, fullName(staff.registration), iso());
  log(staff.registration, "assessment_generated", "Assessment", `Assessment generated — K ${app.assessment.total.toFixed(2)}`);
  move("payment_required", staff.registration, `Total due K ${app.assessment.total.toFixed(2)}`);

  if (app.assessment.total === 0) {
    move("paid", staff.registration, "No amount due");
    move("for_approval", staff.registration, "Sent for supervisor approval");
  } else {
    // Payments (failed attempts first, then the successful one if the target is past payment).
    const method: PaymentMethod = spec.method ?? "pos";
    let attempt = 0;
    for (const f of spec.failedAttempts ?? []) {
      tick(6);
      attempt++;
      const p = buildPayment({
        id: uuid(), applicationId: app.id, method: "pos", amount: app.assessment.total, status: f === "declined" ? "declined" : "failed",
        attempt, at: new Date(t), officeId: app.officeId, cashierId: staff.cashier.id, cashierName: fullName(staff.cashier),
        terminalId: terminalFor(db, app.officeId), counters: db.counters, index: db.payments.length,
      });
      db.payments.push(p);
      log(staff.cashier, "payment_failed", "Payment", `POS payment ${p.reference} ${p.status} — ${p.failureReason}`);
    }
    if (!reach("for_approval")) {
      db.applications.push(app);
      return app;
    }
    tick(8);
    attempt++;
    const pay = buildPayment({
      id: uuid(), applicationId: app.id, method, amount: app.assessment.total, status: "successful", attempt, at: new Date(t),
      officeId: app.officeId, cashierId: staff.cashier.id, cashierName: fullName(staff.cashier), terminalId: terminalFor(db, app.officeId),
      counters: db.counters, index: db.payments.length,
    });
    db.payments.push(pay);
    app.paymentId = pay.id;
    log(staff.cashier, "payment_processed", "Payment", `Payment ${pay.reference} received — K ${pay.amount.toFixed(2)} (${method.replace("_", " ")}) · receipt ${pay.receiptNumber}`);
    move("paid", staff.cashier, `Receipt ${pay.receiptNumber}`);
    move("for_approval", staff.cashier, "Sent for supervisor approval");
  }

  // Supervisor decision.
  tick(30);
  if (spec.target === "returned" || spec.target === "rejected") {
    const decision = spec.target;
    app.approval = { decision, by: staff.supervisor.id, byName: fullName(staff.supervisor), at: iso(), reason: spec.reason };
    if (decision === "returned") app.returnReason = spec.reason;
    else app.rejectReason = spec.reason;
    log(staff.supervisor, decision === "returned" ? "registration_returned" : "registration_rejected", "Registration", `${decision === "returned" ? "Returned for correction" : "Rejected"}: ${spec.reason}`);
    move(decision, staff.supervisor, spec.reason);
    if (decision === "rejected") vehicle.currentApplicationId = undefined;
    db.applications.push(app);
    return app;
  }
  if (target === "for_approval") {
    db.applications.push(app);
    return app;
  }

  const approvedAt = new Date(t);
  Object.assign(app, approvalNumbers(app, vehicle, db.settings, approvedAt, db.counters));
  app.approval = { decision: "approved", by: staff.supervisor.id, byName: fullName(staff.supervisor), at: iso() };
  log(staff.supervisor, "registration_approved", "Registration", `Approved — registration ${app.registrationNumber}`);

  if (app.plateRequired) {
    move("approved", staff.supervisor, "Awaiting plate assignment");
    if (target === "approved") {
      db.applications.push(app);
      return app;
    }
    tick(15);
    const plate = pickPlate(db.plates, vehicle, app.officeId);
    if (plate) {
      const old = vehicle.plateNumber ? db.plates.find((p) => p.plateNumber === vehicle.plateNumber) : undefined;
      if (old) Object.assign(old, { status: "released", vehicleId: undefined, applicationId: undefined, notes: `Released — replaced by ${plate.plateNumber}`, updatedAt: iso() });
      Object.assign(plate, { status: "assigned", vehicleId: vehicle.id, applicationId: app.id, assignedDate: iso(), updatedAt: iso() });
      app.plateNumber = plate.plateNumber;
      log(staff.plate, "plate_assigned", "Plate", `Plate ${plate.plateNumber} assigned to ${vLabel}`);
    }
    move("registered", staff.plate, `Plate ${app.plateNumber}`);
  } else {
    app.plateNumber = vehicle.plateNumber;
    move("registered", staff.supervisor, app.type === "renewal" ? `Renewed until ${app.expiryDate?.slice(0, 10)}` : "Approved and completed");
  }
  app.completedAt = iso();

  const updated = applyCompletionToVehicle(app, vehicle, { now: approvedAt, newOwner });
  if (updated.registrationExpiry && new Date(updated.registrationExpiry) < now && updated.registrationStatus === "active") updated.registrationStatus = "expired";
  Object.assign(vehicle, labelOwnership(updated, db.owners));
  if (app.type === "transfer") log(staff.supervisor, "ownership_transferred", "Vehicle", `Ownership transferred from ${fullName(owner)} to ${fullName(newOwner)}`);
  if (app.type === "deregistration" && vehicle.plateNumber) {
    const plate = db.plates.find((p) => p.plateNumber === vehicle.plateNumber);
    if (plate) Object.assign(plate, { status: "released", vehicleId: undefined, applicationId: undefined, notes: "Returned at deregistration", updatedAt: iso() });
  }

  db.applications.push(app);
  return app;
}
