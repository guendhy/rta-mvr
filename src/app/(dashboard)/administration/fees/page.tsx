"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { formatDate, formatMoney } from "@/lib/formatting";
import { assessmentService } from "@/services/assessment.service";
import type { Fee } from "@/types";
import { DescriptionList, PageHeader } from "@/components/ui/layout-bits";
import { Field, Input, Toggle } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Alert, ErrorState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/status-badge";
import { ActiveBadge, FormFooter } from "@/components/admin/admin-bits";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the fee name"),
  amount: z.number({ invalid_type_error: "Enter the amount in kina" }).min(0, "The amount cannot be negative").max(100000, "Enter an amount below K 100,000").multipleOf(0.01, "Use at most two decimal places"),
  effectiveDate: z.string().min(1, "Select the effective date"),
  active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

function FeeForm({ fee, onDone }: { fee: Fee; onDone: () => void }) {
  const save = useAction((v: FormValues) => assessmentService.updateFee(fee.id, v), { success: (f) => `${f.name} set to ${formatMoney(f.amount)}` });
  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: fee.name, amount: fee.amount, effectiveDate: fee.effectiveDate.slice(0, 10), active: fee.active },
  });
  const amount = watch("amount");
  return (
    <Modal open onClose={() => !save.busy && onDone()} title="Edit fee" description={<span className="mono">{fee.code}</span>} footer={<FormFooter formId="fee-form" busy={save.busy} onCancel={onDone} submitLabel="Save fee" />}>
      <form id="fee-form" className="form" onSubmit={handleSubmit(async (v) => { if (await save.run(v)) onDone(); })} noValidate>
        <Field label="Fee name" required htmlFor="f-name" error={errors.name?.message} className="full"><Input id="f-name" invalid={!!errors.name} {...register("name")} /></Field>
        <Field label="Amount (PGK)" required htmlFor="f-amount" error={errors.amount?.message} help={Number.isFinite(amount) && amount !== fee.amount ? `Changes ${formatMoney(fee.amount)} to ${formatMoney(amount)}` : `Current: ${formatMoney(fee.amount)}`}>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] font-semibold text-[#5a606c]" aria-hidden="true">K</span>
            <Input id="f-amount" type="number" inputMode="decimal" step="0.01" min="0" className="num !pl-8 !text-left" invalid={!!errors.amount} {...register("amount", { valueAsNumber: true })} />
          </div>
        </Field>
        <Field label="Effective date" required htmlFor="f-date" error={errors.effectiveDate?.message}><Input id="f-date" type="date" invalid={!!errors.effectiveDate} {...register("effectiveDate")} /></Field>
        <div className="full">
          <Controller control={control} name="active" render={({ field }) => <Toggle checked={field.value} onChange={field.onChange} label="Active" description="Inactive fees are not added to new assessments." />} />
        </div>
        <div className="full rounded-lg bg-[#f7f8fa] p-3.5">
          <DescriptionList items={[["Currency", "PGK (Papua New Guinean Kina)"], ["Optional fee", fee.optional ? "Yes — officers can add it to an assessment" : "No — applied automatically when applicable"]]} />
        </div>
      </form>
    </Modal>
  );
}

export default function FeesPage() {
  const fees = useServiceQuery(() => assessmentService.listFees(), []);
  const [editing, setEditing] = useState<Fee | null>(null);

  const columns: ColumnDef<Fee, unknown>[] = [
    { id: "code", header: "Fee Code", accessorFn: (f) => f.code, cell: ({ row }) => <span className="mono font-semibold">{row.original.code}</span> },
    { id: "name", header: "Fee Name", accessorFn: (f) => f.name },
    { id: "amount", header: "Amount", accessorFn: (f) => f.amount, meta: { align: "right" }, cell: ({ row }) => <span className="font-bold whitespace-nowrap">{formatMoney(row.original.amount)}</span> },
    { id: "currency", header: "Currency", accessorFn: (f) => f.currency },
    { id: "active", header: "Active", accessorFn: (f) => (f.active ? 1 : 0), cell: ({ row }) => <ActiveBadge active={row.original.active} /> },
    { id: "date", header: "Effective Date", accessorFn: (f) => f.effectiveDate, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.effectiveDate)}</span> },
    { id: "optional", header: "Optional", accessorFn: (f) => (f.optional ? 1 : 0), cell: ({ row }) => (row.original.optional ? <Badge tone="assess">Optional</Badge> : <span className="mut">Standard</span>) },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => <button type="button" className="btn btn-s btn-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.name}`}><Pencil size={14} aria-hidden="true" />Edit</button> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration" title="Fees" description="Registration and plate fees charged at assessment, in Papua New Guinean Kina (PGK)." />
      <Alert tone="info" title="Fee changes apply immediately">
        The Assessment screen uses the saved values straight away. For example, changing the registration fee from K 185.00 to K 190.00 means the next assessment generated will charge K 190.00. Assessments already generated keep their original amounts.
      </Alert>
      {fees.error ? (
        <ErrorState message={fees.error} onRetry={() => fees.reload()} />
      ) : (
        <DataTable
          storageKey="admin-fees"
          data={fees.data}
          loading={fees.loading}
          columns={columns}
          mobileCard={(f) => (
            <MobileCard
              title={f.code}
              badge={<ActiveBadge active={f.active} />}
              lines={[f.name, `Effective ${formatDate(f.effectiveDate)} · ${f.optional ? "Optional" : "Standard"}`]}
              footer={<><span className="text-[16px] font-extrabold">{formatMoney(f.amount)}</span><button type="button" className="btn btn-s" onClick={() => setEditing(f)}><Pencil size={14} aria-hidden="true" />Edit</button></>}
            />
          )}
          empty={{ title: "No fees configured", message: "No fee schedule was found. Restore the seed data from Settings to recreate it." }}
        />
      )}
      {editing && <FeeForm key={editing.id} fee={editing} onDone={() => setEditing(null)} />}
    </div>
  );
}
