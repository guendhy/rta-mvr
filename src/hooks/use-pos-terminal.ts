"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { posService } from "@/services/pos.service";
import { settingsService } from "@/services/settings.service";
import { useServiceQuery } from "./use-service";
import { useNetworkSimulation } from "./use-network-simulation";
import { usePosEnvironment, type PosEnvironment } from "./use-pos-environment";
import type { PosFlowStage, PosPaymentRequest, PosPaymentResult, PosTerminal, TerminalDetectionResult, TerminalStatus } from "@/types";

/**
 * UI-level terminal state, independent of the hardware vendor:
 * - detecting     — detection / connection in progress ("Checking Terminal")
 * - connected     — paired, but a payment cannot be sent yet (e.g. no network)
 * - ready         — connected, online — "Ready for Payment"
 * - processing    — a charge is running on the terminal
 * - disconnected  — not connected, or no terminal answered ("Terminal Not Detected")
 * - unsupported   — this browser / device cannot reach POS hardware, or POS is disabled
 * - failed        — the terminal reported a device error
 */
export type PosTerminalState = "detecting" | "connected" | "disconnected" | "unsupported" | "ready" | "processing" | "failed";

export const POS_TERMINAL_STATE_LABEL: Record<PosTerminalState, string> = {
  detecting: "Checking Terminal",
  connected: "Terminal Connected",
  ready: "Ready for Payment",
  processing: "Processing",
  disconnected: "Terminal Not Detected",
  unsupported: "Terminal Not Supported",
  failed: "Terminal Error",
};

export type PosBusyAction = "detect" | "connect" | "disconnect" | "test";

export interface PosTerminalController {
  state: PosTerminalState;
  /** Human label for `state` (never shown by colour alone). */
  label: string;
  /** Raw adapter status, for <StatusBadge kind="terminal">. */
  status: TerminalStatus;
  /** A payment can be sent to the terminal right now (or after an automatic connect). */
  canCharge: boolean;
  isConnected: boolean;
  /** Mock POS / POS channel switched on in Settings. */
  enabled: boolean;
  terminal: PosTerminal | undefined;
  terminalId: string | undefined;
  printer: "ready" | "error";
  connectionLabel: string;
  detection: TerminalDetectionResult | null;
  lastCheckedAt: Date | null;
  busy: PosBusyAction | null;
  /** Demo Tools: what the simulated terminal returns next. */
  nextResult: string | undefined;
  env: PosEnvironment;
  detect: () => Promise<TerminalDetectionResult>;
  connect: () => Promise<{ ok: boolean; message: string }>;
  disconnect: () => Promise<void>;
  test: () => Promise<{ ok: boolean; message: string }>;
  /** Detects and connects when needed. Resolves ok=false with a reason instead of throwing. */
  ensureConnected: () => Promise<{ ok: boolean; message: string }>;
  /** Sends an amount to the terminal; `state` is "processing" until it resolves. */
  charge: (request: PosPaymentRequest, onStage?: (stage: PosFlowStage) => void) => Promise<PosPaymentResult>;
}

const CONNECTION_LABEL: Record<PosTerminal["connection"], string> = {
  android_bridge: "Android bridge",
  webusb: "WebUSB",
  bluetooth: "Web Bluetooth",
  local_bridge: "Local POS bridge",
};

/**
 * One abstraction over the `PosTerminalAdapter` boundary (`posService`). Components read
 * `state` / `label` and call `detect` / `connect` / `charge`; they never talk to a vendor SDK.
 * The mock adapter's simulator (Demo Tools) drives the underlying status.
 */
export function usePosTerminal(opts: { autoDetect?: boolean } = {}): PosTerminalController {
  const env = usePosEnvironment();
  const { isOnline } = useNetworkSimulation();
  const { data: sim } = useServiceQuery(() => posService.getSimulator(), []);
  const { data: terminals } = useServiceQuery(() => posService.listTerminals(), []);
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const [busy, setBusy] = useState<PosBusyAction | null>(null);
  const [processing, setProcessing] = useState(false);
  const [detection, setDetection] = useState<TerminalDetectionResult | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const enabled = settings ? settings.payments.allowPos !== false && settings.demo.enableMockPos !== false : true;
  const terminal = terminals?.find((t) => t.terminalId === sim?.activeTerminalId);
  const rawStatus: TerminalStatus = sim ? (sim.printer === "error" && sim.terminalStatus === "connected" ? "printer_error" : sim.terminalStatus) : "connecting";
  const isConnected = rawStatus === "connected" || rawStatus === "printer_error";
  const status: TerminalStatus = busy === "detect" || busy === "connect" ? "connecting" : rawStatus;

  const state: PosTerminalState = useMemo(() => {
    if (!sim || busy === "detect" || busy === "connect") return "detecting";
    if (processing) return "processing";
    if (!enabled || rawStatus === "unsupported" || detection?.status === "unsupported") return "unsupported";
    if (rawStatus === "error") return "failed";
    if (isConnected) return isOnline ? "ready" : "connected";
    if (rawStatus === "connecting") return "detecting";
    return "disconnected";
  }, [sim, busy, processing, enabled, rawStatus, detection, isConnected, isOnline]);

  const guard = useCallback(async <T,>(key: PosBusyAction, fn: () => Promise<T>): Promise<T> => {
    setBusy(key);
    try {
      return await fn();
    } finally {
      if (mounted.current) setBusy(null);
    }
  }, []);

  const detect = useCallback(() => guard("detect", async () => {
    const r = await posService.detect();
    if (mounted.current) {
      setDetection(r);
      setLastCheckedAt(new Date());
    }
    return r;
  }), [guard]);

  const connect = useCallback(() => guard("connect", async () => {
    const r = await posService.connect();
    if (mounted.current) setLastCheckedAt(new Date());
    return { ok: r.connected, message: r.message };
  }), [guard]);

  const disconnect = useCallback(() => guard("disconnect", () => posService.disconnect()), [guard]);
  const test = useCallback(() => guard("test", () => posService.testTerminal()), [guard]);

  const ensureConnected = useCallback(async () => {
    const current = await posService.getStatus();
    if (current === "connected" || current === "printer_error") return { ok: true, message: "Terminal connected." };
    const det = await detect();
    if (!det.found) return { ok: false, message: det.message };
    if (det.status === "error") return { ok: false, message: det.message };
    return connect();
  }, [connect, detect]);

  const charge = useCallback(async (request: PosPaymentRequest, onStage?: (stage: PosFlowStage) => void) => {
    setProcessing(true);
    try {
      return await posService.initiatePayment(request, onStage);
    } finally {
      if (mounted.current) setProcessing(false);
    }
  }, []);

  // Auto-detection when a payment screen opens (no automatic connect or charge).
  const autoDetect = opts.autoDetect ?? false;
  const autoRan = useRef(false);
  useEffect(() => {
    if (!autoDetect || autoRan.current || !sim) return;
    autoRan.current = true;
    if (sim.terminalStatus === "connected" || sim.terminalStatus === "printer_error") return;
    detect().catch(() => undefined);
  }, [autoDetect, sim, detect]);

  const printer: "ready" | "error" = sim?.printer === "error" || rawStatus === "printer_error" ? "error" : "ready";

  return {
    state,
    label: state === "disconnected" && rawStatus === "disconnected" ? "Terminal Disconnected" : POS_TERMINAL_STATE_LABEL[state],
    status,
    canCharge: enabled && isOnline && !processing && rawStatus !== "unsupported" && rawStatus !== "error",
    isConnected,
    enabled,
    terminal,
    terminalId: sim?.activeTerminalId,
    printer,
    connectionLabel: `${terminal ? CONNECTION_LABEL[terminal.connection] : "Android bridge"}${env.isPosDevice ? " (this device)" : " (simulated)"}`,
    detection,
    lastCheckedAt,
    busy,
    nextResult: sim?.nextResult,
    env,
    detect,
    connect,
    disconnect,
    test,
    ensureConnected,
    charge,
  };
}
