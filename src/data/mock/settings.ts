import type { AppSettings, PosSimulatorState, SimulationState } from "@/types";
import { OFFICE_IDS } from "./offices";

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    systemName: "PNG RTA Motor Vehicle Registration & Payment System",
    defaultOfficeId: OFFICE_IDS.POM,
    currency: "PGK",
    registrationPrefix: "REG",
  },
  registration: {
    validityMonths: 12,
    requirePlateBeforeCompletion: true,
    requireInsuranceVerification: true,
    requireInspection: true,
    expiringSoonDays: 30,
  },
  payments: { allowCash: true, allowPos: true, allowCard: true, allowQr: true, allowOnline: true, allowBankTransfer: true },
  demo: { enableDemoTools: true, enableNetworkSimulator: true, enableMockPos: true },
};

export const DEFAULT_SIMULATION: SimulationState = {
  network: "online",
  armedErrors: [],
  posMode: "auto",
};

export const DEFAULT_POS_STATE: PosSimulatorState = {
  terminalStatus: "connected",
  printer: "ready",
  nextResult: "approved",
  activeTerminalId: "RTA-POM-001",
  pendingOutcomes: {},
};
