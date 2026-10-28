"use client";

import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { FEE_COMPONENTS, FEE_RULE_SET_ID, REGISTRATION_PERIODS } from "@/config/fee-rules";
import { TRANSACTION_TYPES, transactionLabel } from "@/config/transaction-types";
import { SPEC_FIELDS, formatSpecValue, specLabel } from "@/config/vehicle-fields";
import { VEHICLE_GROUPS, vehicleTypeLabel } from "@/config/vehicle-types";
import { vehicleUsageLabel } from "@/config/vehicle-usage";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { formatDate, formatMoney } from "@/lib/formatting";
import { assessmentService } from "@/services/assessment.service";
import type { FeeBand, FeeComponent, FeeMetric, FeeRule } from "@/types";
import { DescriptionList, KpiCard, PageHeader, Section, Tabs } from "@/components/ui/layout-bits";
import { Field, Input, Textarea, Toggle } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { ActiveBadge, FormFooter } from "@/components/admin/admin-bits";
import { ChipList, ConfigTable, ReadOnlyBanner } from "@/components/admin/config-bits";

/* ───────────── categories ───────────── */

type CategoryKey = FeeComponent | "renewal";

const CATEGORIES: { key: CategoryKey; label: string; description: string; match: (r: FeeRule) => boolean }[] = [
  { key: "registration", label: "Registration Fees", description: "One registration line per transaction — the most specific matching active rule wins.", match: (r) => r.component === "registration" },
  { key: "renewal", label: "Renewal Fees", description: "Registration rules that also apply to renewals. Late renewal penalties are under Penalties.", match: (r) => r.component === "registration" && r.transactionTypes.includes("renewal") },
  { key: "inspection", label: "Inspection Fees", description: "Charged only when the transaction requires an inspection.", match: (r) => r.component === "inspection" },
  { key: "transfer", label: "Transfer Fees", description: "Transfer of ownership charges.", match: (r) => r.component === "transfer" },
  { key: "plate", label: "Plate Fees", description: "Charged when the transaction issues a new or replacement plate.", match: (r) => r.component === "plate" },
  { key: "penalty", label: "Penalties", description: "Applied automatically when the registration is past expiry.", match: (r) => r.component === "penalty" },
  { key: "service", label: "Processing / Service Fees", description: "Administrative processing charge.", match: (r) => r.component === "service" },
  { key: "other", label: "Other Charges", description: "Certificates, administration and optional charges officers can add.", match: (r) => r.component === "other" },
];

const TOTAL_TXN = TRANSACTION_TYPES.length;

/* ───────────── formatting helpers ───────────── */

function metricLabel(metric?: FeeMetric): string {
  if (!metric) return "";
  return metric === "monthsOverdue" ? "Months overdue" : specLabel(metric);
}

function bandRange(b: FeeBand, metric?: FeeMetric): string {
  const fmt = (n: number) => n.toLocaleString("en-US");
  const unit = metric === "monthsOverdue" ? "mo" : metric ? SPEC_FIELDS[metric]?.unit ?? "" : "";
  const range = b.max === undefined ? `${fmt(b.min)}+` : b.min === b.max ? fmt(b.min) : `${fmt(b.min)}–${fmt(b.max)}`;
  return unit ? `${range} ${unit}` : range;
}

function basisLabel(r: FeeRule): string {
  if (r.basis === "banded") return `Banded · ${metricLabel(r.metric)}`;
  if (r.basis === "per_unit") return `Per unit · ${metricLabel(r.metric)}`;
  return "Flat";
}

function appliesTo(r: FeeRule): { label: string; items: string[] }[] {
  const out: { label: string; items: string[] }[] = [];
  out.push({ label: "Transactions", items: r.transactionTypes.length >= TOTAL_TXN ? ["All transactions"] : r.transactionTypes.map((t) => transactionLabel(t, true)) });
  if (r.vehicleGroups?.length) out.push({ label: "Groups", items: r.vehicleGroups.map((g) => VEHICLE_GROUPS.find((x) => x.key === g)?.label ?? g) });
  if (r.vehicleTypes?.length) out.push({ label: "Types", items: r.vehicleTypes.map((t) => vehicleTypeLabel(t)) });
  if (r.usages?.length) out.push({ label: "Use", items: r.usages.map((u) => vehicleUsageLabel(u)) });
  const cond: string[] = [];
  if (r.requiresNewPlate) cond.push("New plate issued");
  if (r.requiresInspection) cond.push("Inspection required");
  if (r.appliesWhenOverdue) cond.push("Registration overdue");
  if (r.specEquals) for (const [k, v] of Object.entries(r.specEquals)) cond.push(`${specLabel(k)}: ${formatSpecValue(k, v)}`);
  if (r.optional) cond.push("Added by officer");
  if (cond.length) out.push({ label: "When", items: cond });
  if (!r.vehicleGroups?.length && !r.vehicleTypes?.length && !r.usages?.length) out.push({ label: "Vehicles", items: ["All vehicles"] });
  return out;
}

function AmountCell({ rule }: { rule: FeeRule }) {
  if (rule.basis === "banded" && rule.bands?.length) {
    return (
      <table className="w-full min-w-[180px] text-[12.5px]">
        <caption className="sr">Fee bands by {metricLabel(rule.metric)}</caption>
        <tbody>
          {rule.bands.map((b, i) => (
            <tr key={i}>
              <th scope="row" className="mut py-0.5 pr-3 text-left font-normal whitespace-nowrap">{bandRange(b, rule.metric)}</th>
              <td className="num py-0.5 font-semibold whitespace-nowrap">{formatMoney(b.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <span className="font-bold whitespace-nowrap">
      {formatMoney(rule.amount)}
      {rule.basis === "per_unit" && <span className="mut block text-[12px] font-normal">per {metricLabel(rule.metric).toLowerCase()}</span>}
    </span>
  );
}

function RuleBadges({ rule }: { rule: FeeRule }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {rule.sample && <Badge tone="soon">Sample</Badge>}
      {rule.optional && <Badge tone="assess">Optional</Badge>}
    </span>
  );
}

function AppliesTo({ rule }: { rule: FeeRule }) {
  return (
    <dl className="m-0 flex flex-col gap-1.5">
      {appliesTo(rule).map((g) => (
        <div key={g.label} className="flex flex-wrap items-start gap-1.5">
          <dt className="mut w-[78px] flex-none pt-0.5 text-[11.5px] font-semibold uppercase tracking-wide">{g.label}</dt>
          <dd className="m-0 min-w-0 flex-1"><ChipList items={g.items} /></dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────── edit ───────────── */

const money = z
  .number({ invalid_type_error: "Enter an amount in kina" })
  .min(0, "The amount cannot be negative")
  .max(1_000_000, "Enter an amount below K 1,000,000")
  .multipleOf(0.01, "Use at most two decimal places");

const schema = z.object({
  name: z.string().trim().min(3, "Enter the fee name"),
  amount: money,
  bands: z.array(z.object({ amount: money })),
  effectiveDate: z.string().min(1, "Select the effective date"),
  active: z.boolean(),
  notes: z.string().trim().max(500, "Keep notes under 500 characters"),
});
type FormValues = z.infer<typeof schema>;

function KinaInput({ id, invalid, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] font-semibold text-[#5a606c]" aria-hidden="true">K</span>
      <Input id={id} type="number" inputMode="decimal" step="0.01" min="0" className="num !pl-8 !text-left" invalid={invalid} {...rest} />
    </div>
  );
}

function FeeRuleForm({ rule, onDone }: { rule: FeeRule; onDone: () => void }) {
  const banded = rule.basis === "banded" && !!rule.bands?.length;
  const save = useAction(
    (v: FormValues) =>
      assessmentService.updateFeeRule(rule.id, {
        name: v.name,
        effectiveDate: v.effectiveDate,
        active: v.active,
        notes: v.notes || undefined,
        ...(banded ? { bands: (rule.bands ?? []).map((b, i) => ({ ...b, amount: v.bands[i]?.amount ?? b.amount })) } : { amount: v.amount }),
      }),
    { success: (r) => `${r.code} saved` },
  );
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: rule.name,
      amount: rule.amount,
      bands: (rule.bands ?? []).map((b) => ({ amount: b.amount })),
      effectiveDate: rule.effectiveDate.slice(0, 10),
      active: rule.active,
      notes: rule.notes ?? "",
    },
  });
  const amount = watch("amount");

  return (
    <Modal
      open
      size="lg"
      onClose={() => !save.busy && onDone()}
      title="Edit fee rule"
      description={<span className="inline-flex flex-wrap items-center gap-2"><span className="mono">{rule.code}</span><RuleBadges rule={rule} /></span>}
      footer={<FormFooter formId="fee-rule-form" busy={save.busy} onCancel={onDone} submitLabel="Save fee rule" />}
    >
      <form id="fee-rule-form" className="form" onSubmit={handleSubmit(async (v) => { if (await save.run(v)) onDone(); })} noValidate>
        {rule.sample && (
          <Alert tone="warn" title="Sample amount" className="full">
            <p>This rule carries an illustrative amount, not the official PNG RTA fee. The Sample label stays until the official schedule is loaded.</p>
          </Alert>
        )}
        <Field label="Fee name" required htmlFor="fr-name" error={errors.name?.message} className="full"><Input id="fr-name" invalid={!!errors.name} {...register("name")} /></Field>

        {banded ? (
          <fieldset className="full m-0 min-w-0 border-0 p-0">
            <legend className="lbl">Band amounts (PGK) by {metricLabel(rule.metric).toLowerCase()}</legend>
            <div className="flex flex-col gap-2.5">
              {(rule.bands ?? []).map((b, i) => (
                <div key={i} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[1fr_200px] sm:items-center">
                  <label htmlFor={`fr-band-${i}`} className="text-[13.5px] font-semibold">Band {i + 1}: {bandRange(b, rule.metric)}</label>
                  <div>
                    <KinaInput id={`fr-band-${i}`} invalid={!!errors.bands?.[i]?.amount} aria-describedby={errors.bands?.[i]?.amount ? `fr-band-${i}-err` : undefined} {...register(`bands.${i}.amount`, { valueAsNumber: true })} />
                    {errors.bands?.[i]?.amount && <p id={`fr-band-${i}-err`} className="err" role="alert">{errors.bands[i]?.amount?.message}</p>}
                  </div>
                </div>
              ))}
            </div>
            <p className="help">Band limits are fixed in Phase 1; only the amounts can change.</p>
          </fieldset>
        ) : (
          <Field
            label={rule.basis === "per_unit" ? `Amount per ${metricLabel(rule.metric).toLowerCase()} (PGK)` : "Amount (PGK)"}
            required
            htmlFor="fr-amount"
            error={errors.amount?.message}
            help={Number.isFinite(amount) && amount !== rule.amount ? `Changes ${formatMoney(rule.amount)} to ${formatMoney(amount)}` : `Current: ${formatMoney(rule.amount)}`}
          >
            <KinaInput id="fr-amount" invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} />
          </Field>
        )}

        <Field label="Effective date" required htmlFor="fr-date" error={errors.effectiveDate?.message}><Input id="fr-date" type="date" invalid={!!errors.effectiveDate} {...register("effectiveDate")} /></Field>
        <div className="full">
          <Controller control={control} name="active" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Active" description="Inactive rules are ignored by new assessments." />} />
        </div>
        <Field label="Notes" htmlFor="fr-notes" error={errors.notes?.message} className="full" help="Source of the amount, approvals or gazette reference."><Textarea id="fr-notes" rows={2} invalid={!!errors.notes} {...register("notes")} /></Field>
        <div className="full rounded-lg bg-[#f7f8fa] p-3.5">
          <DescriptionList
            items={[
              ["Component", FEE_COMPONENTS.find((c) => c.key === rule.component)?.label ?? rule.component],
              ["Basis", basisLabel(rule)],
              ["Applies to", <AppliesTo key="a" rule={rule} />],
              ["Currency", "PGK (Papua New Guinean Kina)"],
            ]}
          />
        </div>
      </form>
    </Modal>
  );
}

/* ───────────── list ───────────── */

function RuleTable({ rules, canEdit, onEdit, caption }: { rules: FeeRule[]; canEdit: boolean; onEdit: (r: FeeRule) => void; caption: string }) {
  return (
    <>
      <div className="hidden md:block">
        <ConfigTable
          caption={caption}
          minWidth={1040}
          head={
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Fee</th>
              <th scope="col">Applies to</th>
              <th scope="col">Basis</th>
              <th scope="col" className="num">Amount</th>
              <th scope="col">Effective</th>
              <th scope="col">Status</th>
              {canEdit && <th scope="col"><span className="sr">Actions</span></th>}
            </tr>
          }
        >
          {rules.map((r) => (
            <tr key={r.id} className={r.active ? "" : "opacity-70"}>
              <td className="mono font-semibold whitespace-nowrap">{r.code}</td>
              <td className="min-w-[200px]">
                <span className="block font-semibold">{r.name}</span>
                <span className="mt-1 block"><RuleBadges rule={r} /></span>
                {r.notes && <span className="mut mt-1 block text-[12px]">{r.notes}</span>}
              </td>
              <td className="min-w-[260px]"><AppliesTo rule={r} /></td>
              <td className="whitespace-nowrap">{basisLabel(r)}</td>
              <td className="num">{<AmountCell rule={r} />}</td>
              <td className="whitespace-nowrap">{formatDate(r.effectiveDate)}</td>
              <td><ActiveBadge active={r.active} /></td>
              {canEdit && (
                <td>
                  <button type="button" className="btn btn-s btn-sm" onClick={() => onEdit(r)} aria-label={`Edit ${r.code} ${r.name}`}><Pencil size={14} aria-hidden="true" />Edit</button>
                </td>
              )}
            </tr>
          ))}
        </ConfigTable>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 md:hidden">
        {rules.map((r) => (
          <li key={r.id} className="rounded-[10px] border border-[#e1e4ea] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-[12.5px] font-semibold">{r.code}</span>
              <ActiveBadge active={r.active} />
            </div>
            <p className="m-0 mt-1 text-[15px] font-bold">{r.name}</p>
            <div className="mt-1.5"><RuleBadges rule={r} /></div>
            <div className="mt-2.5"><AppliesTo rule={r} /></div>
            <div className="mt-2.5 flex items-start justify-between gap-3 border-t border-[#edeff3] pt-2.5">
              <div className="min-w-0 text-[13px]">
                <span className="mut block">{basisLabel(r)} · from {formatDate(r.effectiveDate)}</span>
                <AmountCell rule={r} />
              </div>
              {canEdit && <button type="button" className="btn btn-s flex-none" onClick={() => onEdit(r)} aria-label={`Edit ${r.code} ${r.name}`}><Pencil size={14} aria-hidden="true" />Edit</button>}
            </div>
            {r.notes && <p className="mut m-0 mt-2 text-[12px]">{r.notes}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function FeesPage() {
  const { can } = useDemoUser();
  const canEdit = can("fees.manage");
  const rules = useServiceQuery(() => assessmentService.listFeeRules(), []);
  const [tab, setTab] = useState<"all" | CategoryKey>("all");
  const [editing, setEditing] = useState<FeeRule | null>(null);

  const all = useMemo(() => rules.data ?? [], [rules.data]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.key, all.filter(c.match).length])) as Record<CategoryKey, number>, [all]);

  if (rules.error) return <ErrorState message={rules.error} onRetry={() => rules.reload()} />;
  if (!rules.data) return <PageSkeleton />;

  const shown = tab === "all" ? CATEGORIES.filter((c) => c.key !== "renewal") : CATEGORIES.filter((c) => c.key === tab);
  const sampleCount = all.filter((r) => r.sample).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration · Configuration"
        title="Fees & Penalties"
        badge={<Badge tone="assess">Rule set {FEE_RULE_SET_ID}</Badge>}
        description="Configurable fee rules used by the assessment engine, in Papua New Guinean Kina (PGK). Rules match on transaction, vehicle group or type, use and specification."
      />

      <Alert tone="warn" title="Sample amounts are illustrative placeholders">
        <p>
          Rules marked <strong>Sample</strong> ({sampleCount} of {all.length}) carry illustrative amounts so assessments, receipts and reports can be tested end to end.
          They are <strong>not the official PNG RTA fee schedule</strong> and must be replaced with the gazetted schedule before go-live. Rules without the label keep amounts configured in the Phase 1 prototype.
        </p>
      </Alert>
      {canEdit ? (
        <Alert tone="info" title="Changes apply to new assessments immediately">
          <p>Assessments already generated keep their original amounts. Every change is recorded in the audit log.</p>
        </Alert>
      ) : (
        <ReadOnlyBanner what="the fee rules" />
      )}

      <div className="g4">
        <KpiCard label="Active rules" value={all.filter((r) => r.active).length} footer={`${all.length} rules in total`} />
        <KpiCard label="Sample rules" value={sampleCount} footer="Awaiting official amounts" />
        <KpiCard label="Optional charges" value={all.filter((r) => r.optional).length} footer="Added by the officer" />
        <KpiCard label="Banded rules" value={all.filter((r) => r.basis === "banded").length} footer="By cc, GVM, seats or months" />
      </div>

      <Tabs<"all" | CategoryKey>
        label="Fee categories"
        value={tab}
        onChange={setTab}
        tabs={[{ value: "all", label: "All rules", count: all.length }, ...CATEGORIES.map((c) => ({ value: c.key, label: c.label, count: counts[c.key] }))]}
      />

      {all.length === 0 ? (
        <EmptyState title="No fee rules configured" message="No fee rules were found. Restore the seed data from Settings to recreate them." />
      ) : (
        shown.map((c) => {
          const list = all.filter(c.match);
          return (
            <Section key={c.key} title={c.label} description={c.description} actions={<span className="mut text-[13px]">{list.length} rule{list.length === 1 ? "" : "s"}</span>}>
              {list.length ? <RuleTable rules={list} canEdit={canEdit} onEdit={setEditing} caption={`${c.label} rules`} /> : <p className="mut m-0 text-[13px]">No rules in this category.</p>}
            </Section>
          );
        })
      )}

      <Section title="Registration periods" description="Periods offered at assessment. The factor scales the registration fee line only.">
        <ConfigTable caption="Registration periods" minWidth={420} head={<tr><th scope="col">Period</th><th scope="col">Months</th><th scope="col" className="num">Registration fee factor</th></tr>}>
          {REGISTRATION_PERIODS.map((p) => (
            <tr key={p.months}>
              <td className="font-semibold">{p.label}</td>
              <td>{p.months}</td>
              <td className="num">
                × {p.factor.toFixed(2)} {p.factor !== 1 && <Badge tone="soon" className="ml-1.5">Sample</Badge>}
              </td>
            </tr>
          ))}
        </ConfigTable>
        <p className="help m-0">Period factors are sample configuration (code: <span className="mono">REGISTRATION_PERIODS</span>) — editable once the fee tables are connected in Phase 2.</p>
      </Section>

      {editing && canEdit && <FeeRuleForm key={editing.id} rule={editing} onDone={() => setEditing(null)} />}
    </div>
  );
}
