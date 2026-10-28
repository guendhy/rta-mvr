"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FlaskConical, X } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { useSimulation } from "@/hooks/use-network-simulation";
import { isDevelopment } from "@/lib/config";
import { posService } from "@/services/pos.service";
import { settingsService } from "@/services/settings.service";
import { demoService, SCENARIOS, type ScenarioKey } from "@/services/demo.service";
import { ConfirmDialog } from "@/components/ui/modal";
import type { SimulatedErrorKey, SimulatedPosResult, TerminalStatus } from "@/types";
import { RoleSwitcher } from "./role-switcher";

const TERMINAL_OPTIONS: { value: TerminalStatus | "printer_error"; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "disconnected", label: "Disconnected" },
  { value: "offline", label: "Offline" },
  { value: "error", label: "Device Error" },
  { value: "printer_error", label: "Printer Error" },
];

const RESULT_OPTIONS: { value: SimulatedPosResult; label: string }[] = [
  { value: "approved", label: "Approve" },
  { value: "declined", label: "Decline" },
  { value: "timeout", label: "Timeout" },
  { value: "disconnected", label: "Disconnect" },
  { value: "unknown", label: "Unknown" },
];

const ERROR_OPTIONS: { value: SimulatedErrorKey; label: string }[] = [
  { value: "save_failed", label: "Save Failed" },
  { value: "payment_timeout", label: "Payment Timeout" },
  { value: "inspection_failed", label: "Inspection Submission Failed" },
  { value: "plate_conflict", label: "Plate Assignment Conflict" },
  { value: "network_error", label: "Network Error" },
  { value: "printer_error", label: "Printer Error" },
];

function Chips<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={`min-h-[36px] rounded-md border px-2.5 text-[12.5px] font-semibold ${value === o.value ? "border-[#1515e8] bg-[#1515e8] text-white" : "border-[#c9ced8] bg-white text-[#3a3f4a] hover:bg-[#f4f5f8]"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function DemoTools() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "reset" | "clear">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const sim = useSimulation();
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("rta:open-demo-tools", onOpen);
    return () => window.removeEventListener("rta:open-demo-tools", onOpen);
  }, []);
  const { data: settings } = useServiceQuery(() => settingsService.get(), []);
  const { data: pos } = useServiceQuery(() => posService.getSimulator(), []);

  if (settings && !settings.demo.enableDemoTools) return null;

  const terminalValue: TerminalStatus = pos?.printer === "error" && pos.terminalStatus === "connected" ? "printer_error" : pos?.terminalStatus ?? "connected";

  const load = async (key: ScenarioKey, fresh: boolean) => {
    setBusy(key);
    try {
      const id = fresh ? await demoService.loadScenario(key) : demoService.findSeeded(key);
      if (!id) {
        toast.error("Seeded scenario record not found — restore seed data.");
        return;
      }
      toast.success(fresh ? "Scenario created" : "Opening scenario record");
      setOpen(false);
      router.push(`/registrations/${id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed right-4 bottom-5 z-50 hidden md:inline-flex min-h-[48px] items-center gap-2 rounded-full bg-[#ffd21a] px-4 text-[13px] font-extrabold text-[#0b0b0f] shadow-[0_8px_24px_rgba(11,11,15,.25)] hover:bg-[#ffdc4d] md:bottom-5"
        aria-haspopup="dialog"
      >
        <FlaskConical size={18} aria-hidden="true" />Demo Tools
      </button>
      {open && (
        <div className="no-print fixed inset-0 z-[75] bg-[rgba(11,11,15,.35)]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label="Demo Tools" className="absolute top-0 right-0 bottom-0 flex w-full max-w-[420px] flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e1e4ea] bg-[#0b0b0f] px-4 py-3 text-white">
              <div>
                <p className="m-0 text-[15px] font-extrabold">Demo Tools</p>
                <p className="m-0 text-[12px] text-[#c4c7d0]">QA simulation only — not part of production</p>
              </div>
              <button type="button" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-[#1c1d24]" onClick={() => setOpen(false)} aria-label="Close Demo Tools"><X size={20} /></button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <section className="space-y-2">
                <p className="eb">Current role</p>
                <RoleSwitcher />
              </section>

              <section className="space-y-2">
                <p className="eb">POS terminal</p>
                <Chips label="POS terminal state" value={terminalValue} options={TERMINAL_OPTIONS as { value: TerminalStatus; label: string }[]} onChange={async (v) => {
                  if (v === "printer_error") await posService.setSimulator({ terminalStatus: "connected", printer: "error" });
                  else await posService.setSimulator({ terminalStatus: v, printer: "ready" });
                  toast.message(`POS terminal: ${TERMINAL_OPTIONS.find((o) => o.value === v)?.label}`);
                }} />
              </section>

              <section className="space-y-2">
                <p className="eb">Next POS payment result</p>
                <Chips label="Next POS payment result" value={pos?.nextResult ?? "approved"} options={RESULT_OPTIONS} onChange={async (v) => {
                  await posService.setSimulator({ nextResult: v });
                  toast.message(`Next POS payment: ${RESULT_OPTIONS.find((o) => o.value === v)?.label}`);
                }} />
              </section>

              {(settings?.demo.enableNetworkSimulator ?? true) && (
                <section className="space-y-2">
                  <p className="eb">Network</p>
                  <Chips label="Network" value={sim.network} options={[{ value: "online", label: "Online" }, { value: "weak", label: "Weak" }, { value: "offline", label: "Offline" }]} onChange={(v) => demoService.setNetwork(v)} />
                </section>
              )}

              <section className="space-y-2">
                <p className="eb">POS device mode</p>
                <Chips label="POS device mode" value={sim.posMode} options={[{ value: "auto", label: "Auto-detect" }, { value: "on", label: "Force POS mode" }, { value: "off", label: "Off" }]} onChange={(v) => demoService.setPosMode(v)} />
              </section>

              <section className="space-y-2">
                <p className="eb">Simulated errors (fire once)</p>
                <div className="flex flex-col gap-1">
                  {ERROR_OPTIONS.map((o) => {
                    const armed = sim.armedErrors.includes(o.value);
                    return (
                      <label key={o.value} className="flex min-h-[40px] cursor-pointer items-center justify-between gap-3 rounded-md px-2 hover:bg-[#f4f5f8]">
                        <span className="text-[13.5px] font-medium">{o.label}</span>
                        <span className="flex items-center gap-2">
                          {armed && <span className="badge s-payq">Armed</span>}
                          <input type="checkbox" className="chk" checked={armed} onChange={(e) => (e.target.checked ? demoService.armError(o.value) : demoService.disarmError(o.value))} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <p className="eb">Scenarios</p>
                <p className="help m-0">“Open” jumps to the seeded UAT record. “New” creates a fresh application in that state.</p>
                <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] rounded-lg border border-[#e1e4ea] p-0">
                  {SCENARIOS.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-[13.5px] font-semibold">{s.label}</span>
                        <span className="mono mut block text-[11.5px]">{s.seeded}</span>
                      </span>
                      <span className="flex flex-none gap-1.5">
                        <button type="button" className="btn btn-s btn-sm" onClick={() => load(s.key, false)} disabled={!!busy}>Open</button>
                        <button type="button" className="btn btn-p btn-sm" onClick={() => load(s.key, true)} disabled={!!busy}>{busy === s.key ? <span className="spin" aria-hidden="true" /> : null}New</button>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <p className="eb">Utilities</p>
                <div className="flex flex-col gap-2">
                  <button type="button" className="btn btn-s" disabled={!!busy} onClick={() => load("ready_for_inspection", true)}>Generate Test Application</button>
                  <button type="button" className="btn btn-do" onClick={() => setConfirm("reset")}>Reset Demo Data</button>
                  <button type="button" className="btn btn-do" onClick={() => setConfirm("clear")}>Clear Local Storage</button>
                  {isDevelopment && <Link href="/dev/demo" className="btn btn-g" onClick={() => setOpen(false)}>Open /dev/demo debug page</Link>}
                </div>
              </section>
            </div>
          </aside>
        </div>
      )}
      <ConfirmDialog
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title="Reset demo data?"
        message="All records return to the original seed data. Your session stays signed in. This cannot be undone."
        confirmLabel="Reset Demo Data"
        tone="danger"
        onConfirm={() => {
          demoService.restoreSeed();
          setConfirm(null);
          toast.success("Demo data restored");
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "clear"}
        onClose={() => setConfirm(null)}
        title="Clear all local storage?"
        message="Every record, setting and your session are removed. Fresh seed data loads on the next sign-in."
        confirmLabel="Clear Local Storage"
        tone="danger"
        onConfirm={() => {
          demoService.clearAll();
          window.location.href = "/login";
        }}
      />
    </>
  );
}
