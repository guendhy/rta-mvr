"use client";

import { toast } from "sonner";
import { Link2, Link2Off, RefreshCw, Smartphone, Stethoscope } from "lucide-react";
import type { PosTerminalController } from "@/hooks/use-pos-terminal";
import { formatRelative, formatTime } from "@/lib/formatting";
import { Alert } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { POS_STATE_TONE, WithPosTerminal } from "./with-pos-terminal";

interface Props {
  onManual?: () => void;
  compact?: boolean;
  /** Shared controller from the parent screen; the card creates its own when omitted. */
  terminal?: PosTerminalController;
  autoDetect?: boolean;
}

/** POS terminal detection / connection card — vendor-neutral, driven by `usePosTerminal()`. */
export function PosStatusCard(props: Props) {
  if (props.terminal) return <StatusCard {...props} terminal={props.terminal} />;
  return <WithPosTerminal autoDetect={props.autoDetect}>{(t) => <StatusCard {...props} terminal={t} />}</WithPosTerminal>;
}

function StatusCard({ onManual, compact, terminal: t }: Props & { terminal: PosTerminalController }) {
  const unavailable = t.state === "disconnected" || t.state === "unsupported" || t.state === "failed";
  const good = t.state === "ready" || t.state === "connected" || t.state === "processing";
  const device = t.terminal;

  const toastResult = (r: { ok: boolean; message: string }) => (r.ok ? toast.success(r.message) : toast.error(r.message));

  return (
    <section className="card sec gap-4" aria-label="POS terminal status">
      <div className="sechd">
        <p className="eb">POS terminal</p>
        <Badge tone={POS_STATE_TONE[t.state]}>{t.label}</Badge>
      </div>
      <div className="flex items-center gap-3.5">
        <div className={`grid h-12 w-12 flex-none place-items-center rounded-[10px] ${good ? "bg-[#e9f7ef]" : "bg-[#f4f5f8]"}`}>
          {t.state === "detecting" ? <span className="spin text-[#1515e8]" style={{ width: 22, height: 22 }} aria-hidden="true" /> : <Smartphone size={24} className={good ? "text-[#137a3b]" : unavailable ? "text-[#a3111a]" : "text-[#474d59]"} aria-hidden="true" />}
        </div>
        <div className="min-w-0">
          <p className="h3">{device?.name ?? "Payment terminal"} · <span className="mono">{t.terminalId ?? "—"}</span></p>
          <p className="mut m-0 mt-0.5 text-[13px]">
            {t.label} · Printer {t.printer === "error" ? "error" : "ready"}
            {device?.lastConnectedAt ? ` · last seen ${formatRelative(device.lastConnectedAt)}` : ""}
          </p>
        </div>
      </div>

      {unavailable && (
        <Alert tone={t.state === "unsupported" ? "info" : "warn"} title={t.state === "failed" ? "Terminal reported an error" : t.state === "unsupported" ? "Card terminal not available here" : "No POS terminal detected"}>
          {t.detection?.message ? `${t.detection.message} ` : ""}Card payments on the terminal are unavailable. Cash and the other enabled payment methods still work.
        </Alert>
      )}

      {!compact && (
        <dl className="dl">
          <dt>Device name</dt><dd>{device?.name ?? "—"}</dd>
          <dt>Manufacturer / model</dt><dd>{device ? `${device.manufacturer} ${device.model}` : "—"}</dd>
          <dt>Serial number</dt><dd className="mono">{device?.serialNumber ?? "—"}</dd>
          <dt>Terminal ID</dt><dd className="mono">{t.terminalId ?? "—"}</dd>
          <dt>Merchant ID</dt><dd className="mono">{device?.merchantId ?? "—"}</dd>
          <dt>Connection</dt><dd>{t.connectionLabel}</dd>
          <dt>Printer</dt><dd>{t.printer === "error" ? "Error — paper out" : "Ready"}</dd>
          <dt>Last check</dt><dd>{t.lastCheckedAt ? formatTime(t.lastCheckedAt) : "Not checked this session"}</dd>
        </dl>
      )}

      <p className="sr" role="status" aria-live="polite">{t.busy === "detect" ? "Checking terminal" : t.busy === "connect" ? "Connecting terminal" : t.detection?.message ?? t.label}</p>
      {t.detection && !compact && <p className={`m-0 text-[13px] font-medium ${t.detection.found ? "text-[#0d6630]" : "text-[#a3111a]"}`} aria-hidden="true">{t.detection.message}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-s btn-sm" disabled={!!t.busy || t.state === "processing"} onClick={() => t.detect().catch(() => toast.error("Detection failed."))}>
          {t.busy === "detect" ? <span className="spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}{t.busy === "detect" ? "Detecting…" : "Detect Again"}
        </button>
        {t.isConnected ? (
          <button type="button" className="btn btn-s btn-sm" disabled={!!t.busy || t.state === "processing"} onClick={async () => { await t.disconnect(); toast.message("Terminal disconnected"); }}><Link2Off size={14} aria-hidden="true" />Disconnect</button>
        ) : (
          <button type="button" className="btn btn-p btn-sm" disabled={!!t.busy || !t.enabled} onClick={async () => toastResult(await t.connect())}>
            {t.busy === "connect" ? <span className="spin" aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}Connect Device
          </button>
        )}
        <button type="button" className="btn btn-s btn-sm" disabled={!!t.busy || !t.isConnected || t.state === "processing"} onClick={async () => toastResult(await t.test())}>
          {t.busy === "test" ? <span className="spin" aria-hidden="true" /> : <Stethoscope size={14} aria-hidden="true" />}Test Terminal
        </button>
        {onManual && <button type="button" className="btn btn-g btn-sm" onClick={onManual}>Use Manual Payment</button>}
      </div>
    </section>
  );
}
