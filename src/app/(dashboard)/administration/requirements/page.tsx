"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { DOCUMENT_DEFS, DOCUMENT_TYPE_OPTIONS, documentLabel, type DocumentRule } from "@/config/document-requirements";
import { RENEWAL_INSPECTION_GROUPS, inspectionProfileFor, inspectionRequiredFor, inspectionRuleText } from "@/config/inspection-checklists";
import { OWNERSHIP_TYPES } from "@/config/ownership-types";
import { TRANSACTION_TYPES, getTransactionType, transactionLabel } from "@/config/transaction-types";
import { IMPORT_STATUSES, VEHICLE_USAGES } from "@/config/vehicle-usage";
import { VEHICLE_GROUPS, VEHICLE_TYPES, getVehicleType } from "@/config/vehicle-types";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { resolveApplicationRequirements } from "@/lib/requirements";
import { settingsService } from "@/services/settings.service";
import type { DocumentType, ImportStatus, OwnershipType, TransactionType, VehicleGroup, VehicleType, VehicleUsage } from "@/types";
import { PageHeader, Section, Tabs } from "@/components/ui/layout-bits";
import { Field, Input, Segmented, Select, Toggle } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Alert, EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { Badge, StatusBadge } from "@/components/ui/status-badge";
import { ActiveBadge, FilterBar, FilterSelect, FormFooter, ResultCount, SearchField } from "@/components/admin/admin-bits";
import { CheckGroup, ChipList, ConfigTable, ReadOnlyBanner, VehicleFieldMatrix, YesNo, labelsFor } from "@/components/admin/config-bits";

type TabKey = "documents" | "inspection" | "fields" | "test";

const TXN_OPTIONS = TRANSACTION_TYPES.map((t) => ({ value: t.key, label: t.label }));
const GROUP_OPTIONS = VEHICLE_GROUPS.map((g) => ({ value: g.key, label: g.label }));
const TYPE_OPTIONS = VEHICLE_TYPES.map((t) => ({ value: t.key, label: t.label }));
const OWNERSHIP_OPTIONS = OWNERSHIP_TYPES.map((o) => ({ value: o.value, label: o.label }));

function conditions(r: DocumentRule): { label: string; items: string[] }[] {
  const out = [
    { label: "Transactions", items: (r.transactionTypes ?? []).map((t) => transactionLabel(t, true)) },
    { label: "Groups", items: labelsFor(r.vehicleGroups, GROUP_OPTIONS) },
    { label: "Types", items: labelsFor(r.vehicleTypes, TYPE_OPTIONS) },
    { label: "Use", items: labelsFor(r.usages, VEHICLE_USAGES) },
    { label: "Ownership", items: labelsFor(r.ownershipTypes, OWNERSHIP_OPTIONS) },
    { label: "Import", items: labelsFor(r.importStatuses, IMPORT_STATUSES) },
  ].filter((c) => c.items.length);
  return out.length ? out : [{ label: "Applies", items: ["Every transaction"] }];
}

function Conditions({ rule }: { rule: DocumentRule }) {
  return (
    <dl className="m-0 flex flex-col gap-1.5">
      {conditions(rule).map((c) => (
        <div key={c.label} className="flex flex-wrap items-start gap-1.5">
          <dt className="mut w-[86px] flex-none pt-0.5 text-[11.5px] font-semibold uppercase tracking-wide">{c.label}</dt>
          <dd className="m-0 min-w-0 flex-1"><ChipList items={c.items} /></dd>
        </div>
      ))}
    </dl>
  );
}

function nextRuleId(rules: DocumentRule[]): string {
  const max = rules.reduce((m, r) => Math.max(m, Number(/^DR-(\d+)$/.exec(r.id)?.[1] ?? 0)), 0);
  return `DR-${String(max + 1).padStart(2, "0")}`;
}

/* ───────────── add / edit document rule ───────────── */

function DocumentRuleForm({ rule, allRules, onDone }: { rule: DocumentRule | null; allRules: DocumentRule[]; onDone: () => void }) {
  const [draft, setDraft] = useState<DocumentRule>(
    rule ?? { id: nextRuleId(allRules), document: "other_supporting", required: true, transactionTypes: [], vehicleTypes: [], vehicleGroups: [], usages: [], ownershipTypes: [], importStatuses: [], reason: "", active: true },
  );
  const [touched, setTouched] = useState(false);
  const save = useAction((r: DocumentRule) => settingsService.saveDocumentRule(r), { success: (r) => `Rule ${r.id} saved` });
  const set = <K extends keyof DocumentRule>(k: K, v: DocumentRule[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const reasonError = draft.reason.trim().length < 3 ? "Enter the reason shown to officers (at least 3 characters)" : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (reasonError) return;
    const clean = (a?: string[]) => (a && a.length ? a : undefined);
    const payload: DocumentRule = {
      ...draft,
      reason: draft.reason.trim(),
      transactionTypes: clean(draft.transactionTypes) as TransactionType[] | undefined,
      vehicleTypes: clean(draft.vehicleTypes) as VehicleType[] | undefined,
      vehicleGroups: clean(draft.vehicleGroups) as VehicleGroup[] | undefined,
      usages: clean(draft.usages) as VehicleUsage[] | undefined,
      ownershipTypes: clean(draft.ownershipTypes) as OwnershipType[] | undefined,
      importStatuses: clean(draft.importStatuses) as ImportStatus[] | undefined,
    };
    if (await save.run(payload)) onDone();
  };

  return (
    <Modal
      open
      size="xl"
      onClose={() => !save.busy && onDone()}
      title={rule ? `Edit rule ${rule.id}` : "Add document rule"}
      description="A document is required when every condition you set matches. A document required by any matching rule is required."
      footer={<FormFooter formId="doc-rule-form" busy={save.busy} onCancel={onDone} submitLabel={rule ? "Save rule" : "Add rule"} />}
    >
      <form id="doc-rule-form" className="form" onSubmit={submit} noValidate>
        <Field label="Document" required htmlFor="dr-doc" help={DOCUMENT_DEFS[draft.document]?.help}>
          <Select id="dr-doc" value={draft.document} onChange={(e) => set("document", e.target.value as DocumentType)} options={DOCUMENT_TYPE_OPTIONS} />
        </Field>
        <div>
          <span className="lbl" aria-hidden="true">Requirement</span>
          <Segmented label="Requirement" value={draft.required ? "required" : "optional"} onChange={(v) => set("required", v === "required")} options={[{ value: "required", label: "Required" }, { value: "optional", label: "Optional" }]} />
        </div>
        <Field label="Reason" required htmlFor="dr-reason" error={touched ? reasonError : undefined} help="Shown next to the document on the application, e.g. “Imported vehicle”." className="full">
          <Input id="dr-reason" value={draft.reason} invalid={touched && !!reasonError} onChange={(e) => set("reason", e.target.value)} maxLength={140} />
        </Field>
        <CheckGroup legend="Transaction types" options={TXN_OPTIONS} value={draft.transactionTypes ?? []} onChange={(v) => set("transactionTypes", v)} />
        <CheckGroup legend="Vehicle groups" options={GROUP_OPTIONS} value={draft.vehicleGroups ?? []} onChange={(v) => set("vehicleGroups", v)} />
        <CheckGroup legend="Vehicle types" options={TYPE_OPTIONS} value={draft.vehicleTypes ?? []} onChange={(v) => set("vehicleTypes", v)} help="Leave all unticked to apply to any type. Combine with groups only if both must match." />
        <CheckGroup legend="Vehicle use" options={VEHICLE_USAGES} value={draft.usages ?? []} onChange={(v) => set("usages", v)} />
        <CheckGroup legend="Ownership types" options={OWNERSHIP_OPTIONS} value={draft.ownershipTypes ?? []} onChange={(v) => set("ownershipTypes", v)} />
        <CheckGroup legend="Import status" options={IMPORT_STATUSES} value={draft.importStatuses ?? []} onChange={(v) => set("importStatuses", v)} />
        <div className="full">
          <Toggle checked={draft.active} onChange={(v) => set("active", v)} label="Active" description="Inactive rules are ignored when documents are resolved for new applications." />
        </div>
      </form>
    </Modal>
  );
}

/* ───────────── tabs ───────────── */

function DocumentRulesTab({ rules, canEdit, onEdit }: { rules: DocumentRule[]; canEdit: boolean; onEdit: (r: DocumentRule) => void }) {
  const [q, setQ] = useState("");
  const [doc, setDoc] = useState("");
  const [txn, setTxn] = useState("");
  const [status, setStatus] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rules.filter(
      (r) =>
        (!doc || r.document === doc) &&
        (!txn || !r.transactionTypes?.length || r.transactionTypes.includes(txn as TransactionType)) &&
        (!status || (status === "active") === r.active) &&
        (!term || `${r.id} ${documentLabel(r.document)} ${r.reason}`.toLowerCase().includes(term)),
    );
  }, [rules, q, doc, txn, status]);
  const filtered = !!(q || doc || txn || status);

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        <SearchField id="dr-q" value={q} onChange={setQ} placeholder="Rule ID, document or reason" />
        <FilterSelect id="dr-f-doc" label="Document" value={doc} onChange={setDoc} options={DOCUMENT_TYPE_OPTIONS} all="All documents" />
        <FilterSelect id="dr-f-txn" label="Applies to transaction" value={txn} onChange={setTxn} options={TXN_OPTIONS} all="Any transaction" />
        <FilterSelect id="dr-f-status" label="Status" value={status} onChange={setStatus} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} all="All statuses" />
      </FilterBar>
      <ResultCount shown={rows.length} total={rules.length} noun="rules" />
      {!rows.length ? (
        <EmptyState title="No document rules found" message={filtered ? "No rules match the current filters." : "No document rules are configured."} />
      ) : (
        <>
          <div className="hidden md:block">
            <ConfigTable
              caption="Document requirement rules"
              minWidth={980}
              head={
                <tr>
                  <th scope="col">Rule</th>
                  <th scope="col">Document</th>
                  <th scope="col">Requirement</th>
                  <th scope="col">Applies when</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                  {canEdit && <th scope="col"><span className="sr">Actions</span></th>}
                </tr>
              }
            >
              {rows.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-70"}>
                  <td className="mono font-semibold whitespace-nowrap">{r.id}</td>
                  <td className="min-w-[180px] font-semibold">{documentLabel(r.document)}</td>
                  <td><StatusBadge kind="document" status={r.required ? "required" : "optional"} /></td>
                  <td className="min-w-[280px]"><Conditions rule={r} /></td>
                  <td className="min-w-[160px] text-[12.5px]">{r.reason}</td>
                  <td><ActiveBadge active={r.active} /></td>
                  {canEdit && <td><button type="button" className="btn btn-s btn-sm" onClick={() => onEdit(r)} aria-label={`Edit rule ${r.id}`}><Pencil size={14} aria-hidden="true" />Edit</button></td>}
                </tr>
              ))}
            </ConfigTable>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="mono text-[12.5px] font-semibold">{r.id}</span>
                  <span className="inline-flex gap-1.5"><StatusBadge kind="document" status={r.required ? "required" : "optional"} /><ActiveBadge active={r.active} /></span>
                </div>
                <p className="m-0 mt-1 text-[15px] font-bold">{documentLabel(r.document)}</p>
                <p className="mut m-0 mt-0.5 text-[13px]">{r.reason}</p>
                <div className="mt-2.5"><Conditions rule={r} /></div>
                {canEdit && (
                  <div className="mt-2.5 border-t border-[#edeff3] pt-2.5">
                    <button type="button" className="btn btn-s" onClick={() => onEdit(r)} aria-label={`Edit rule ${r.id}`}><Pencil size={14} aria-hidden="true" />Edit</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const INSPECTION_MODE: Record<"always" | "by_rule" | "never", { label: string; tone: "pend" | "assess" | "draft" }> = {
  always: { label: "Always", tone: "pend" },
  by_rule: { label: "By rule", tone: "assess" },
  never: { label: "Never", tone: "draft" },
};

function InspectionTab() {
  const reps = VEHICLE_GROUPS.map((g) => ({ group: g, rep: VEHICLE_TYPES.find((t) => t.group === g.key)! }));
  const ruleTxns = TRANSACTION_TYPES.filter((t) => t.inspection !== "never");
  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info" title="Inspection rules are sample configuration">
        <p>These rules are read from <span className="mono">src/config/inspection-checklists.ts</span> and <span className="mono">transaction-types.ts</span>. Confirm them against RTA policy; they become editable when the requirement tables are connected (Phase 2).</p>
      </Alert>
      <Section title="By transaction type" description="Default inspection behaviour for each transaction.">
        <ConfigTable caption="Inspection by transaction type" minWidth={640} head={<tr><th scope="col">Transaction</th><th scope="col">Inspection</th><th scope="col">Rule</th></tr>}>
          {TRANSACTION_TYPES.map((t) => (
            <tr key={t.key}>
              <td className="font-semibold">{t.label}</td>
              <td><Badge tone={INSPECTION_MODE[t.inspection].tone}>{INSPECTION_MODE[t.inspection].label}</Badge></td>
              <td className="text-[12.5px]">
                {t.inspection === "always"
                  ? "Every vehicle is inspected."
                  : t.inspection === "never"
                    ? "No inspection."
                    : t.key === "change_vehicle"
                      ? "Only when the change is technical (engine, body, mass)."
                      : `Required for: ${RENEWAL_INSPECTION_GROUPS.map((g) => VEHICLE_GROUPS.find((x) => x.key === g)?.label ?? g).join(", ")}.`}
              </td>
            </tr>
          ))}
        </ConfigTable>
      </Section>
      <Section title="By vehicle group" description="Resulting requirement for transactions that may inspect, and the checklist profile used.">
        <ConfigTable
          caption="Inspection requirement by vehicle group"
          minWidth={900}
          head={
            <tr>
              <th scope="col">Vehicle group</th>
              {ruleTxns.map((t) => <th key={t.key} scope="col" className="!whitespace-normal">{t.shortLabel}</th>)}
              <th scope="col">Checklist profile</th>
            </tr>
          }
        >
          {reps.map(({ group, rep }) => {
            const profile = inspectionProfileFor(rep.key);
            return (
              <tr key={group.key}>
                <th scope="row" className="!bg-white !text-[13px] !font-semibold !normal-case !tracking-normal !text-[#0b0b0f]">{group.label}</th>
                {ruleTxns.map((t) => (
                  <td key={t.key}>
                    {t.key === "change_vehicle" ? (
                      <Badge tone="assess">If technical</Badge>
                    ) : (
                      <YesNo value={inspectionRequiredFor({ transactionType: t.key, vehicleType: rep.key })} yes="Required" no="Not required" />
                    )}
                  </td>
                ))}
                <td className="whitespace-nowrap"><span className="mono font-semibold">{profile.code}</span><span className="mut block text-[12px]">{profile.label}</span></td>
              </tr>
            );
          })}
        </ConfigTable>
        <p className="help m-0">Renewal inspection groups: {RENEWAL_INSPECTION_GROUPS.map((g) => VEHICLE_GROUPS.find((x) => x.key === g)?.label ?? g).join(", ")}.</p>
      </Section>
    </div>
  );
}

function TestRulesTab({ rules }: { rules: DocumentRule[] | undefined }) {
  const [transactionType, setTransactionType] = useState<TransactionType>("new");
  const [vehicleType, setVehicleType] = useState<VehicleType>("sedan");
  const [usage, setUsage] = useState<VehicleUsage>("private");
  const [ownership, setOwnership] = useState<OwnershipType>("individual");
  const [importStatus, setImportStatus] = useState<ImportStatus>("used_import");
  const [technical, setTechnical] = useState(false);

  const ctx = { transactionType, vehicleType, vehicleUsage: usage, ownershipType: ownership, importStatus, technicalChange: technical };
  const result = resolveApplicationRequirements(ctx, rules);
  const txn = getTransactionType(transactionType);

  return (
    <div className="split">
      <div className="r">
        <Section title="Scenario" description="Uses the rules as currently saved.">
          <div className="form">
            <Field label="Transaction" htmlFor="tr-txn" className="full"><Select id="tr-txn" value={transactionType} onChange={(e) => setTransactionType(e.target.value as TransactionType)} options={TXN_OPTIONS} /></Field>
            <Field label="Vehicle type" htmlFor="tr-type" className="full">
              <select id="tr-type" className="inp" value={vehicleType} onChange={(e) => { const k = e.target.value as VehicleType; setVehicleType(k); setUsage(getVehicleType(k).defaultUsage); }}>
                {VEHICLE_GROUPS.map((g) => (
                  <optgroup key={g.key} label={g.label}>
                    {VEHICLE_TYPES.filter((t) => t.group === g.key).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Use" htmlFor="tr-use"><Select id="tr-use" value={usage} onChange={(e) => setUsage(e.target.value as VehicleUsage)} options={VEHICLE_USAGES} /></Field>
            <Field label="Ownership" htmlFor="tr-own"><Select id="tr-own" value={ownership} onChange={(e) => setOwnership(e.target.value as OwnershipType)} options={OWNERSHIP_OPTIONS} /></Field>
            <Field label="Import status" htmlFor="tr-imp" className="full"><Select id="tr-imp" value={importStatus} onChange={(e) => setImportStatus(e.target.value as ImportStatus)} options={IMPORT_STATUSES} /></Field>
            {transactionType === "change_vehicle" && (
              <div className="full"><Toggle checked={technical} onChange={setTechnical} label="Technical change" description="Engine, body or mass is changing." /></div>
            )}
          </div>
        </Section>
      </div>
      <div className="l" aria-live="polite">
        <Section title="Result" description={txn.label}>
          <div className="g3">
            <div className="rounded-lg border border-[#e1e4ea] p-3">
              <p className="eb">Inspection</p>
              <div className="mt-1.5"><YesNo value={result.inspectionRequired} yes="Required" no="Not required" /></div>
              <p className="mut m-0 mt-1.5 text-[12.5px]">{transactionType === "change_vehicle" ? (technical ? "Technical change requested" : "Not a technical change") : inspectionRuleText(vehicleType, transactionType)}</p>
            </div>
            <div className="rounded-lg border border-[#e1e4ea] p-3">
              <p className="eb">Insurance verification</p>
              <div className="mt-1.5"><YesNo value={result.insuranceRequired} yes="Required" no="Not required" /></div>
            </div>
            <div className="rounded-lg border border-[#e1e4ea] p-3">
              <p className="eb">Plate</p>
              <div className="mt-1.5"><YesNo value={result.plateRequired} yes="New plate issued" no="No new plate" /></div>
            </div>
          </div>
          <div>
            <h3 className="h3 mb-2 text-[14px]">Documents ({result.documents.filter((d) => d.required).length} required, {result.documents.filter((d) => !d.required).length} optional)</h3>
            {!rules ? (
              <Skeleton className="h-24" />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {result.documents.map((d) => (
                  <li key={d.type} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[#e1e4ea] px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold">{documentLabel(d.type)}</span>
                      <span className="mut block text-[12.5px]">{d.reason}</span>
                    </span>
                    <StatusBadge kind="document" status={d.required ? "required" : "optional"} />
                  </li>
                ))}
                {!result.documents.length && <li className="mut text-[13px]">No documents apply to this scenario.</li>}
              </ul>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

export default function RequirementsPage() {
  const { can } = useDemoUser();
  const canEdit = can("requirements.manage");
  const rules = useServiceQuery(() => settingsService.listDocumentRules(), []);
  const [tab, setTab] = useState<TabKey>("documents");
  const [editing, setEditing] = useState<DocumentRule | "new" | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration · Configuration"
        title="Requirements"
        description="Which supporting documents, inspections and technical fields each transaction needs, by vehicle type, use and ownership."
        actions={canEdit && tab === "documents" ? <button type="button" className="btn btn-p" onClick={() => setEditing("new")} disabled={!rules.data}><Plus size={18} aria-hidden="true" />Add Document Rule</button> : undefined}
      />
      {!canEdit && <ReadOnlyBanner what="the requirement rules" />}

      <Tabs<TabKey>
        label="Requirement sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "documents", label: "Document Rules", count: rules.data?.length },
          { value: "inspection", label: "Inspection Requirements" },
          { value: "fields", label: "Required Fields" },
          { value: "test", label: "Test the Rules" },
        ]}
      />

      {tab === "documents" &&
        (rules.error ? <ErrorState message={rules.error} onRetry={() => rules.reload()} /> : !rules.data ? <TableSkeleton /> : <DocumentRulesTab rules={rules.data} canEdit={canEdit} onEdit={setEditing} />)}
      {tab === "inspection" && <InspectionTab />}
      {tab === "fields" && (
        <Section title="Required technical fields per vehicle type" description="From the vehicle field schema (Administration → Vehicle Configuration). Static configuration in Phase 1.">
          <VehicleFieldMatrix />
        </Section>
      )}
      {tab === "test" && (rules.error ? <ErrorState message={rules.error} onRetry={() => rules.reload()} /> : <TestRulesTab rules={rules.data} />)}

      {editing && canEdit && rules.data && (
        <DocumentRuleForm key={editing === "new" ? "new" : editing.id} rule={editing === "new" ? null : editing} allRules={rules.data} onDone={() => setEditing(null)} />
      )}
    </div>
  );
}
