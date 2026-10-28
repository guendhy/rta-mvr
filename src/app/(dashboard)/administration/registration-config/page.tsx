"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Undo2 } from "lucide-react";
import { REGISTRATION_PERIODS } from "@/config/fee-rules";
import { REGISTRATION_STATUS, VEHICLE_STATUS, type StatusDef } from "@/config/statuses";
import { TRANSACTION_BUCKETS, TRANSACTION_TYPES } from "@/config/transaction-types";
import { PLATE_CATEGORIES, VEHICLE_USAGES } from "@/config/vehicle-usage";
import { VEHICLE_TYPES } from "@/config/vehicle-types";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { formatDateTime } from "@/lib/formatting";
import { settingsService } from "@/services/settings.service";
import type { AppSettings } from "@/types";
import { PageHeader, Section, Tabs } from "@/components/ui/layout-bits";
import { Field, Input } from "@/components/ui/form";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { ChipList, ConfigTable, LockedHint, ReadOnlyBanner, StaticConfigNotice, YesNo } from "@/components/admin/config-bits";

type TabKey = "transactions" | "validity" | "statuses" | "plates";

const INSPECTION_MODE = { always: { label: "Always", tone: "pend" }, by_rule: { label: "By rule", tone: "assess" }, never: { label: "Never", tone: "draft" } } as const;

/* ───────────── validity ───────────── */

const schema = z.object({
  validityMonths: z.number({ invalid_type_error: "Enter the number of months" }).int("Use whole months").min(1, "At least 1 month").max(60, "At most 60 months"),
  expiringSoonDays: z.number({ invalid_type_error: "Enter the number of days" }).int("Use whole days").min(1, "At least 1 day").max(180, "At most 180 days"),
});
type FormValues = z.infer<typeof schema>;

function ValidityForm({ settings, canEdit }: { settings: AppSettings; canEdit: boolean }) {
  const save = useAction((v: FormValues) => settingsService.update({ ...settings, registration: { ...settings.registration, ...v } }), { success: "Registration validity saved" });
  const defaults = { validityMonths: settings.registration.validityMonths, expiringSoonDays: settings.registration.expiringSoonDays ?? 30 };
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(async (v) => {
        const r = await save.run(v);
        if (r) reset({ validityMonths: r.registration.validityMonths, expiringSoonDays: r.registration.expiringSoonDays });
      })}
      className="flex flex-col gap-4"
    >
      <fieldset disabled={!canEdit || save.busy} className="form m-0 min-w-0 border-0 p-0">
        <legend className="sr">Registration validity</legend>
        <Field label="Default validity period (months)" required htmlFor="rc-valid" error={errors.validityMonths?.message} help="Applied when a registration or renewal is completed. Set according to RTA policy.">
          <Input id="rc-valid" type="number" inputMode="numeric" min={1} max={60} invalid={!!errors.validityMonths} {...register("validityMonths", { valueAsNumber: true })} />
        </Field>
        <Field label="“Expiring Soon” window (days)" required htmlFor="rc-soon" error={errors.expiringSoonDays?.message} help="Active registrations this close to expiry show as Expiring Soon on the registry, dashboard and renewals.">
          <Input id="rc-soon" type="number" inputMode="numeric" min={1} max={180} invalid={!!errors.expiringSoonDays} {...register("expiringSoonDays", { valueAsNumber: true })} />
        </Field>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edeff3] pt-4">
        <p className="mut m-0 text-[13px]">{isDirty ? "You have unsaved changes." : settings.updatedAt ? `Last saved ${formatDateTime(settings.updatedAt)}` : "Using default settings."}</p>
        {canEdit ? (
          <div className="row gap-2">
            {isDirty && <button type="button" className="btn btn-g" onClick={() => reset(defaults)} disabled={save.busy}><Undo2 size={16} aria-hidden="true" />Discard</button>}
            <button type="submit" className="btn btn-p" disabled={save.busy || !isDirty}>
              {save.busy ? <span className="spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              Save validity
            </button>
          </div>
        ) : (
          <LockedHint />
        )}
      </div>
    </form>
  );
}

function ValidityTab({ canEdit }: { canEdit: boolean }) {
  const settings = useServiceQuery(() => settingsService.get(), []);
  return (
    <div className="g2">
      <Section title="Registration validity" description="Stored in system settings (also editable under Administration → Settings).">
        {settings.error ? (
          <ErrorState message={settings.error} onRetry={() => settings.reload()} />
        ) : !settings.data ? (
          <Skeleton className="h-40" />
        ) : (
          <ValidityForm key={settings.data.updatedAt ?? "default"} settings={settings.data} canEdit={canEdit} />
        )}
      </Section>
      <Section title="Registration periods at assessment" description="Periods the officer can choose when fees are assessed.">
        <ConfigTable caption="Registration periods" minWidth={320} head={<tr><th scope="col">Period</th><th scope="col" className="num">Fee factor</th></tr>}>
          {REGISTRATION_PERIODS.map((p) => (
            <tr key={p.months}>
              <td className="font-semibold">{p.label}</td>
              <td className="num">× {p.factor.toFixed(2)} {p.factor !== 1 && <Badge tone="soon" className="ml-1.5">Sample</Badge>}</td>
            </tr>
          ))}
        </ConfigTable>
        <p className="help m-0">Managed with the fee rules (Administration → Fees). Factors are sample values pending the official schedule.</p>
      </Section>
    </div>
  );
}

/* ───────────── transactions ───────────── */

function TransactionsTab() {
  return (
    <Section title="Transaction types" description="What each transaction does. Vehicle-specific rules (inspection, documents, fees) can add to these defaults.">
      <ConfigTable
        caption="Transaction types"
        minWidth={1100}
        head={
          <tr>
            <th scope="col">Transaction</th>
            <th scope="col">Existing vehicle</th>
            <th scope="col">Inspection</th>
            <th scope="col">Insurance</th>
            <th scope="col">Issues plate</th>
            <th scope="col">Renews period</th>
            <th scope="col">Report bucket</th>
            <th scope="col">Steps</th>
          </tr>
        }
      >
        {TRANSACTION_TYPES.map((t) => (
          <tr key={t.key}>
            <td className="min-w-[220px]">
              <span className="block font-semibold">{t.label}</span>
              <span className="mut block text-[12.5px]">{t.description}</span>
              <span className="mono mut text-[11px]">{t.key}</span>
            </td>
            <td><YesNo value={t.needsExistingVehicle} yes="Required" no="New vehicle" /></td>
            <td><Badge tone={INSPECTION_MODE[t.inspection].tone}>{INSPECTION_MODE[t.inspection].label}</Badge></td>
            <td><YesNo value={t.insurance} yes="Required" no="No" /></td>
            <td><YesNo value={t.issuesPlate} /></td>
            <td><YesNo value={t.renewsPeriod} /></td>
            <td className="whitespace-nowrap">{TRANSACTION_BUCKETS.find((b) => b.key === t.bucket)?.label ?? t.bucket}</td>
            <td className="min-w-[220px]">
              <details>
                <summary className="cursor-pointer text-[13px] font-semibold text-[#1515e8]">{t.steps.length} steps</summary>
                <ol className="m-0 mt-1.5 pl-5 text-[12.5px]">
                  {t.steps.map((s) => <li key={s}>{s}</li>)}
                </ol>
              </details>
            </td>
          </tr>
        ))}
      </ConfigTable>
    </Section>
  );
}

/* ───────────── statuses ───────────── */

function StatusTable({ caption, map }: { caption: string; map: Record<string, StatusDef> }) {
  return (
    <ConfigTable caption={caption} minWidth={360} head={<tr><th scope="col">Status</th><th scope="col">Badge</th><th scope="col">Key</th></tr>}>
      {Object.entries(map).map(([key, s]) => (
        <tr key={key}>
          <td className="font-semibold">{s.label}</td>
          <td><Badge tone={s.tone}>{s.label}</Badge></td>
          <td className="mono text-[12px]">{key}</td>
        </tr>
      ))}
    </ConfigTable>
  );
}

function StatusesTab() {
  return (
    <div className="g2">
      <Section title="Application statuses" description="Workflow statuses of a transaction, labelled with the lifecycle names RTA staff use.">
        <StatusTable caption="Application statuses" map={REGISTRATION_STATUS} />
      </Section>
      <Section title="Vehicle registration statuses" description="Registry status of a vehicle. “Expiring Soon” is derived from the expiry date and the window set under Validity.">
        <StatusTable caption="Vehicle registration statuses" map={VEHICLE_STATUS} />
        <p className="help m-0">Every badge shows its text label as well as its colour.</p>
      </Section>
    </div>
  );
}

/* ───────────── plates ───────────── */

function PlatesTab() {
  return (
    <Section title="Plate categories" description="Plate series and the uses or vehicle types that select them.">
      <ConfigTable
        caption="Plate categories"
        minWidth={880}
        head={<tr><th scope="col">Category</th><th scope="col">Prefix</th><th scope="col">Example format</th><th scope="col">Selected by use</th><th scope="col">Default for vehicle types</th></tr>}
      >
        {PLATE_CATEGORIES.map((p) => (
          <tr key={p.value}>
            <td className="font-semibold whitespace-nowrap">{p.label}<span className="mono mut block text-[11px] font-normal">{p.value}</span></td>
            <td className="mono font-semibold">{p.prefix}</td>
            <td>
              <span className="mono inline-block rounded border-2 border-[#0b0b0f] bg-white px-2 py-0.5 text-[13px] font-bold whitespace-nowrap">{p.prefix} 1234</span>
              <span className="mut block text-[11.5px]">Illustrative</span>
            </td>
            <td><ChipList items={VEHICLE_USAGES.filter((u) => u.plateCategory === p.value).map((u) => u.label)} empty="—" /></td>
            <td><ChipList items={VEHICLE_TYPES.filter((t) => t.defaultPlateCategory === p.value).map((t) => t.label)} empty="—" /></td>
          </tr>
        ))}
      </ConfigTable>
      <p className="help m-0">Example formats are illustrative only — the official plate numbering format is set by the RTA. Two-wheelers and towed equipment keep their own series whatever the use.</p>
    </Section>
  );
}

export default function RegistrationConfigPage() {
  const { can } = useDemoUser();
  const canEdit = can("settings.manage");
  const [tab, setTab] = useState<TabKey>("transactions");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Administration · Configuration"
        title="Registration Configuration"
        description="Transaction types, registration validity, statuses and plate categories used across the registration workflow."
      />
      <StaticConfigNotice title="Mostly static configuration in Phase 1">
        <p>Transaction types, statuses and plate categories are read from configuration and become editable once the configuration tables are connected (Phase 2). Registration validity is a saved setting and can be changed now.</p>
      </StaticConfigNotice>
      {!canEdit && <ReadOnlyBanner what="the registration configuration" />}

      <Tabs<TabKey>
        label="Registration configuration sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "transactions", label: "Transaction Types", count: TRANSACTION_TYPES.length },
          { value: "validity", label: "Registration Validity" },
          { value: "statuses", label: "Statuses" },
          { value: "plates", label: "Plate Categories", count: PLATE_CATEGORIES.length },
        ]}
      />

      {tab === "transactions" && <TransactionsTab />}
      {tab === "validity" && <ValidityTab canEdit={canEdit} />}
      {tab === "statuses" && <StatusesTab />}
      {tab === "plates" && <PlatesTab />}
    </div>
  );
}
