"use client";

import { useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bell, CreditCard, Database, Eraser, FileX, RotateCcw, Save, ScrollText, Trash2, Undo2 } from "lucide-react";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { formatDateTime } from "@/lib/formatting";
import { settingsService } from "@/services/settings.service";
import { demoService } from "@/services/demo.service";
import type { AppSettings, Office } from "@/types";
import { PageHeader, Section } from "@/components/ui/layout-bits";
import { Field, Input, Select, Toggle } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";

const schema = z.object({
  general: z.object({
    systemName: z.string().trim().min(3, "Enter the system name"),
    defaultOfficeId: z.string().min(1, "Select the default office"),
    currency: z.literal("PGK"),
    registrationPrefix: z.string().trim().min(2, "Enter a prefix").max(16, "Use 16 characters or fewer").regex(/^[A-Z0-9-]+$/, "Use capital letters, numbers and hyphens only"),
  }),
  registration: z.object({
    validityMonths: z.number({ invalid_type_error: "Enter the number of months" }).int("Use whole months").min(1, "At least 1 month").max(60, "At most 60 months"),
    requirePlateBeforeCompletion: z.boolean(),
    requireInsuranceVerification: z.boolean(),
    requireInspection: z.boolean(),
  }),
  payments: z.object({ allowCash: z.boolean(), allowPos: z.boolean(), allowOnline: z.boolean(), allowBankTransfer: z.boolean() }),
  demo: z.object({ enableDemoTools: z.boolean(), enableNetworkSimulator: z.boolean(), enableMockPos: z.boolean() }),
}).refine((s) => s.payments.allowCash || s.payments.allowPos || s.payments.allowOnline || s.payments.allowBankTransfer, { message: "Allow at least one payment method.", path: ["payments", "allowCash"] });
type FormValues = z.infer<typeof schema>;

type ToggleName =
  | `registration.${"requirePlateBeforeCompletion" | "requireInsuranceVerification" | "requireInspection"}`
  | `payments.${keyof AppSettings["payments"]}`
  | `demo.${keyof AppSettings["demo"]}`;

function ToggleField({ control, name, label, description }: { control: Control<FormValues>; name: ToggleName; label: string; description?: string }) {
  return <Controller control={control} name={name} render={({ field }) => <Toggle checked={!!field.value} onChange={field.onChange} label={label} description={description} />} />;
}

function SettingsForm({ settings, offices }: { settings: AppSettings; offices: Office[] }) {
  const save = useAction((v: AppSettings) => settingsService.update(v), { success: "Settings saved" });
  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: settings });
  const onSubmit = async (v: FormValues) => {
    const r = await save.run({ ...settings, ...v });
    if (r) reset(r);
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <Section title="General">
        <div className="form">
          <Field label="System name" required htmlFor="s-name" error={errors.general?.systemName?.message} className="full"><Input id="s-name" invalid={!!errors.general?.systemName} {...register("general.systemName")} /></Field>
          <Field label="Default office" required htmlFor="s-office" error={errors.general?.defaultOfficeId?.message}><Select id="s-office" placeholder="Select office" options={offices.map((o) => ({ value: o.id, label: o.name }))} invalid={!!errors.general?.defaultOfficeId} {...register("general.defaultOfficeId")} /></Field>
          <Field label="Currency" htmlFor="s-cur" help="Papua New Guinean Kina. Fixed for Phase 1."><Input id="s-cur" readOnly mono {...register("general.currency")} /></Field>
          <Field label="Registration prefix" required htmlFor="s-prefix" error={errors.general?.registrationPrefix?.message} help="Used at the start of transaction numbers, e.g. RTA-MC."><Input id="s-prefix" mono invalid={!!errors.general?.registrationPrefix} {...register("general.registrationPrefix", { setValueAs: (v: string) => v.toUpperCase() })} /></Field>
        </div>
      </Section>

      <div className="g2">
        <Section title="Registration">
          <Field label="Default validity period (months)" required htmlFor="s-valid" error={errors.registration?.validityMonths?.message}>
            <Input id="s-valid" type="number" inputMode="numeric" min={1} max={60} invalid={!!errors.registration?.validityMonths} {...register("registration.validityMonths", { valueAsNumber: true })} />
          </Field>
          <div className="mt-2 flex flex-col divide-y divide-[#edeff3]">
            <ToggleField control={control} name="registration.requirePlateBeforeCompletion" label="Require plate before completion" description="A registration is only marked Registered once a plate is assigned." />
            <ToggleField control={control} name="registration.requireInsuranceVerification" label="Require insurance verification" description="Third-party insurance must be verified before assessment." />
            <ToggleField control={control} name="registration.requireInspection" label="Require inspection" description="A passed roadworthiness inspection is required before assessment." />
          </div>
        </Section>
        <Section title="Payments" description="Payment methods offered to cashiers.">
          <div className="flex flex-col divide-y divide-[#edeff3]">
            <ToggleField control={control} name="payments.allowCash" label="Allow cash" />
            <ToggleField control={control} name="payments.allowPos" label="Allow POS card" />
            <ToggleField control={control} name="payments.allowOnline" label="Allow online payment" />
            <ToggleField control={control} name="payments.allowBankTransfer" label="Allow bank transfer" />
          </div>
          {errors.payments?.allowCash?.message && <p className="err" role="alert">{errors.payments.allowCash.message}</p>}
        </Section>
      </div>

      <Section title="Demo settings" description="UAT helpers. Disable these before a production-like demonstration.">
        <div className="flex flex-col divide-y divide-[#edeff3]">
          <ToggleField control={control} name="demo.enableDemoTools" label="Enable demo tools" description="Shows the Demo Tools panel for loading scenarios and arming errors." />
          <ToggleField control={control} name="demo.enableNetworkSimulator" label="Enable network simulator" description="Lets testers switch between online, weak and offline connections." />
          <ToggleField control={control} name="demo.enableMockPos" label="Enable mock POS" description="Uses the simulated Wiseasy terminal instead of real hardware." />
        </div>
      </Section>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="mut m-0 text-[13px]">{isDirty ? "You have unsaved changes." : settings.updatedAt ? `Last saved ${formatDateTime(settings.updatedAt)}` : "Using default settings."}</p>
        <div className="row gap-2">
          {isDirty && <button type="button" className="btn btn-g" onClick={() => reset(settings)} disabled={save.busy}><Undo2 size={16} aria-hidden="true" />Discard</button>}
          <button type="submit" className="btn btn-p" disabled={save.busy || !isDirty}>
            {save.busy ? <span className="spin" aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
            Save settings
          </button>
        </div>
      </div>
    </form>
  );
}

type DemoKey = "restore" | "drafts" | "payments" | "plates" | "terminals" | "notifications" | "audit" | "all";

const DEMO_ACTIONS: { key: DemoKey; label: string; description: string; confirm: string; icon: typeof Database; danger?: boolean; run: () => string }[] = [
  { key: "restore", label: "Restore Original Seed Data", description: "Replaces every record with the original UAT data set.", confirm: "All owners, motorcycles, applications, payments and plates will be replaced with the original seed data. Changes made during testing will be lost.", icon: RotateCcw, run: () => { demoService.restoreSeed(); return "Original seed data restored"; } },
  { key: "drafts", label: "Clear Drafts", description: "Deletes all Draft registration applications.", confirm: "All Draft registration applications will be removed.", icon: FileX, run: () => { const n = demoService.clearDrafts(); return `${n} draft${n === 1 ? "" : "s"} cleared`; } },
  { key: "payments", label: "Reset Payments", description: "Removes payments taken during testing.", confirm: "Payments created during testing will be removed and unapproved applications returned to Payment Required.", icon: CreditCard, run: () => { const n = demoService.resetPayments(); return `${n} demo payment${n === 1 ? "" : "s"} removed`; } },
  { key: "plates", label: "Reset Plate Inventory", description: "Restores the seed plate stock.", confirm: "Plate inventory will be restored to the seed stock. Plates held by registered motorcycles stay assigned.", icon: Database, run: () => { demoService.resetPlates(); return "Plate inventory reset"; } },
  { key: "terminals", label: "Reset POS Terminals", description: "Restores seed terminals and the mock POS state.", confirm: "POS terminals and the mock terminal simulator will be restored to their defaults.", icon: CreditCard, run: () => { demoService.resetTerminals(); return "POS terminals reset"; } },
  { key: "notifications", label: "Clear Notifications", description: "Removes all in-app notifications.", confirm: "All notifications will be removed for every user.", icon: Bell, run: () => { demoService.clearNotifications(); return "Notifications cleared"; } },
  { key: "audit", label: "Clear Audit Logs", description: "Deletes the audit trail.", confirm: "The entire audit log will be deleted. Only a record of this reset will remain.", icon: ScrollText, danger: true, run: () => { demoService.clearAudit(); return "Audit log cleared"; } },
  { key: "all", label: "Clear All Local Data", description: "Wipes everything in this browser and signs you out.", confirm: "All demo data stored in this browser will be deleted and you will be signed out. The seed data is recreated on next sign-in.", icon: Trash2, danger: true, run: () => { demoService.clearAll(); window.location.href = "/login"; return "All local data cleared"; } },
];

function DemoDataCard() {
  const [pending, setPending] = useState<(typeof DEMO_ACTIONS)[number] | null>(null);
  const act = useAction(async (a: (typeof DEMO_ACTIONS)[number]) => a.run(), { success: (msg) => msg });
  return (
    <Section title="Demo data" description="Reset parts of the mock database stored in this browser. Each action asks for confirmation.">
      <Alert tone="warn" title="These actions cannot be undone">They only affect data in this browser. Other testers are not affected.</Alert>
      <ul className="m-0 mt-4 grid list-none gap-2.5 p-0 sm:grid-cols-2">
        {DEMO_ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <li key={a.key} className="flex items-center justify-between gap-3 rounded-lg border border-[#e1e4ea] p-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className={`ic h-9 w-9 ${a.danger ? "bg-[#fce4e5] text-[#a3111a]" : "bg-[#eef0f4] text-[#3a3f4a]"}`} aria-hidden="true"><Icon size={18} /></span>
                <div className="min-w-0">
                  <p className="m-0 text-[14px] font-semibold">{a.label}</p>
                  <p className="mut m-0 mt-0.5 text-[12.5px]">{a.description}</p>
                </div>
              </div>
              <button type="button" className={`btn btn-sm min-h-[44px] flex-none ${a.danger ? "btn-do" : "btn-s"}`} onClick={() => setPending(a)}>
                {a.key === "all" ? <Eraser size={14} aria-hidden="true" /> : null}
                {a.key === "all" ? "Clear" : "Run"}<span className="sr"> {a.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        busy={act.busy}
        tone={pending?.danger ? "danger" : "primary"}
        title={`${pending?.label ?? ""}?`}
        confirmLabel={pending?.label ?? "Confirm"}
        message={pending?.confirm}
        onConfirm={async () => {
          if (pending && (await act.run(pending))) setPending(null);
        }}
      />
    </Section>
  );
}

export default function SettingsPage() {
  const settings = useServiceQuery(() => settingsService.get(), []);
  const offices = useServiceQuery(() => settingsService.listOffices(), []);

  if (settings.error || offices.error) return <ErrorState message={settings.error ?? offices.error ?? ""} onRetry={() => { settings.reload(); offices.reload(); }} />;
  if (!settings.data || !offices.data) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration" title="Settings" description="System-wide configuration for registration, payments and demo behaviour." />
      <SettingsForm key={settings.data.updatedAt ?? "default"} settings={settings.data} offices={offices.data} />
      <DemoDataCard />
    </div>
  );
}
