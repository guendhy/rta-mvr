import type { AppSettings, PosSimulatorState, SimulationState } from "@/types";
import { OFFICE_IDS } from "./offices";

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    systemName: "PNG RTA Motorcycle Registration & Payment System",
    defaultOfficeId: OFFICE_IDS.POM,
    currency: "PGK",
    registrationPrefix: "MC",
  },
  registration: {
    validityMonths: 12,
    requirePlateBeforeCompletion: true,
    requireInsuranceVerification: true,
    requireInspection: true,
  },
  payments: { allowCash: true, allowPos: true, allowOnline: true, allowBankTransfer: true },
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
