import type { BaseRecord, ISODate } from "./common";

export type TerminalStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "offline"
  | "error"
  | "unsupported"
  | "printer_error";

export type TerminalAdminStatus = "online" | "idle" | "offline" | "maintenance" | "disabled";

/** Demo tool selector for what the mock terminal does on the next charge. */
export type SimulatedPosResult = "approved" | "declined" | "timeout" | "disconnected" | "unknown";

export type PosFlowStage =
  | "idle"
  | "connecting"
  | "connected"
  | "sending"
  | "present_card"
  | "processing"
  | "approved"
  | "declined"
  | "connection_lost"
  | "unknown";

export interface PosTerminal extends BaseRecord {
  name: string;
  terminalId: string;
  merchantId: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  officeId: string;
  assignedCashierId?: string;
  status: TerminalAdminStatus;
  lastConnectedAt?: ISODate;
  connection: "android_bridge" | "webusb" | "bluetooth" | "local_bridge";
}

export interface TerminalDetectionResult {
  found: boolean;
  status: TerminalStatus;
  terminal?: PosTerminal;
  printer: "ready" | "error";
  message: string;
}

export interface TerminalConnectionResult {
  connected: boolean;
  status: TerminalStatus;
  message: string;
}

export interface PosPaymentRequest {
  reference: string;
  amount: number;
  currency: "PGK";
  description: string;
}

export interface PosPaymentResult {
  outcome: "approved" | "declined" | "timeout" | "disconnected" | "unknown";
  reference: string;
  approvalCode?: string;
  cardMasked?: string;
  terminalId: string;
  declineReason?: string;
  at: ISODate;
}

export type PosPaymentStatus = "approved" | "declined" | "not_found" | "pending";

export interface PosSimulatorState {
  terminalStatus: TerminalStatus;
  printer: "ready" | "error";
  nextResult: SimulatedPosResult;
  activeTerminalId: string;
  /** Hidden "bank side" outcome for references that ended in an unknown state. */
  pendingOutcomes: Record<string, { status: PosPaymentStatus; approvalCode?: string; cardMasked?: string }>;
}
