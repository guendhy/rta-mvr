import { addMonths, subDays } from "date-fns";
import { DOCUMENT_TYPES, provinceCode } from "@/lib/constants";
import { generators, token, uuid } from "@/lib/generators";
import { fullName } from "@/lib/formatting";
import type {
  AppNotification,
  AppSettings,
  ApplicationDocument,
  Assessment,
  AuditEvent,
  Counters,
  Fee,
  Inspection,
  InspectionCenter,
  InsuranceRecord,
  Motorcycle,
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
} from "@/types";
import type { ApplicationSpec, TargetStage } from "./applications";
import { auditEvent } from "./audit-logs";
import { buildInspection } from "./inspections";
import { buildInsurance } from "./insurance";
import { centerForOffice, OFFICE_IDS } from "./offices";
import { buildPayment } from "./payments";
import { USER_IDS } from "./users";

/** In-memory shape of the whole mock database. Mirrors the future Postgres schema. */
export interface MockDb {
  users: User[];
  permissions: RolePermissionMatrix;
  owners: Owner[];
  motorcycles: Motorcycle[];
  applications: RegistrationApplication[];
  inspections: Inspection[];
  insurance: InsuranceRecord[];
  fees: Fee[];
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
    inspector: userById(db, officeId === OFFICE_IDS.HGN ? USER_IDS.hagenInspection : USER_IDS.inspection),
    cashier: userById(db, officeId === OFFICE_IDS.KKP ? USER_IDS.kokopoCashier : USER_IDS.cashier),
    supervisor: userById(db, USER_IDS.supervisor),
    plate: userById(db, USER_IDS.plate),
  };
}

function terminalFor(db: MockDb, officeId: string): string {
  return db.terminals.find((t) => t.officeId === officeId && t.status === "online")?.terminalId ?? "RTA-POM-001";
}

export function feeAmount(db: Pick<MockDb, "fees">, code: Fee["code"]): Fee {
  const fee = db.fees.find((f) => f.code === code && f.active);
  if (!fee) throw new Error(`Fee ${code} is not configured.`);
  return fee;
}

export function buildAssessment(db: Pick<MockDb, "fees">, app: Pick<RegistrationApplication, "type">, moto: Pick<Motorcycle, "sidecar">, by: string, at: string, optional: Fee["code"][] = []): Assessment {
  const reg = feeAmount(db, moto.sidecar ? "REG_SIDECAR" : "REG_NO_SIDECAR");
  const lines = [{ feeCode: reg.code, name: reg.name, amount: reg.amount }];
  if (app.type === "new") {
    const plate = feeAmount(db, "NUMBER_PLATE");
    lines.push({ feeCode: plate.code, name: plate.name, amount: plate.amount });
  }
  for (const code of optional) {
    const fee = feeAmount(db, code);
    if (!lines.some((l) => l.feeCode === code)) lines.push({ feeCode: fee.code, name: fee.name, amount: fee.amount });
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), currency: "PGK", generatedAt: at, generatedBy: by };
}

export function emptyDocuments(type: "new" | "renewal"): ApplicationDocument[] {
  if (type === "renewal") return [];
  return DOCUMENT_TYPES.map((d) => ({ id: uuid(), type: d.type, status: "missing" }));
}

export function expiryFrom(start: Date, months: number): Date {
  return subDays(addMonths(start, months), 1);
}

/**
 * Builds one application and every related record by walking it through the real
 * workflow order. Used by the first-run seed and by Demo Tools scenario loading.
 */
export function buildApplication(db: MockDb, spec: ApplicationSpec & { at: Date; previousApplicationId?: string }, now: Date): RegistrationApplication {
  const moto = db.motorcycles[spec.moto] ?? db.motorcycles.find((m) => m.id === String(spec.moto));
  if (!moto) throw new Error("Seed motorcycle missing");
  const owner = db.owners.find((o) => o.id === moto.ownerId)!;
  const staff = staffFor(db, moto.officeId);
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
    currentStep: 1,
    officeId: moto.officeId,
    createdBy: staff.registration.id,
    createdByName: fullName(staff.registration),
    ownerId: owner.id,
    motorcycleId: moto.id,
    previousApplicationId: spec.previousApplicationId,
    draft: {},
    documents: emptyDocuments(spec.type),
    verificationToken: token(),
    history: [{ from: null, to: "draft", at: startedAt.toISOString(), by: staff.registration.id, byName: fullName(staff.registration) }],
    scenario: spec.scenario,
    createdAt: startedAt.toISOString(),
    updatedAt: startedAt.toISOString(),
  };
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
  if (spec.type === "new") {
    moto.createdAt = app.createdAt;
    moto.updatedAt = app.createdAt;
  }
  moto.currentApplicationId = app.id;

  log(staff.registration, spec.type === "renewal" ? "renewal_created" : "registration_created", "Registration", `${spec.type === "renewal" ? "Renewal" : "New registration"} started for ${fullName(owner)} — ${moto.make} ${moto.model}`);

  const upload = (type: ApplicationDocument["type"], verified: boolean) => {
    const doc = app.documents.find((d) => d.type === type);
    if (!doc) return;
    doc.status = verified ? "verified" : "uploaded";
    doc.file = { name: `${type.replace(/_/g, "-")}.pdf`, size: 180_000 + Math.round(Math.random() * 900_000), type: "application/pdf", uploadedAt: iso() };
    if (verified) {
      doc.verifiedBy = fullName(staff.registration);
      doc.verifiedAt = iso();
    }
  };

  // Draft: owner captured, motorcycle captured, documents partly uploaded.
  if (target === "draft") {
    tick(12);
    upload("owner_identification", false);
    app.currentStep = 3;
    app.updatedAt = iso();
    db.applications.push(app);
    return app;
  }

  // Documents + submission.
  tick(15);
  if (spec.type === "new") {
    for (const d of ["owner_identification", "proof_of_ownership", "import_purchase"] as const) upload(d, false);
  }
  app.currentStep = 3;
  app.submittedAt = iso();
  move("pending", staff.registration, "Submitted for document review");
  log(staff.registration, "registration_submitted", "Registration", "Application submitted");
  if (!reach("for_inspection")) {
    db.applications.push(app);
    return app;
  }

  tick(10);
  if (spec.type === "new" && !spec.docsUnverified) {
    for (const d of app.documents) if (d.status === "uploaded") {
      d.status = "verified";
      d.verifiedBy = fullName(staff.registration);
      d.verifiedAt = iso();
    }
  }
  move("for_inspection", staff.registration, "Documents reviewed — sent to inspection");

  // Inspection.
  const centerId = centerForOffice(app.officeId);
  if (target === "for_inspection" && spec.target !== "inspection_failed") {
    if (spec.scheduledInspection) {
      tick(5);
      const insp = buildInspection({ id: uuid(), applicationId: app.id, motorcycleId: moto.id, attempt: 1, centerId, inspectorId: staff.inspector.id, at: iso(), outcome: "scheduled" });
      db.inspections.push(insp);
      app.inspectionId = insp.id;
      log(staff.inspector, "inspection_scheduled", "Inspection", `Inspection scheduled at centre for ${moto.make} ${moto.model}`);
    }
    db.applications.push(app);
    return app;
  }
  tick(45);
  const failed = spec.target === "inspection_failed";
  const insp = buildInspection({
    id: uuid(),
    applicationId: app.id,
    motorcycleId: moto.id,
    attempt: 1,
    centerId,
    inspectorId: staff.inspector.id,
    at: iso(),
    outcome: failed ? "fail" : "pass",
    certificateNumber: failed ? undefined : generators.inspectionCertificateNumber(new Date(t), db.counters),
  });
  db.inspections.push(insp);
  app.inspectionId = insp.id;
  log(staff.inspector, "inspection_submitted", "Inspection", failed ? "Inspection FAILED — reinspection required" : `Inspection PASSED — certificate ${insp.certificateNumber}`);
  if (failed) {
    move("inspection_failed", staff.inspector, insp.failureReason);
    db.applications.push(app);
    return app;
  }
  const rwDoc = app.documents.find((d) => d.type === "roadworthiness_certificate");
  if (rwDoc) Object.assign(rwDoc, { status: "verified", file: { name: `${insp.certificateNumber}.pdf`, size: 98_000, type: "application/pdf", uploadedAt: iso() }, verifiedBy: fullName(staff.inspector), verifiedAt: iso(), note: "Generated from inspection" });
  move("for_insurance_verification", staff.inspector, `Roadworthy — ${insp.certificateNumber}`);

  // Insurance.
  tick(20);
  const insuranceStatus = target === "for_insurance_verification" ? spec.insuranceStatus ?? "pending" : "verified";
  const ins = buildInsurance({
    id: uuid(),
    applicationId: app.id,
    motorcycleId: moto.id,
    policyHolder: fullName(owner),
    vinOrChassis: moto.vin,
    at: iso(),
    status: insuranceStatus,
    index: db.insurance.length,
    verifiedBy: fullName(staff.registration),
  });
  db.insurance.push(ins);
  app.insuranceId = ins.id;
  if (target === "for_insurance_verification") {
    if (insuranceStatus === "expired") log(staff.registration, "insurance_flagged", "Insurance", `Policy ${ins.policyNumber} expired on ${ins.coverageExpiry}`);
    db.applications.push(app);
    return app;
  }
  const insDoc = app.documents.find((d) => d.type === "insurance_certificate");
  if (insDoc) Object.assign(insDoc, { status: "verified", file: ins.certificate, verifiedBy: fullName(staff.registration), verifiedAt: iso() });
  log(staff.registration, "insurance_verified", "Insurance", `Policy ${ins.policyNumber} verified with ${ins.provider}`);
  move("for_assessment", staff.registration, `Insurance verified — ${ins.policyNumber}`);
  if (!reach("payment_required")) {
    db.applications.push(app);
    return app;
  }

  // Assessment.
  tick(5);
  app.assessment = buildAssessment(db, app, moto, fullName(staff.registration), iso());
  log(staff.registration, "assessment_generated", "Assessment", `Assessment generated — K ${app.assessment.total.toFixed(2)}`);
  move("payment_required", staff.registration, `Total due K ${app.assessment.total.toFixed(2)}`);

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

  // Supervisor decision.
  tick(30);
  if (spec.target === "returned" || spec.target === "rejected") {
    const decision = spec.target;
    app.approval = { decision, by: staff.supervisor.id, byName: fullName(staff.supervisor), at: iso(), reason: spec.reason };
    if (decision === "returned") app.returnReason = spec.reason;
    else app.rejectReason = spec.reason;
    log(staff.supervisor, decision === "returned" ? "registration_returned" : "registration_rejected", "Registration", `${decision === "returned" ? "Returned for correction" : "Rejected"}: ${spec.reason}`);
    move(decision, staff.supervisor, spec.reason);
    db.applications.push(app);
    return app;
  }
  if (target === "for_approval") {
    db.applications.push(app);
    return app;
  }

  const approvedAt = new Date(t);
  const previous = spec.previousApplicationId ? db.applications.find((a) => a.id === spec.previousApplicationId) : undefined;
  app.registrationNumber = previous?.registrationNumber ?? generators.registrationNumber(provinceCode(moto.provinceOfOperation), approvedAt, db.counters);
  app.certificateNumber = generators.certificateNumber(approvedAt, db.counters);
  app.labelNumber = generators.labelNumber(approvedAt, db.counters);
  app.registrationDate = approvedAt.toISOString();
  const months = db.settings.registration.validityMonths;
  const prevExpiry = moto.registrationExpiry ? new Date(moto.registrationExpiry) : null;
  app.expiryDate = (spec.type === "renewal" && prevExpiry && prevExpiry > approvedAt ? addMonths(prevExpiry, months) : expiryFrom(approvedAt, months)).toISOString();
  app.approval = { decision: "approved", by: staff.supervisor.id, byName: fullName(staff.supervisor), at: iso() };
  log(staff.supervisor, "registration_approved", "Registration", `Approved — registration ${app.registrationNumber}`);

  if (spec.type === "renewal") {
    app.plateNumber = moto.plateNumber;
    move("registered", staff.supervisor, `Renewed until ${app.expiryDate.slice(0, 10)}`);
  } else if (target === "approved") {
    move("approved", staff.supervisor, "Awaiting plate assignment");
    db.applications.push(app);
    return app;
  } else {
    move("approved", staff.supervisor, "Awaiting plate assignment");
    tick(15);
    const plate = db.plates.find((p) => p.status === "available" && p.officeId === app.officeId) ?? db.plates.find((p) => p.status === "available");
    if (plate) {
      plate.status = "assigned";
      plate.motorcycleId = moto.id;
      plate.applicationId = app.id;
      plate.assignedDate = iso();
      plate.updatedAt = iso();
      app.plateNumber = plate.plateNumber;
      log(staff.plate, "plate_assigned", "Plate", `Plate ${plate.plateNumber} assigned to ${moto.make} ${moto.model}`);
    }
    move("registered", staff.plate, `Plate ${app.plateNumber}`);
  }
  app.completedAt = iso();

  moto.registrationNumber = app.registrationNumber;
  moto.plateNumber = app.plateNumber;
  moto.registrationDate = moto.registrationDate && spec.type === "renewal" ? moto.registrationDate : app.registrationDate;
  moto.registrationExpiry = app.expiryDate;
  moto.registrationStatus = new Date(app.expiryDate) < now ? "expired" : "registered";
  moto.updatedAt = iso();

  db.applications.push(app);
  return app;
}
