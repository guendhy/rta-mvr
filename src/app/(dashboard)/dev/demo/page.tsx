"use client";

import { notFound } from "next/navigation";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { isDevelopment, appConfig } from "@/lib/config";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDateTime, fullName, titleCase } from "@/lib/formatting";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useSimulation } from "@/hooks/use-network-simulation";
import { posService } from "@/services/pos.service";
import { settingsService } from "@/services/settings.service";
import { demoService } from "@/services/demo.service";
import { DescriptionList, PageHeader, Section } from "@/components/ui/layout-bits";
import { Alert, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/status-badge";

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied to clipboard`);
  } catch {
    toast.error("Clipboard is not available in this browser.");
  }
}

function count(v: unknown): string {
  if (Array.isArray(v)) return `${v.length} record${v.length === 1 ? "" : "s"}`;
  if (v && typeof v === "object") return `${Object.keys(v).length} key${Object.keys(v).length === 1 ? "" : "s"}`;
  return v === null || v === undefined ? "empty" : typeof v;
}

const yesNo = (b: boolean) => <Badge tone={b ? "ok" : "draft"}>{b ? "On" : "Off"}</Badge>;
const Loading = () => <div className="flex flex-col gap-2" aria-busy="true"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-2/3" /></div>;

export default function DevDemoPage() {
  if (!isDevelopment) notFound();
  const { user, role, roleLabel, office, isRoleOverridden } = useDemoUser();
  const sim = useSimulation();
  const pos = useServiceQuery(() => posService.getSimulator(), []);
  const settings = useServiceQuery(() => settingsService.get(), []);
  const dump = useServiceQuery(async () => demoService.dump(), []);

  const counters = (dump.data?.counters ?? null) as Record<string, Record<string, number>> | null;
  const pending = Object.entries(pos.data?.pendingOutcomes ?? {});
  const s = settings.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Developer"
        title="Demo State Inspector"
        description="Live view of the mock backend stored in this browser. Only available in development builds."
        badge={<Badge tone="payq">Development only</Badge>}
        actions={<button type="button" className="btn btn-s" onClick={() => { pos.reload(); settings.reload(); dump.reload(); }}><RefreshCw size={16} aria-hidden="true" />Refresh</button>}
      />

      <div className="g3">
        <Section title="Logged-in user">
          {user ? (
            <DescriptionList items={[
              ["Name", fullName(user)],
              ["Email", user.email],
              ["Employee No.", <span key="e" className="mono">{user.employeeNumber}</span>],
              ["Home role", ROLE_LABELS[user.role]],
              ["Office", office?.name ?? "—"],
            ]} />
          ) : <p className="mut m-0">Not signed in.</p>}
        </Section>
        <Section title="Current role">
          <DescriptionList items={[
            ["Active role", roleLabel || "—"],
            ["Role key", <span key="r" className="mono">{role ?? "—"}</span>],
            ["Overridden", isRoleOverridden ? <Badge tone="pend">Yes — demo role switch</Badge> : "No"],
            ["Backend", <span key="b" className="mono">{appConfig.backendMode}</span>],
            ["Version", <span key="v" className="mono">{appConfig.version}</span>],
          ]} />
        </Section>
        <Section title="Network state">
          <DescriptionList items={[
            ["Network", <Badge key="n" tone={sim.network === "online" ? "ok" : sim.network === "weak" ? "pend" : "bad"}>{titleCase(sim.network)}</Badge>],
            ["POS mode", <span key="p" className="mono">{sim.posMode}</span>],
            ["Armed errors", sim.armedErrors.length ? <span key="a" className="flex flex-wrap justify-start gap-1">{sim.armedErrors.map((e) => <Badge key={e} tone="bad">{titleCase(e)}</Badge>)}</span> : "None"],
          ]} />
        </Section>
      </div>

      <div className="g2">
        <Section title="POS state">
          {pos.error ? <ErrorState message={pos.error} onRetry={() => pos.reload()} /> : !pos.data ? <Loading /> : (
            <DescriptionList items={[
              ["Terminal status", <StatusBadge key="t" kind="terminal" status={pos.data.terminalStatus} />],
              ["Printer", <Badge key="p" tone={pos.data.printer === "ready" ? "ok" : "bad"}>{pos.data.printer === "ready" ? "Ready" : "Error"}</Badge>],
              ["Active terminal", <span key="a" className="mono">{pos.data.activeTerminalId}</span>],
            ]} />
          )}
        </Section>
        <Section title="Payment simulation state">
          {pos.error ? <ErrorState message={pos.error} onRetry={() => pos.reload()} /> : !pos.data ? <Loading /> : (
            <div className="flex flex-col gap-3">
              <DescriptionList items={[
                ["Next POS result", <span key="n" className="mono">{pos.data.nextResult}</span>],
                ["Pending outcomes", String(pending.length)],
              ]} />
              {pending.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-[#e1e4ea]">
                  <table className="tbl">
                    <thead><tr><th>Reference</th><th>Bank status</th><th>Approval</th></tr></thead>
                    <tbody>
                      {pending.map(([ref, o]) => (
                        <tr key={ref}><td className="mono">{ref}</td><td>{titleCase(o.status)}</td><td className="mono">{o.approvalCode ?? "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Section>
      </div>

      <div className="g2">
        <Section title="Transaction counters" description="Sequence counters by scope (year, day or province).">
          {!dump.data ? <Loading /> : !counters || !Object.keys(counters).length ? <p className="mut m-0">No counters recorded yet.</p> : (
            <div className="overflow-x-auto rounded-lg border border-[#e1e4ea]">
              <table className="tbl">
                <thead><tr><th>Counter</th><th>Scope</th><th className="num">Value</th></tr></thead>
                <tbody>
                  {Object.entries(counters).flatMap(([k, scopes]) => {
                    const entries = Object.entries(scopes ?? {});
                    if (!entries.length) return [<tr key={k}><td>{titleCase(k)}</td><td className="mut">—</td><td className="num">0</td></tr>];
                    return entries.map(([scope, n]) => <tr key={`${k}-${scope}`}><td>{titleCase(k)}</td><td className="mono">{scope}</td><td className="num font-bold">{n}</td></tr>);
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section title="Application settings" description={s?.updatedAt ? `Last saved ${formatDateTime(s.updatedAt)}` : undefined}>
          {settings.error ? <ErrorState message={settings.error} onRetry={() => settings.reload()} /> : !s ? <Loading /> : (
            <DescriptionList items={[
              ["System name", s.general.systemName],
              ["Prefix / currency", <span key="p" className="mono">{s.general.registrationPrefix} · {s.general.currency}</span>],
              ["Validity", `${s.registration.validityMonths} months`],
              ["Require plate", yesNo(s.registration.requirePlateBeforeCompletion)],
              ["Require insurance", yesNo(s.registration.requireInsuranceVerification)],
              ["Require inspection", yesNo(s.registration.requireInspection)],
              ["Payments", [s.payments.allowCash && "Cash", s.payments.allowPos && "POS", s.payments.allowOnline && "Online", s.payments.allowBankTransfer && "Bank transfer"].filter(Boolean).join(", ") || "None"],
              ["Demo tools", yesNo(s.demo.enableDemoTools)],
              ["Network simulator", yesNo(s.demo.enableNetworkSimulator)],
              ["Mock POS", yesNo(s.demo.enableMockPos)],
            ]} />
          )}
        </Section>
      </div>

      <Section
        title="Mock database"
        description="Every localStorage key used by the mock backend. Expand a key to inspect its JSON."
        actions={dump.data ? <button type="button" className="btn btn-s btn-sm min-h-[44px]" onClick={() => copy(JSON.stringify(dump.data, null, 2), "Full database JSON")}><Copy size={14} aria-hidden="true" />Copy all JSON</button> : null}
      >
        {dump.error ? <ErrorState message={dump.error} onRetry={() => dump.reload()} /> : !dump.data ? <Loading /> : !Object.keys(dump.data).length ? (
          <Alert tone="info" title="Storage is empty">No mock data is stored. Sign in again to recreate the seed data.</Alert>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {Object.entries(dump.data).map(([key, value]) => {
              const json = JSON.stringify(value, null, 2);
              return (
                <li key={key}>
                  <details className="group rounded-lg border border-[#e1e4ea]">
                    <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center justify-between gap-2 px-3.5 py-2">
                      <span className="mono font-semibold">{key}</span>
                      <span className="mut text-[12.5px]">{count(value)} · {(json.length / 1024).toFixed(1)} KB</span>
                    </summary>
                    <div className="border-t border-[#e1e4ea] p-3">
                      <div className="mb-2 flex justify-end">
                        <button type="button" className="btn btn-s btn-sm min-h-[44px]" onClick={() => copy(json, `"${key}" JSON`)}><Copy size={14} aria-hidden="true" />Copy JSON</button>
                      </div>
                      <pre className="mono m-0 max-h-[360px] overflow-auto rounded-md bg-[#0b0b0f] p-3 text-[12px] leading-relaxed whitespace-pre text-[#e6e7eb]" tabIndex={0} aria-label={`${key} JSON`}>{json}</pre>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
