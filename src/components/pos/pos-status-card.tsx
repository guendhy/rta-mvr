"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Link2Off, RefreshCw, Smartphone, Stethoscope } from "lucide-react";
import { posService } from "@/services/pos.service";
import { useServiceQuery } from "@/hooks/use-service";
import { usePosEnvironment } from "@/hooks/use-pos-environment";
import { TERMINAL_STATUS } from "@/lib/constants";
import { formatRelative } from "@/lib/formatting";
import { StatusBadge } from "@/components/ui/status-badge";
import type { TerminalDetectionResult, TerminalStatus } from "@/types";

/** POS terminal detection / connection card (spec §27). */
export function PosStatusCard({ onManual, compact }: { onManual?: () => void; compact?: boolean }) {
  const { data: sim } = useServiceQuery(() => posService.getSimulator(), []);
  const { data: terminals } = useServiceQuery(() => posService.listTerminals(), []);
  const env = usePosEnvironment();
  const [busy, setBusy] = useState<string | null>(null);
  const [detected, setDetected] = useState<TerminalDetectionResult | null>(null);
  const terminal = terminals?.find((t) => t.terminalId === sim?.activeTerminalId);
  const status: TerminalStatus = busy === "connect" ? "connecting" : sim ? (sim.printer === "error" && sim.terminalStatus === "connected" ? "printer_error" : sim.terminalStatus) : "connecting";
  const connected = status === "connected" || status === "printer_error";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const tone = connected ? "#137a3b" : status === "connecting" ? "#1515e8" : "#a3111a";
  return (
    <section className="card sec gap-4" aria-label="POS terminal status">
      <div className="sechd">
        <p className="eb">POS terminal status</p>
        <StatusBadge kind="terminal" status={status} />
      </div>
      <div className="flex items-center gap-3.5">
        <div className="grid h-12 w-12 flex-none place-items-center rounded-[10px]" style={{ background: connected ? "#e9f7ef" : "#f4f5f8" }}>
          <Smartphone size={24} style={{ color: tone }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="h3">{terminal?.name ?? "RTA Smart POS"} · {sim?.activeTerminalId ?? "—"}</p>
          <p className="mut m-0 mt-0.5 text-[13px]">{TERMINAL_STATUS[status].label} · Printer {sim?.printer === "error" || status === "printer_error" ? "error" : "ready"}{terminal?.lastConnectedAt ? ` · last seen ${formatRelative(terminal.lastConnectedAt)}` : ""}</p>
        </div>
      </div>
      {!compact && (
        <dl className="dl">
          <dt>Device Name</dt><dd>{terminal?.name ?? "RTA Smart POS"}</dd>
          <dt>Manufacturer</dt><dd>{terminal?.manufacturer ?? "Wiseasy"}</dd>
          <dt>Model</dt><dd>{terminal?.model ?? "P5"}</dd>
          <dt>Serial Number</dt><dd className="mono">{terminal?.serialNumber ?? "WSP5-00094821"}</dd>
          <dt>Terminal ID</dt><dd className="mono">{terminal?.terminalId ?? "RTA-POM-001"}</dd>
          <dt>Merchant ID</dt><dd className="mono">{terminal?.merchantId ?? "RTA-PNG-0001"}</dd>
          <dt>Connection</dt><dd>{terminal?.connection === "local_bridge" ? "Local bridge" : terminal?.connection === "bluetooth" ? "Web Bluetooth" : terminal?.connection === "webusb" ? "WebUSB" : "Android Bridge"}{env.isPosDevice ? " (this device)" : " (simulated)"}</dd>
          <dt>Printer</dt><dd>{sim?.printer === "error" || status === "printer_error" ? "Error — paper out" : "Ready"}</dd>
        </dl>
      )}
      {detected && <p className={`m-0 text-[13px] font-medium ${detected.found ? "text-[#0d6630]" : "text-[#a3111a]"}`} role="status">{detected.message}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-s btn-sm" disabled={!!busy} onClick={() => run("detect", async () => setDetected(await posService.detect()))}>
          {busy === "detect" ? <span className="spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}Detect Again
        </button>
        {connected ? (
          <button type="button" className="btn btn-s btn-sm" disabled={!!busy} onClick={() => run("disconnect", async () => { await posService.disconnect(); toast.message("Terminal disconnected"); })}><Link2Off size={14} aria-hidden="true" />Disconnect</button>
        ) : (
          <button type="button" className="btn btn-p btn-sm" disabled={!!busy} onClick={() => run("connect", async () => { const r = await posService.connect(); if (r.connected) toast.success(r.message); else toast.error(r.message); })}>
            {busy === "connect" ? <span className="spin" aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}Connect
          </button>
        )}
        <button type="button" className="btn btn-s btn-sm" disabled={!!busy || !connected} onClick={() => run("test", async () => { const r = await posService.testTerminal(); if (r.ok) toast.success(r.message); else toast.error(r.message); })}>
          {busy === "test" ? <span className="spin" aria-hidden="true" /> : <Stethoscope size={14} aria-hidden="true" />}Test Terminal
        </button>
        {onManual && <button type="button" className="btn btn-g btn-sm" onClick={onManual}>Use Manual Payment</button>}
      </div>
    </section>
  );
}
