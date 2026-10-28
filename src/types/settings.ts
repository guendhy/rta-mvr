import type { ISODate } from "./common";

export interface AppSettings {
  general: {
    systemName: string;
    defaultOfficeId: string;
    currency: "PGK";
    registrationPrefix: string;
  };
  registration: {
    validityMonths: number;
    requirePlateBeforeCompletion: boolean;
    requireInsuranceVerification: boolean;
    requireInspection: boolean;
  };
  payments: {
    allowCash: boolean;
    allowPos: boolean;
    allowOnline: boolean;
    allowBankTransfer: boolean;
  };
  demo: {
    enableDemoTools: boolean;
    enableNetworkSimulator: boolean;
    enableMockPos: boolean;
  };
  updatedAt?: ISODate;
}

export type NetworkState = "online" | "weak" | "offline";

export type SimulatedErrorKey =
  | "save_failed"
  | "payment_timeout"
  | "inspection_failed"
  | "plate_conflict"
  | "network_error"
  | "printer_error";

export interface SimulationState {
  network: NetworkState;
  /** One-shot errors armed from Demo Tools; consumed by the next matching service call. */
  armedErrors: SimulatedErrorKey[];
  posMode: "auto" | "on" | "off";
}

export type CounterKey =
  | "transaction"
  | "payment"
  | "receipt"
  | "certificate"
  | "label"
  | "registration"
  | "inspectionCertificate";

/** Sequence counters keyed by scope (year, day or province+year). */
export type Counters = Record<CounterKey, Record<string, number>>;
