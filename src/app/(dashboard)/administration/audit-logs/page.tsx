"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, X } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { ROLE_LABELS } from "@/lib/constants";
import { downloadText, formatDate, formatTime, toCsv } from "@/lib/formatting";
import { auditService } from "@/services/audit.service";
import { AUDIT_ACTION_LABELS } from "@/data/mock/audit-logs";
import type { AuditAction, AuditEvent } from "@/types";
import { PageHeader } from "@/components/ui/layout-bits";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { FilterBar, FilterSelect, ResultCount, SearchField } from "@/components/admin/admin-bits";

const ACTION_OPTIONS = (Object.keys(AUDIT_ACTION_LABELS) as AuditAction[]).map((a) => ({ value: a, label: AUDIT_ACTION_LABELS[a] })).sort((a, b) => a.label.localeCompare(b.label));
const localDay = (ts: string) => formatDate(ts, "yyyy-MM-dd");
const record = (e: AuditEvent) => e.recordLabel ?? e.recordId ?? "—";

export default function AuditLogsPage() {
  const events = useServiceQuery(() => auditService.list(), []);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [user, setUser] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const all = events.data;
  const users = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of all ?? []) if (!m.has(e.userId)) m.set(e.userId, e.userName);
    return [...m].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [all]);
  const entities = useMemo(() => [...new Set((all ?? []).map((e) => e.entity))].sort().map((e) => ({ value: e, label: e })), [all]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (all ?? []).filter((e) => {
      if (action && e.action !== action) return false;
      if (user && e.userId !== user) return false;
      if (entity && e.entity !== entity) return false;
      const day = localDay(e.timestamp);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return !term || `${e.description} ${e.userName} ${e.recordLabel ?? ""} ${e.recordId ?? ""} ${AUDIT_ACTION_LABELS[e.action] ?? ""}`.toLowerCase().includes(term);
    });
  }, [all, q, action, user, entity, from, to]);

  const filtered = !!(q || action || user || entity || from || to);
  const clear = () => { setQ(""); setAction(""); setUser(""); setEntity(""); setFrom(""); setTo(""); };

  const exportCsv = () => {
    const csv = toCsv(
      [
        { key: "user", label: "User" }, { key: "role", label: "Role" }, { key: "action", label: "Action" }, { key: "entity", label: "Entity" },
        { key: "record", label: "Record" }, { key: "description", label: "Description" }, { key: "date", label: "Date" }, { key: "time", label: "Time" },
      ],
      rows.map((e) => ({ user: e.userName, role: ROLE_LABELS[e.role] ?? e.role, action: AUDIT_ACTION_LABELS[e.action] ?? e.action, entity: e.entity, record: record(e), description: e.description, date: formatDate(e.timestamp, "yyyy-MM-dd"), time: formatTime(e.timestamp) })),
    );
    downloadText(`rta-audit-log-${formatDate(new Date(), "yyyyMMdd-HHmm")}.csv`, csv);
    toast.success(`Exported ${rows.length} audit event${rows.length === 1 ? "" : "s"}`);
  };

  const columns: ColumnDef<AuditEvent, unknown>[] = [
    { id: "user", header: "User", accessorFn: (e) => e.userName, cell: ({ row }) => <span className="font-semibold whitespace-nowrap">{row.original.userName}</span> },
    { id: "role", header: "Role", accessorFn: (e) => ROLE_LABELS[e.role] ?? e.role, cell: ({ row }) => <span className="whitespace-nowrap">{ROLE_LABELS[row.original.role] ?? row.original.role}</span> },
    { id: "action", header: "Action", accessorFn: (e) => AUDIT_ACTION_LABELS[e.action] ?? e.action, cell: ({ row }) => <Badge tone="insp">{AUDIT_ACTION_LABELS[row.original.action] ?? row.original.action}</Badge> },
    { id: "entity", header: "Entity", accessorFn: (e) => e.entity },
    { id: "record", header: "Record", accessorFn: record, cell: ({ row }) => <span className="mono whitespace-nowrap">{record(row.original)}</span> },
    { id: "desc", header: "Description", accessorFn: (e) => e.description, cell: ({ row }) => <span className="block min-w-[220px] max-w-[380px]">{row.original.description}</span> },
    { id: "date", header: "Date", accessorFn: (e) => e.timestamp, cell: ({ row }) => <span className="mono whitespace-nowrap">{formatDate(row.original.timestamp)}</span> },
    { id: "time", header: "Time", accessorFn: (e) => formatTime(e.timestamp), cell: ({ row }) => <span className="mono">{formatTime(row.original.timestamp)}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit Logs"
        description="Read-only record of every significant action taken in the system."
        actions={<button type="button" className="btn btn-s" onClick={exportCsv} disabled={!rows.length}><Download size={16} aria-hidden="true" />Export CSV</button>}
      />
      <FilterBar>
        <SearchField id="audit-q" value={q} onChange={setQ} placeholder="Description, user or record" />
        <FilterSelect id="audit-action" label="Action" value={action} onChange={setAction} options={ACTION_OPTIONS} all="All actions" />
        <FilterSelect id="audit-user" label="User" value={user} onChange={setUser} options={users} all="All users" />
        <FilterSelect id="audit-entity" label="Entity" value={entity} onChange={setEntity} options={entities} all="All entities" />
        <div>
          <label htmlFor="audit-from" className="lbl">From date</label>
          <input id="audit-from" type="date" className="inp" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="audit-to" className="lbl">To date</label>
          <input id="audit-to" type="date" className="inp" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
        {filtered && <div className="!flex-none"><button type="button" className="btn btn-g" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button></div>}
      </FilterBar>
      {events.error ? (
        <ErrorState message={events.error} onRetry={() => events.reload()} />
      ) : (
        <>
          {all && <ResultCount shown={rows.length} total={all.length} noun="events" />}
          <DataTable
            storageKey="admin-audit"
            data={all ? rows : undefined}
            loading={events.loading}
            columns={columns}
            initialSort={[{ id: "date", desc: true }]}
            mobileCard={(e) => (
              <MobileCard
                title={record(e)}
                badge={<Badge tone="insp">{AUDIT_ACTION_LABELS[e.action] ?? e.action}</Badge>}
                lines={[e.description, `${e.userName} · ${ROLE_LABELS[e.role] ?? e.role}`, `${e.entity} · ${formatDate(e.timestamp)} ${formatTime(e.timestamp)}`]}
              />
            )}
            empty={{ title: "No audit events", message: filtered ? "No audit events match the current filters." : "No activity has been recorded yet.", action: filtered ? { label: "Clear filters", onClick: clear } : undefined }}
          />
        </>
      )}
    </div>
  );
}
