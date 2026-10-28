/**
 * Service contracts. Pages and components depend only on these interfaces; Phase 1
 * provides Mock* implementations, Phase 2 adds Supabase* implementations with the
 * same signatures (see docs/PHASE_2_SUPABASE_PLAN.md).
 */
import type {
  AppNotification,
  AppSettings,
  ApplicationDocument,
  Assessment,
  AuditAction,
  AuditEvent,
  DashboardStats,
  DocumentType,
  FeeRule,
  FileMeta,
  Inspection,
  InspectionCenter,
  InsuranceRecord,
  Vehicle,
  VehicleClassification,
  VehicleDuplicateMatch,
  VehicleInput,
  VehicleLookupField,
  TransactionType,
  TransferDetails,
  ChangeRequest,
  InspectionDefect,
  Office,
  Owner,
  OwnerDuplicateMatch,
  OwnerInput,
  Payment,
  PaymentMethod,
  Permission,
  Plate,
  PlateStatus,
  PosPaymentRequest,
  PosPaymentResult,
  PosPaymentStatus,
  PosFlowStage,
  PosSimulatorState,
  PosTerminal,
  ReceiptData,
  RegistrationApplication,
  RegistrationStatus,
  ReportFilters,
  ReportKey,
  ReportResult,
  Role,
  RoleKey,
  RolePermissionMatrix,
  SafeUser,
  CreateRegistrationInput,
  UpdateRegistrationInput,
  User,
  WizardDraft,
  TerminalConnectionResult,
  TerminalDetectionResult,
  TerminalStatus,
  ChecklistValue,
  InspectionResult,
  InspectionStatus,
  AuditEvent as VehicleAuditEvent,
} from "@/types";
import type { ChecklistItem } from "@/lib/workflow";
import type { DocumentRule } from "@/config/document-requirements";

export interface SessionInfo {
  user: SafeUser;
  activeRole: RoleKey;
  permissions: Permission[];
  office: Office | null;
}

export interface AuthService {
  login(email: string, password: string): Promise<SessionInfo>;
  logout(): Promise<void>;
  getSession(): Promise<SessionInfo | null>;
  switchRole(role: RoleKey): Promise<SessionInfo>;
  requestPasswordReset(email: string): Promise<void>;
}

export interface OwnerService {
  list(): Promise<Owner[]>;
  getById(id: string): Promise<Owner | null>;
  search(query: string): Promise<Owner[]>;
  findDuplicates(input: Partial<OwnerInput>, excludeId?: string): Promise<OwnerDuplicateMatch[]>;
  create(input: OwnerInput): Promise<Owner>;
  update(id: string, input: Partial<OwnerInput>): Promise<Owner>;
}

/** Registry row: the vehicle with its registered owner. */
export interface VehicleRecord {
  vehicle: Vehicle;
  owner: Owner | null;
  /** Open (not completed / cancelled) application, if any. */
  openApplication: RegistrationApplication | null;
}

/** Everything the vehicle record page needs — registration history is never overwritten. */
export interface VehicleHistory {
  record: VehicleRecord;
  applications: RegistrationApplication[];
  inspections: Inspection[];
  payments: Payment[];
  insurance: InsuranceRecord[];
  owners: Owner[];
  audit: VehicleAuditEvent[];
}

export interface VehicleService {
  list(): Promise<Vehicle[]>;
  /** Vehicles with owners and open applications — the Motor Vehicle Registry. */
  listRecords(): Promise<VehicleRecord[]>;
  getById(id: string): Promise<Vehicle | null>;
  getHistory(id: string): Promise<VehicleHistory | null>;
  listByOwner(ownerId: string): Promise<Vehicle[]>;
  /** Registration / plate / VIN / chassis / engine number, owner name or phone. */
  lookup(query: string, field?: VehicleLookupField): Promise<VehicleRecord[]>;
  findDuplicates(input: Pick<VehicleInput, "engineNumber" | "chassisNumber" | "vin">, excludeId?: string): Promise<VehicleDuplicateMatch[]>;
  create(input: VehicleInput): Promise<Vehicle>;
  update(id: string, input: Partial<VehicleInput>): Promise<Vehicle>;
  setStatus(id: string, status: Vehicle["registrationStatus"], reason: string): Promise<Vehicle>;
}

export interface RegistrationListFilter {
  status?: RegistrationStatus | RegistrationStatus[];
  type?: TransactionType | TransactionType[];
  officeId?: string;
  query?: string;
}

/** Everything a registration screen needs, joined in one call. */
export interface RegistrationDetail {
  application: RegistrationApplication;
  owner: Owner | null;
  vehicle: Vehicle | null;
  /** Transfer of ownership: the buyer. */
  newOwner: Owner | null;
  inspection: Inspection | null;
  inspections: Inspection[];
  insurance: InsuranceRecord | null;
  payment: Payment | null;
  payments: Payment[];
  plate: Plate | null;
  office: Office | null;
  previous: RegistrationApplication | null;
}

export interface RegistrationService {
  list(filter?: RegistrationListFilter): Promise<RegistrationApplication[]>;
  getById(id: string): Promise<RegistrationApplication | null>;
  getDetail(id: string): Promise<RegistrationDetail | null>;
  create(input: CreateRegistrationInput): Promise<RegistrationApplication>;
  update(id: string, input: UpdateRegistrationInput): Promise<RegistrationApplication>;
  changeStatus(id: string, status: RegistrationStatus, note?: string): Promise<void>;
  saveDraft(id: string, draft: WizardDraft, step: number): Promise<RegistrationApplication>;
  attachOwner(id: string, ownerId: string): Promise<RegistrationApplication>;
  attachVehicle(id: string, vehicleId: string): Promise<RegistrationApplication>;
  /** Step 3 — type, class, use and body type (before the vehicle record exists). */
  saveClassification(id: string, classification: VehicleClassification): Promise<RegistrationApplication>;
  /** Re-resolves documents / inspection / plate rules after owner or vehicle changes. */
  refreshRequirements(id: string): Promise<RegistrationApplication>;
  setTransfer(id: string, transfer: TransferDetails): Promise<RegistrationApplication>;
  setChangeRequest(id: string, change: ChangeRequest, draft?: WizardDraft, closureReason?: string): Promise<RegistrationApplication>;
  uploadDocument(id: string, type: DocumentType, file: FileMeta): Promise<ApplicationDocument>;
  verifyDocument(id: string, documentId: string): Promise<ApplicationDocument>;
  rejectDocument(id: string, documentId: string, reason: string): Promise<ApplicationDocument>;
  submit(id: string): Promise<RegistrationApplication>;
  cancel(id: string, reason: string): Promise<void>;
  approvalChecklist(id: string): Promise<ChecklistItem[]>;
  approve(id: string): Promise<RegistrationApplication>;
  returnForCorrection(id: string, reason: string): Promise<RegistrationApplication>;
  reject(id: string, reason: string): Promise<RegistrationApplication>;
  createRenewal(vehicleId: string): Promise<RegistrationApplication>;
  /** Transfer, replacement, reclassification, deregistration … for a vehicle on the registry. */
  createForVehicle(type: TransactionType, vehicleId: string): Promise<RegistrationApplication>;
  recordPrint(id: string, what: "certificate" | "label" | "receipt"): Promise<void>;
  findByToken(token: string): Promise<{ vehicle: Vehicle; owner: Owner | null; application: RegistrationApplication } | null>;
}

export interface InspectionQueueItem {
  application: RegistrationApplication;
  owner: Owner | null;
  vehicle: Vehicle | null;
  inspection: Inspection | null;
  status: InspectionStatus;
}

export interface InspectionSubmitInput {
  centerId: string;
  inspectorId: string;
  inspectionDate: string;
  location?: string;
  odometerKm?: number;
  checklist: Record<string, ChecklistValue | undefined>;
  defects?: InspectionDefect[];
  attachments?: FileMeta[];
  result: InspectionResult;
  failureReason?: string;
  conditions?: string;
  notes?: string;
}

export interface InspectionService {
  list(): Promise<Inspection[]>;
  getById(id: string): Promise<Inspection | null>;
  listForApplication(applicationId: string): Promise<Inspection[]>;
  queue(): Promise<InspectionQueueItem[]>;
  schedule(applicationId: string, input: { centerId: string; inspectionDate: string }): Promise<Inspection>;
  start(applicationId: string): Promise<Inspection>;
  saveProgress(inspectionId: string, changes: Partial<InspectionSubmitInput>): Promise<Inspection>;
  submit(inspectionId: string, input: InspectionSubmitInput): Promise<Inspection>;
  requestReinspection(applicationId: string): Promise<void>;
  listCenters(): Promise<InspectionCenter[]>;
  saveCenter(center: Partial<InspectionCenter> & Pick<InspectionCenter, "name" | "code" | "province" | "district" | "address" | "status">): Promise<InspectionCenter>;
}

export interface InsuranceInput {
  provider: string;
  policyNumber: string;
  policyHolder: string;
  coverageStart: string;
  coverageExpiry: string;
  premium: number;
  vinOrChassis: string;
  certificate?: FileMeta;
}

export interface InsuranceService {
  list(): Promise<InsuranceRecord[]>;
  getById(id: string): Promise<InsuranceRecord | null>;
  getForApplication(applicationId: string): Promise<InsuranceRecord | null>;
  capture(applicationId: string, input: InsuranceInput): Promise<InsuranceRecord>;
  verify(id: string): Promise<InsuranceRecord>;
  markInvalid(id: string, remarks: string): Promise<InsuranceRecord>;
  markExpired(id: string, remarks: string): Promise<InsuranceRecord>;
  reject(id: string, remarks: string): Promise<InsuranceRecord>;
}

export interface AssessmentOptions {
  optionalCodes?: string[];
  periodMonths?: number;
  outstandingBalance?: number;
}

export interface AssessmentService {
  listFeeRules(): Promise<FeeRule[]>;
  updateFeeRule(id: string, changes: Partial<Pick<FeeRule, "name" | "amount" | "bands" | "active" | "effectiveDate" | "notes">>): Promise<FeeRule>;
  preview(applicationId: string, options?: AssessmentOptions): Promise<Assessment>;
  generate(applicationId: string, options?: AssessmentOptions): Promise<RegistrationApplication>;
  checklist(applicationId: string): Promise<ChecklistItem[]>;
}

export interface PaymentListFilter {
  status?: Payment["status"];
  method?: PaymentMethod;
  applicationId?: string;
}

export interface PaymentQueueItem {
  application: RegistrationApplication;
  owner: Owner | null;
  vehicle: Vehicle | null;
  lastAttempt: Payment | null;
}

export interface PaymentService {
  list(filter?: PaymentListFilter): Promise<Payment[]>;
  getById(id: string): Promise<Payment | null>;
  listForApplication(applicationId: string): Promise<Payment[]>;
  queue(): Promise<PaymentQueueItem[]>;
  /** Returns the successful payment if this application is already paid. */
  findSuccessful(applicationId: string): Promise<Payment | null>;
  payCash(applicationId: string, amountTendered: number): Promise<Payment>;
  payOnline(applicationId: string, input: { bankName: string }): Promise<Payment>;
  /** Card (manual / virtual) or QR wallet payment confirmed by reference. */
  payElectronic(applicationId: string, input: { method: "card" | "qr"; reference: string; provider?: string }): Promise<Payment>;
  payBankTransfer(applicationId: string, input: { bankName: string; bankReference: string; transferDate: string }): Promise<Payment>;
  createPosAttempt(applicationId: string): Promise<Payment>;
  completePosAttempt(paymentId: string, result: PosPaymentResult): Promise<Payment>;
  checkPosStatus(paymentId: string): Promise<Payment>;
  cancelPosAttempt(paymentId: string): Promise<Payment>;
  getReceiptData(paymentId: string): Promise<ReceiptData | null>;
  findByToken(token: string): Promise<Payment | null>;
}

/** Hardware boundary — Phase 1 ships MockPosTerminalAdapter only. */
export interface PosTerminalAdapter {
  detect(): Promise<TerminalDetectionResult>;
  connect(): Promise<TerminalConnectionResult>;
  disconnect(): Promise<void>;
  getStatus(): Promise<TerminalStatus>;
  initiatePayment(request: PosPaymentRequest, onStage?: (stage: PosFlowStage) => void): Promise<PosPaymentResult>;
  checkPayment(reference: string): Promise<{ status: PosPaymentStatus; approvalCode?: string; cardMasked?: string }>;
  cancelPayment(reference: string): Promise<void>;
  printReceipt?(receipt: ReceiptData): Promise<void>;
}

export interface PosService extends PosTerminalAdapter {
  getSimulator(): Promise<PosSimulatorState>;
  setSimulator(changes: Partial<PosSimulatorState>): Promise<PosSimulatorState>;
  testTerminal(): Promise<{ ok: boolean; message: string }>;
  listTerminals(): Promise<PosTerminal[]>;
  saveTerminal(terminal: Partial<PosTerminal> & Pick<PosTerminal, "name" | "terminalId" | "merchantId" | "model" | "serialNumber" | "officeId">): Promise<PosTerminal>;
  setTerminalStatus(id: string, status: PosTerminal["status"]): Promise<PosTerminal>;
  testConnection(id: string): Promise<{ ok: boolean; message: string }>;
}

export interface PlateAssignmentItem {
  application: RegistrationApplication;
  owner: Owner | null;
  vehicle: Vehicle | null;
}

export interface PlateService {
  list(): Promise<Plate[]>;
  listAvailable(officeId?: string, category?: Plate["category"]): Promise<Plate[]>;
  awaitingAssignment(): Promise<PlateAssignmentItem[]>;
  assign(plateId: string, applicationId: string): Promise<Plate>;
  changeStatus(plateId: string, status: PlateStatus, note: string): Promise<Plate>;
  receiveBatch(input: { from: number; to: number; officeId: string; receivedDate: string; category: Plate["category"] }): Promise<Plate[]>;
}

export interface ReportService {
  dashboard(): Promise<DashboardStats>;
  run(key: ReportKey, filters: ReportFilters): Promise<ReportResult>;
}

export interface AuditListFilter {
  action?: AuditAction;
  userId?: string;
  entity?: string;
  recordId?: string;
  query?: string;
}

export interface AuditService {
  list(filter?: AuditListFilter): Promise<AuditEvent[]>;
}

export interface NotificationService {
  list(): Promise<AppNotification[]>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export interface UserInput {
  firstName: string;
  lastName: string;
  email: string;
  employeeNumber: string;
  role: RoleKey;
  officeId: string;
  phone: string;
  status: User["status"];
}

export interface UserService {
  list(): Promise<SafeUser[]>;
  getById(id: string): Promise<SafeUser | null>;
  create(input: UserInput): Promise<SafeUser>;
  update(id: string, input: Partial<UserInput>): Promise<SafeUser>;
  setStatus(id: string, status: User["status"]): Promise<SafeUser>;
  listRoles(): Promise<Role[]>;
  getPermissions(): Promise<RolePermissionMatrix>;
  updatePermissions(matrix: RolePermissionMatrix): Promise<RolePermissionMatrix>;
}

export interface SettingsService {
  get(): Promise<AppSettings>;
  update(settings: AppSettings): Promise<AppSettings>;
  listOffices(): Promise<Office[]>;
  listDocumentRules(): Promise<DocumentRule[]>;
  saveDocumentRule(rule: DocumentRule): Promise<DocumentRule>;
  saveOffice(office: Partial<Office> & Pick<Office, "name" | "code" | "province" | "district" | "address" | "phone" | "email" | "status">): Promise<Office>;
}

export interface SearchResultGroup {
  group: string;
  items: { id: string; title: string; subtitle: string; href: string; badge?: string }[];
}

export interface SearchService {
  search(query: string): Promise<SearchResultGroup[]>;
}
