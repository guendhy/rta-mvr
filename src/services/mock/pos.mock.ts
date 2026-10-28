import { DECLINE_REASONS } from "@/lib/constants";
import { ServiceError } from "@/lib/errors";
import { generators, uuid } from "@/lib/generators";
import { mockDelay, sleep } from "@/lib/mock-delay";
import type { PosService } from "../interfaces";
import type {
  PosFlowStage,
  PosPaymentRequest,
  PosPaymentResult,
  PosSimulatorState,
  PosTerminal,
  ReceiptData,
  TerminalConnectionResult,
  TerminalDetectionResult,
  TerminalStatus,
} from "@/types";
import { audit, consumeError, findById, getPosState, mustFind, nowIso, read, requireOnline, requirePermission, setPosState, upsert } from "./core";

function activeTerminal(): PosTerminal | undefined {
  const s = getPosState();
  return read("terminals").find((t) => t.terminalId === s.activeTerminalId);
}

/**
 * Simulated Wiseasy P5 terminal. Implements the same adapter contract that a real
 * Android-bridge / WebUSB / Bluetooth / local-bridge adapter will implement.
 */
// FUTURE: Implement real POS terminal adapters (AndroidBridgePosAdapter, WebUsbPosAdapter, LocalBridgePosAdapter).
export class MockPosTerminalAdapter implements PosService {
  async getSimulator(): Promise<PosSimulatorState> {
    return getPosState();
  }

  async setSimulator(changes: Partial<PosSimulatorState>): Promise<PosSimulatorState> {
    setPosState(changes);
    return getPosState();
  }

  async detect(): Promise<TerminalDetectionResult> {
    await mockDelay(700, 1300);
    const s = getPosState();
    const terminal = activeTerminal();
    if (!read("settings").demo.enableMockPos) return { found: false, status: "unsupported", printer: "error", message: "Mock POS is disabled in Settings → Demo Settings." };
    if (s.terminalStatus === "offline") return { found: false, status: "offline", terminal, printer: "error", message: "No terminal responded. Check the terminal is powered on and paired." };
    if (s.terminalStatus === "error") return { found: true, status: "error", terminal, printer: "error", message: "Terminal reported a device error (E-204). Restart the terminal." };
    if (s.terminalStatus === "unsupported") return { found: false, status: "unsupported", printer: "error", message: "This browser cannot talk to POS hardware. Use the Android POS app or a local bridge." };
    const printer = s.printer === "error" || s.terminalStatus === "printer_error" ? "error" : "ready";
    return { found: true, status: s.terminalStatus === "printer_error" ? "printer_error" : s.terminalStatus, terminal, printer, message: printer === "error" ? "Terminal found — printer error (paper out)." : "Terminal found." };
  }

  async connect(): Promise<TerminalConnectionResult> {
    await mockDelay(600, 1100);
    const s = getPosState();
    if (s.terminalStatus === "offline" || s.terminalStatus === "error" || s.terminalStatus === "unsupported") {
      return { connected: false, status: s.terminalStatus, message: "Unable to connect to the terminal." };
    }
    const status: TerminalStatus = s.terminalStatus === "printer_error" ? "printer_error" : "connected";
    setPosState({ terminalStatus: status });
    const t = activeTerminal();
    if (t) upsert("terminals", { ...t, status: "online", lastConnectedAt: nowIso(), updatedAt: nowIso() });
    return { connected: true, status, message: "Terminal connected." };
  }

  async disconnect(): Promise<void> {
    await mockDelay(200, 400);
    setPosState({ terminalStatus: "disconnected" });
    const t = activeTerminal();
    if (t) upsert("terminals", { ...t, status: "idle", updatedAt: nowIso() });
  }

  async getStatus(): Promise<TerminalStatus> {
    return getPosState().terminalStatus;
  }

  async testTerminal(): Promise<{ ok: boolean; message: string }> {
    await mockDelay(800, 1400);
    const s = getPosState();
    if (s.terminalStatus !== "connected" && s.terminalStatus !== "printer_error") return { ok: false, message: "Terminal is not connected." };
    if (s.printer === "error" || s.terminalStatus === "printer_error") return { ok: false, message: "Card reader OK · Printer error (paper out)." };
    return { ok: true, message: "Card reader OK · Contactless OK · Printer OK · Host reachable." };
  }

  async initiatePayment(request: PosPaymentRequest, onStage?: (stage: PosFlowStage) => void): Promise<PosPaymentResult> {
    requireOnline();
    const s = getPosState();
    const terminalId = s.activeTerminalId;
    if (s.terminalStatus !== "connected" && s.terminalStatus !== "printer_error") throw new ServiceError("network", "The POS terminal is not connected.");
    const forcedTimeout = consumeError("payment_timeout");
    const outcome = forcedTimeout ? "timeout" : s.nextResult;
    const at = () => nowIso();

    onStage?.("sending");
    await sleep(900);
    if (outcome === "disconnected") {
      await sleep(600);
      setPosState({ terminalStatus: "disconnected", pendingOutcomes: { ...getPosState().pendingOutcomes, [request.reference]: { status: "not_found" } } });
      onStage?.("connection_lost");
      return { outcome: "disconnected", reference: request.reference, terminalId, at: at() };
    }
    onStage?.("present_card");
    await sleep(1800);
    onStage?.("processing");
    await sleep(1600);

    if (outcome === "approved") {
      onStage?.("approved");
      return { outcome: "approved", reference: request.reference, terminalId, approvalCode: generators.approvalCode(), cardMasked: generators.cardMasked(), at: at() };
    }
    if (outcome === "declined") {
      onStage?.("declined");
      return { outcome: "declined", reference: request.reference, terminalId, cardMasked: generators.cardMasked(), declineReason: DECLINE_REASONS[Math.floor(Math.random() * DECLINE_REASONS.length)], at: at() };
    }
    // Timeout: the bank never saw it. Unknown: the bank approved but the terminal lost the reply.
    const hidden = outcome === "unknown"
      ? { status: "approved" as const, approvalCode: generators.approvalCode(), cardMasked: generators.cardMasked() }
      : { status: "not_found" as const };
    setPosState({ pendingOutcomes: { ...getPosState().pendingOutcomes, [request.reference]: hidden } });
    onStage?.("unknown");
    return { outcome, reference: request.reference, terminalId, at: at() };
  }

  async checkPayment(reference: string) {
    requireOnline("Payment status checks");
    await mockDelay(900, 1500);
    const hidden = getPosState().pendingOutcomes[reference];
    return hidden ?? { status: "not_found" as const };
  }

  async cancelPayment(reference: string): Promise<void> {
    await mockDelay(300, 600);
    const pending = { ...getPosState().pendingOutcomes };
    delete pending[reference];
    setPosState({ pendingOutcomes: pending });
  }

  async printReceipt(receipt: ReceiptData): Promise<void> {
    await mockDelay(800, 1400);
    if (consumeError("printer_error") || getPosState().printer === "error" || getPosState().terminalStatus === "printer_error") {
      throw new ServiceError("simulated", "Printer error — the terminal printer is out of paper or jammed.");
    }
    void receipt;
  }

  async listTerminals(): Promise<PosTerminal[]> {
    await mockDelay();
    return read("terminals");
  }

  async saveTerminal(input: Partial<PosTerminal> & Pick<PosTerminal, "name" | "terminalId" | "merchantId" | "model" | "serialNumber" | "officeId">): Promise<PosTerminal> {
    requirePermission("terminals.manage", "manage POS terminals");
    await mockDelay();
    if (read("terminals").some((t) => t.terminalId.toLowerCase() === input.terminalId.toLowerCase() && t.id !== input.id)) {
      throw new ServiceError("conflict", "Another terminal already uses this Terminal ID.");
    }
    const ts = nowIso();
    const existing = input.id ? findById("terminals", input.id) : null;
    const rec: PosTerminal = {
      ...(existing ?? { id: uuid(), createdAt: ts, status: "idle", manufacturer: "Wiseasy", connection: "android_bridge" }),
      ...input,
      updatedAt: ts,
    } as PosTerminal;
    upsert("terminals", rec);
    audit("terminal_saved", "POS Terminal", `Terminal ${rec.terminalId} saved`, { id: rec.id, label: rec.terminalId });
    return rec;
  }

  async setTerminalStatus(id: string, status: PosTerminal["status"]): Promise<PosTerminal> {
    requirePermission("terminals.manage", "manage POS terminals");
    await mockDelay();
    const t = mustFind("terminals", id, "Terminal");
    const next = { ...t, status, updatedAt: nowIso() };
    upsert("terminals", next);
    audit("terminal_saved", "POS Terminal", `Terminal ${t.terminalId} set to ${status}`, { id, label: t.terminalId });
    return next;
  }

  async testConnection(id: string): Promise<{ ok: boolean; message: string }> {
    await mockDelay(800, 1500);
    const t = mustFind("terminals", id, "Terminal");
    if (t.status === "disabled") return { ok: false, message: `${t.terminalId} is disabled.` };
    if (t.status === "offline" || t.status === "maintenance") return { ok: false, message: `${t.terminalId} did not respond (status: ${t.status}).` };
    upsert("terminals", { ...t, lastConnectedAt: nowIso(), status: "online", updatedAt: nowIso() });
    return { ok: true, message: `${t.terminalId} responded in ${120 + Math.floor(Math.random() * 200)} ms.` };
  }
}
