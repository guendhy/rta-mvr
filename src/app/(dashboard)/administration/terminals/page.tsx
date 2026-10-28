"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Pencil, PlugZap, Plus, Power, PowerOff, UserCheck } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { TERMINAL_ADMIN_STATUS } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatDateTime, formatRelative, fullName } from "@/lib/formatting";
import { posService } from "@/services/pos.service";
import { settingsService } from "@/services/settings.service";
import { userService } from "@/services/user.service";
import type { Office, PosTerminal, SafeUser } from "@/types";
import { PageHeader } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { FilterBar, FilterSelect, FormFooter, ResultCount, SearchField } from "@/components/admin/admin-bits";

const STATUSES = Object.entries(TERMINAL_ADMIN_STATUS).map(([value, s]) => ({ value, label: s.label }));
const CONNECTIONS = [
  { value: "android_bridge", label: "Android bridge" },
  { value: "local_bridge", label: "Local bridge" },
  { value: "webusb", label: "WebUSB" },
  { value: "bluetooth", label: "Bluetooth" },
];

const schema = z.object({
  name: z.string().trim().min(3, "Enter the terminal name"),
  terminalId: z.string().trim().min(3, "Enter the Terminal ID"),
  merchantId: z.string().trim().min(3, "Enter the Merchant ID"),
  manufacturer: z.string().trim().min(2, "Enter the manufacturer"),
  model: z.string().trim().min(1, "Enter the model"),
  serialNumber: z.string().trim().min(3, "Enter the serial number"),
  officeId: z.string().min(1, "Select an office"),
  assignedCashierId: z.string(),
  connection: z.enum(["android_bridge", "webusb", "bluetooth", "local_bridge"]),
  status: z.enum(["online", "idle", "offline", "maintenance", "disabled"]),
});
type FormValues = z.infer<typeof schema>;

type Ctx = { offices: Office[]; cashiers: SafeUser[] };

function TerminalForm({ terminal, ctx, onDone }: { terminal: PosTerminal | null; ctx: Ctx; onDone: () => void }) {
  const save = useAction((v: FormValues) => posService.saveTerminal({ ...v, terminalId: v.terminalId.toUpperCase(), assignedCashierId: v.assignedCashierId || undefined, id: terminal?.id }), { success: (t) => `Terminal ${t.terminalId} saved` });
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: terminal
      ? { name: terminal.name, terminalId: terminal.terminalId, merchantId: terminal.merchantId, manufacturer: terminal.manufacturer, model: terminal.model, serialNumber: terminal.serialNumber, officeId: terminal.officeId, assignedCashierId: terminal.assignedCashierId ?? "", connection: terminal.connection, status: terminal.status }
      : { name: "", terminalId: "", merchantId: "", manufacturer: "Wiseasy", model: "P5", serialNumber: "", officeId: ctx.offices[0]?.id ?? "", assignedCashierId: "", connection: "android_bridge", status: "idle" },
  });
  return (
    <Modal open onClose={() => !save.busy && onDone()} title={terminal ? `Edit ${terminal.terminalId}` : "Add POS terminal"} size="lg" footer={<FormFooter formId="terminal-form" busy={save.busy} onCancel={onDone} submitLabel={terminal ? "Save changes" : "Add terminal"} />}>
      <form id="terminal-form" className="form" onSubmit={handleSubmit(async (v) => { if (await save.run(v)) onDone(); })} noValidate>
        <Field label="Terminal name" required htmlFor="t-name" error={errors.name?.message} className="full"><Input id="t-name" placeholder="e.g. Port Moresby Counter 3" invalid={!!errors.name} {...register("name")} /></Field>
        <Field label="Terminal ID" required htmlFor="t-tid" error={errors.terminalId?.message}><Input id="t-tid" mono className="uppercase" invalid={!!errors.terminalId} {...register("terminalId")} /></Field>
        <Field label="Merchant ID" required htmlFor="t-mid" error={errors.merchantId?.message}><Input id="t-mid" mono invalid={!!errors.merchantId} {...register("merchantId")} /></Field>
        <Field label="Manufacturer" required htmlFor="t-mfr" error={errors.manufacturer?.message}><Input id="t-mfr" invalid={!!errors.manufacturer} {...register("manufacturer")} /></Field>
        <Field label="Model" required htmlFor="t-model" error={errors.model?.message}><Input id="t-model" invalid={!!errors.model} {...register("model")} /></Field>
        <Field label="Serial number" required htmlFor="t-serial" error={errors.serialNumber?.message}><Input id="t-serial" mono invalid={!!errors.serialNumber} {...register("serialNumber")} /></Field>
        <Field label="Connection" required htmlFor="t-conn"><Select id="t-conn" options={CONNECTIONS} {...register("connection")} /></Field>
        <Field label="Office" required htmlFor="t-office" error={errors.officeId?.message}><Select id="t-office" placeholder="Select office" options={ctx.offices.map((o) => ({ value: o.id, label: o.name }))} invalid={!!errors.officeId} {...register("officeId")} /></Field>
        <Field label="Assigned cashier" htmlFor="t-cashier"><Select id="t-cashier" placeholder="Unassigned" options={ctx.cashiers.map((u) => ({ value: u.id, label: fullName(u) }))} {...register("assignedCashierId")} /></Field>
        <Field label="Status" required htmlFor="t-status"><Select id="t-status" options={STATUSES} {...register("status")} /></Field>
      </form>
    </Modal>
  );
}

function AssignModal({ terminal, kind, ctx, onDone }: { terminal: PosTerminal; kind: "office" | "cashier"; ctx: Ctx; onDone: () => void }) {
  const [value, setValue] = useState(kind === "office" ? terminal.officeId : terminal.assignedCashierId ?? "");
  const save = useAction(
    () => posService.saveTerminal({ ...terminal, ...(kind === "office" ? { officeId: value } : { assignedCashierId: value || undefined }) }),
    { success: kind === "office" ? "Office assigned" : value ? "Cashier assigned" : "Cashier unassigned" },
  );
  const officeCashiers = ctx.cashiers.filter((u) => u.officeId === terminal.officeId);
  const otherCashiers = ctx.cashiers.filter((u) => u.officeId !== terminal.officeId);
  const officeName = (id: string) => ctx.offices.find((o) => o.id === id)?.name ?? "Other office";
  return (
    <Modal
      open
      onClose={() => !save.busy && onDone()}
      size="sm"
      title={kind === "office" ? "Assign office" : "Assign cashier"}
      description={<><span className="mono">{terminal.terminalId}</span> · {terminal.name}</>}
      footer={<FormFooter formId="assign-form" busy={save.busy} onCancel={onDone} submitLabel={kind === "office" ? "Assign office" : "Save assignment"} />}
    >
      <form id="assign-form" onSubmit={async (e) => { e.preventDefault(); if (kind === "office" && !value) return; if (await save.run()) onDone(); }}>
        {kind === "office" ? (
          <Field label="Office" required htmlFor="as-office" error={!value ? "Select an office" : undefined}>
            <Select id="as-office" placeholder="Select office" options={ctx.offices.map((o) => ({ value: o.id, label: o.name }))} value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        ) : (
          <Field label="Cashier" htmlFor="as-cashier" help="Only users with the Cashier role are listed.">
            <select id="as-cashier" className="inp" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="">Unassigned</option>
              {officeCashiers.length > 0 && <optgroup label={officeName(terminal.officeId)}>{officeCashiers.map((u) => <option key={u.id} value={u.id} disabled={u.status !== "active"}>{fullName(u)}{u.status !== "active" ? " (disabled)" : ""}</option>)}</optgroup>}
              {otherCashiers.length > 0 && <optgroup label="Other offices">{otherCashiers.map((u) => <option key={u.id} value={u.id} disabled={u.status !== "active"}>{fullName(u)} · {officeName(u.officeId)}</option>)}</optgroup>}
            </select>
          </Field>
        )}
      </form>
    </Modal>
  );
}

export default function TerminalsPage() {
  const { can } = useDemoUser();
  const canEdit = can("terminals.manage");
  const terminals = useServiceQuery(() => posService.listTerminals(), []);
  const ctxQ = useServiceQuery(async (): Promise<Ctx> => {
    const [offices, users] = await Promise.all([settingsService.listOffices(), userService.list()]);
    return { offices, cashiers: users.filter((u) => u.role === "cashier") };
  }, []);
  const [q, setQ] = useState("");
  const [office, setOffice] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<PosTerminal | "new" | null>(null);
  const [assigning, setAssigning] = useState<{ t: PosTerminal; kind: "office" | "cashier" } | null>(null);
  const [toggling, setToggling] = useState<PosTerminal | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const toggle = useAction((t: PosTerminal) => posService.setTerminalStatus(t.id, t.status === "disabled" ? "idle" : "disabled"), { success: (t) => `${t.terminalId} ${t.status === "disabled" ? "disabled" : "enabled"}` });

  const ctx = ctxQ.data;
  const officeName = (id: string) => ctx?.offices.find((o) => o.id === id)?.name ?? "—";
  const cashierName = (id?: string) => (id ? fullName(ctx?.cashiers.find((u) => u.id === id)) : "Unassigned");

  const test = async (t: PosTerminal) => {
    setTesting(t.id);
    try {
      const r = await posService.testConnection(t.id);
      if (r.ok) toast.success("Connection successful", { description: r.message });
      else toast.error("Connection failed", { description: r.message });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setTesting(null);
    }
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (terminals.data ?? []).filter((t) => (!office || t.officeId === office) && (!status || t.status === status) && (!term || `${t.name} ${t.terminalId} ${t.merchantId} ${t.serialNumber} ${t.model}`.toLowerCase().includes(term)));
  }, [terminals.data, q, office, status]);

  const actions = (t: PosTerminal, compact: boolean) => {
    const cls = compact ? "btn btn-s btn-sm btn-icon" : "btn btn-s";
    const label = (s: string) => (compact ? <span className="sr">{s}</span> : s);
    return (
      <div className="flex flex-wrap gap-1.5">
        {canEdit && <button type="button" className={cls} onClick={() => setEditing(t)} aria-label={`Edit ${t.terminalId}`} title="Edit"><Pencil size={15} aria-hidden="true" />{label("Edit")}</button>}
        {canEdit && <button type="button" className={cls} onClick={() => setAssigning({ t, kind: "office" })} aria-label={`Assign office to ${t.terminalId}`} title="Assign office"><Building2 size={15} aria-hidden="true" />{label("Office")}</button>}
        {canEdit && <button type="button" className={cls} onClick={() => setAssigning({ t, kind: "cashier" })} aria-label={`Assign cashier to ${t.terminalId}`} title="Assign cashier"><UserCheck size={15} aria-hidden="true" />{label("Cashier")}</button>}
        <button type="button" className={cls} onClick={() => test(t)} disabled={testing === t.id} aria-label={`Test connection for ${t.terminalId}`} title="Test connection">
          {testing === t.id ? <span className="spin" aria-hidden="true" /> : <PlugZap size={15} aria-hidden="true" />}{label("Test")}
        </button>
        {!canEdit ? null : t.status === "disabled" ? (
          <button type="button" className={cls} onClick={() => setToggling(t)} aria-label={`Enable ${t.terminalId}`} title="Enable"><Power size={15} aria-hidden="true" />{label("Enable")}</button>
        ) : (
          <button type="button" className={cls.replace("btn-s", "btn-do")} onClick={() => setToggling(t)} aria-label={`Disable ${t.terminalId}`} title="Disable"><PowerOff size={15} aria-hidden="true" />{label("Disable")}</button>
        )}
      </div>
    );
  };

  const columns: ColumnDef<PosTerminal, unknown>[] = [
    { id: "name", header: "Terminal Name", accessorFn: (t) => t.name, cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
    { id: "tid", header: "Terminal ID", accessorFn: (t) => t.terminalId, cell: ({ row }) => <span className="mono font-semibold">{row.original.terminalId}</span> },
    { id: "mid", header: "Merchant ID", accessorFn: (t) => t.merchantId, cell: ({ row }) => <span className="mono">{row.original.merchantId}</span> },
    { id: "model", header: "Model", accessorFn: (t) => `${t.manufacturer} ${t.model}` },
    { id: "serial", header: "Serial", accessorFn: (t) => t.serialNumber, cell: ({ row }) => <span className="mono">{row.original.serialNumber}</span> },
    { id: "office", header: "Office", accessorFn: (t) => officeName(t.officeId) },
    { id: "cashier", header: "Assigned Cashier", accessorFn: (t) => cashierName(t.assignedCashierId), cell: ({ row }) => <span className={row.original.assignedCashierId ? "" : "mut"}>{cashierName(row.original.assignedCashierId)}</span> },
    { id: "status", header: "Status", accessorFn: (t) => t.status, cell: ({ row }) => <StatusBadge kind="terminal-admin" status={row.original.status} /> },
    { id: "last", header: "Last Connected", accessorFn: (t) => t.lastConnectedAt ?? "", cell: ({ row }) => <span className="whitespace-nowrap" title={formatDateTime(row.original.lastConnectedAt)}>{row.original.lastConnectedAt ? formatRelative(row.original.lastConnectedAt) : "Never"}</span> },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => actions(row.original, true) },
  ];

  const error = terminals.error ?? ctxQ.error;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration" title="POS Terminals" description="Vendor-neutral card terminal fleet used by cashiers. Every terminal reports through the payment terminal adapter — test a terminal before assigning it to a counter." actions={canEdit ? <button type="button" className="btn btn-p" onClick={() => setEditing("new")} disabled={!ctx}><Plus size={18} aria-hidden="true" />Add Terminal</button> : undefined} />
      {terminals.data && terminals.data.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Terminals by status">
          {STATUSES.map((s) => {
            const n = terminals.data!.filter((t) => t.status === s.value).length;
            return (
              <li key={s.value}>
                <button type="button" className={`btn btn-s btn-sm ${status === s.value ? "!border-[#1515e8] !bg-[#f5f5ff]" : ""}`} aria-pressed={status === s.value} onClick={() => setStatus(status === s.value ? "" : s.value)}>
                  <Badge tone={TERMINAL_ADMIN_STATUS[s.value as keyof typeof TERMINAL_ADMIN_STATUS].tone}>{s.label}</Badge>
                  <span className="font-bold">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <FilterBar>
        <SearchField id="term-q" value={q} onChange={setQ} placeholder="Name, Terminal ID, Merchant ID or serial" />
        <FilterSelect id="term-office" label="Office" value={office} onChange={setOffice} options={(ctx?.offices ?? []).map((o) => ({ value: o.id, label: o.name }))} all="All offices" />
        <FilterSelect id="term-status" label="Status" value={status} onChange={setStatus} options={STATUSES} all="All statuses" />
      </FilterBar>
      {error ? (
        <ErrorState message={error} onRetry={() => { terminals.reload(); ctxQ.reload(); }} />
      ) : (
        <>
          {terminals.data && <ResultCount shown={rows.length} total={terminals.data.length} noun="terminals" />}
          <DataTable
            storageKey="admin-terminals"
            data={terminals.data && ctx ? rows : undefined}
            loading={terminals.loading || ctxQ.loading}
            columns={columns}
            initialSort={[{ id: "name", desc: false }]}
            mobileCard={(t) => (
              <MobileCard
                title={t.terminalId}
                badge={<StatusBadge kind="terminal-admin" status={t.status} />}
                lines={[t.name, `${t.manufacturer} ${t.model} · S/N ${t.serialNumber}`, `MID ${t.merchantId}`, `${officeName(t.officeId)} · ${cashierName(t.assignedCashierId)}`, `Last connected: ${t.lastConnectedAt ? formatRelative(t.lastConnectedAt) : "Never"}`]}
                footer={actions(t, false)}
              />
            )}
            empty={{ title: "No POS terminals found", message: q || office || status ? "No terminals match the current filters." : "Add a POS terminal to start taking card payments.", action: canEdit ? { label: "Add Terminal", onClick: () => setEditing("new") } : undefined }}
          />
        </>
      )}

      {editing && canEdit && ctx && <TerminalForm key={editing === "new" ? "new" : editing.id} terminal={editing === "new" ? null : editing} ctx={ctx} onDone={() => setEditing(null)} />}
      {assigning && canEdit && ctx && <AssignModal key={`${assigning.t.id}-${assigning.kind}`} terminal={assigning.t} kind={assigning.kind} ctx={ctx} onDone={() => setAssigning(null)} />}

      <ConfirmDialog
        open={!!toggling}
        onClose={() => setToggling(null)}
        busy={toggle.busy}
        tone={toggling?.status === "disabled" ? "primary" : "danger"}
        title={toggling?.status === "disabled" ? "Enable terminal?" : "Disable terminal?"}
        confirmLabel={toggling?.status === "disabled" ? "Enable terminal" : "Disable terminal"}
        message={toggling?.status === "disabled"
          ? <>Terminal <span className="mono font-semibold">{toggling?.terminalId}</span> will be set to Idle and can take payments again.</>
          : <>Terminal <span className="mono font-semibold">{toggling?.terminalId}</span> will stop accepting card payments until it is enabled again.</>}
        onConfirm={async () => {
          if (toggling && (await toggle.run(toggling))) setToggling(null);
        }}
      />
    </div>
  );
}

