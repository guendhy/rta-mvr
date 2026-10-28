"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackagePlus } from "lucide-react";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { PLATE_STATUS } from "@/lib/constants";
import { formatDate, motorcycleLabel } from "@/lib/formatting";
import { plateService } from "@/services/plate.service";
import { settingsService } from "@/services/settings.service";
import { motorcycleService } from "@/services/motorcycle.service";
import type { Motorcycle, Office, Plate, PlateStatus } from "@/types";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { FilterBar, FilterSelect, FormFooter, ResultCount, SearchField } from "@/components/admin/admin-bits";

const STATUS_KEYS = Object.keys(PLATE_STATUS) as PlateStatus[];
const CHANGE_TARGETS: PlateStatus[] = ["available", "damaged", "lost", "cancelled", "released"];
const VERB: Partial<Record<PlateStatus, string>> = { available: "Mark Available", damaged: "Mark Damaged", lost: "Mark Lost", cancelled: "Mark Cancelled", released: "Release" };

/** Statuses a plate may move to; the service only allows releasing an assigned plate. */
function targetsFor(p: Plate): PlateStatus[] {
  if (p.status === "assigned") return ["released"];
  return CHANGE_TARGETS.filter((s) => s !== p.status);
}

const receiveSchema = z
  .object({
    from: z.number({ invalid_type_error: "Enter the first plate number" }).int("Use whole numbers").min(1, "Enter the first plate number"),
    to: z.number({ invalid_type_error: "Enter the last plate number" }).int("Use whole numbers").min(1, "Enter the last plate number"),
    officeId: z.string().min(1, "Select the receiving office"),
    receivedDate: z.string().min(1, "Select the received date"),
  })
  .refine((v) => v.to >= v.from, { message: "The last number must be the same as or after the first.", path: ["to"] })
  .refine((v) => v.to - v.from < 500, { message: "Receive at most 500 plates at a time.", path: ["to"] });
type ReceiveValues = z.infer<typeof receiveSchema>;

function ReceiveModal({ offices, defaultOfficeId, onDone }: { offices: Office[]; defaultOfficeId?: string; onDone: () => void }) {
  const save = useAction((v: ReceiveValues) => plateService.receiveBatch(v), { success: (r) => `${r.length} plate${r.length === 1 ? "" : "s"} received into inventory` });
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ReceiveValues>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { from: undefined, to: undefined, officeId: defaultOfficeId ?? offices[0]?.id ?? "", receivedDate: new Date().toISOString().slice(0, 10) },
  });
  const [from, to] = watch(["from", "to"]);
  const count = Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from + 1 : 0;
  return (
    <Modal open onClose={() => !save.busy && onDone()} title="Receive plates" description="Record a batch of new motorcycle plates delivered to an office." footer={<FormFooter formId="receive-form" busy={save.busy} onCancel={onDone} submitLabel={count ? `Receive ${count} plate${count === 1 ? "" : "s"}` : "Receive plates"} />}>
      <form id="receive-form" className="form" onSubmit={handleSubmit(async (v) => { if (await save.run(v)) onDone(); })} noValidate>
        <Field label="From number" required htmlFor="r-from" error={errors.from?.message} help="Plate MC-number, digits only">
          <Input id="r-from" type="number" inputMode="numeric" min={1} mono invalid={!!errors.from} {...register("from", { valueAsNumber: true })} />
        </Field>
        <Field label="To number" required htmlFor="r-to" error={errors.to?.message}>
          <Input id="r-to" type="number" inputMode="numeric" min={1} mono invalid={!!errors.to} {...register("to", { valueAsNumber: true })} />
        </Field>
        <Field label="Office" required htmlFor="r-office" error={errors.officeId?.message}>
          <Select id="r-office" placeholder="Select office" options={offices.map((o) => ({ value: o.id, label: o.name }))} invalid={!!errors.officeId} {...register("officeId")} />
        </Field>
        <Field label="Received date" required htmlFor="r-date" error={errors.receivedDate?.message}>
          <Input id="r-date" type="date" invalid={!!errors.receivedDate} {...register("receivedDate")} />
        </Field>
        <p className="full m-0 rounded-lg bg-[#f7f8fa] p-3 text-[13.5px]" aria-live="polite">
          {count ? <>Creates <strong>{count}</strong> plate{count === 1 ? "" : "s"}: <span className="mono font-semibold">MC-{from}</span>{count > 1 && <> to <span className="mono font-semibold">MC-{to}</span></>}</> : "Enter the first and last plate numbers in the batch."}
        </p>
      </form>
    </Modal>
  );
}

export function PlateInventory() {
  const { can, office: myOffice } = useDemoUser();
  const manage = can("plates.manage");
  const plates = useServiceQuery(() => plateService.list(), []);
  const lookups = useServiceQuery(async () => {
    const [offices, motos] = await Promise.all([settingsService.listOffices(), motorcycleService.list()]);
    return { offices, motos: new Map<string, Motorcycle>(motos.map((m) => [m.id, m])) };
  }, []);
  const [status, setStatus] = useState("");
  const [office, setOffice] = useState("");
  const [q, setQ] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [change, setChange] = useState<{ plate: Plate; to: PlateStatus } | null>(null);
  const changeAction = useAction((c: { plate: Plate; to: PlateStatus }, note: string) => plateService.changeStatus(c.plate.id, c.to, note), { success: (p) => `Plate ${p.plateNumber} is now ${PLATE_STATUS[p.status].label}` });

  const officeName = (id: string) => lookups.data?.offices.find((o) => o.id === id)?.name ?? "—";
  const moto = (id?: string) => (id ? lookups.data?.motos.get(id) : undefined);

  const scoped = useMemo(() => (plates.data ?? []).filter((p) => !office || p.officeId === office), [plates.data, office]);
  const counts = useMemo(() => Object.fromEntries(STATUS_KEYS.map((s) => [s, scoped.filter((p) => p.status === s).length])) as Record<PlateStatus, number>, [scoped]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const motos = lookups.data?.motos;
    return scoped.filter((p) => (!status || p.status === status) && (!term || `${p.plateNumber} ${motorcycleLabel(p.motorcycleId ? motos?.get(p.motorcycleId) : undefined)} ${p.notes ?? ""}`.toLowerCase().includes(term)));
  }, [scoped, status, q, lookups.data]);

  const statusAction = (p: Plate, mobile = false) => {
    if (!manage) return null;
    const targets = targetsFor(p);
    return (
      <select
        className={`inp text-[13px] ${mobile ? "" : "!h-9 !w-auto"}`}
        value=""
        aria-label={`Change status of plate ${p.plateNumber}`}
        onChange={(e) => e.target.value && setChange({ plate: p, to: e.target.value as PlateStatus })}
      >
        <option value="">Change status…</option>
        {targets.map((t) => <option key={t} value={t}>{VERB[t]}</option>)}
      </select>
    );
  };

  const vehicleCell = (p: Plate) => {
    const m = moto(p.motorcycleId);
    if (!p.motorcycleId) return <span className="mut">—</span>;
    return <Link href={`/registry/${p.motorcycleId}`} className="font-semibold">{m ? motorcycleLabel(m) : "View motorcycle"}</Link>;
  };

  const columns: ColumnDef<Plate, unknown>[] = [
    { id: "plate", header: "Plate Number", accessorFn: (p) => p.plateNumber, sortingFn: "alphanumeric", cell: ({ row }) => <span className="mono font-bold">{row.original.plateNumber}</span> },
    { id: "type", header: "Type", accessorFn: (p) => p.type },
    { id: "office", header: "Office", accessorFn: (p) => officeName(p.officeId) },
    { id: "status", header: "Status", accessorFn: (p) => p.status, cell: ({ row }) => <StatusBadge kind="plate" status={row.original.status} /> },
    { id: "vehicle", header: "Vehicle", accessorFn: (p) => motorcycleLabel(moto(p.motorcycleId)), cell: ({ row }) => vehicleCell(row.original) },
    { id: "received", header: "Received Date", accessorFn: (p) => p.receivedDate, cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.receivedDate)}</span> },
    { id: "assigned", header: "Assigned Date", accessorFn: (p) => p.assignedDate ?? "", cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.assignedDate)}</span> },
    ...(manage ? [{ id: "action", header: "Action", enableSorting: false, cell: ({ row }) => statusAction(row.original) } as ColumnDef<Plate, unknown>] : []),
  ];

  if (plates.error || lookups.error) return <ErrorState message={plates.error ?? lookups.error ?? ""} onRetry={() => { plates.reload(); lookups.reload(); }} />;

  return (
    <div className="flex flex-col gap-5">
      {plates.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" role="group" aria-label="Filter by plate status">
          {STATUS_KEYS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(status === s ? "" : s)}
              className={`card tile text-left transition-shadow hover:shadow-md ${status === s ? "!border-2 !border-[#1515e8] bg-[#f5f5ff]" : ""}`}
            >
              <StatusBadge kind="plate" status={s} className="self-start" />
              <span className="kpi text-[26px]">{counts[s]}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">{STATUS_KEYS.map((s) => <Skeleton key={s} className="h-[92px] rounded-xl" />)}</div>
      )}

      <FilterBar>
        <SearchField id="plate-q" value={q} onChange={setQ} placeholder="Plate number or motorcycle" />
        <FilterSelect id="plate-status" label="Status" value={status} onChange={setStatus} options={STATUS_KEYS.map((s) => ({ value: s, label: PLATE_STATUS[s].label }))} all="All statuses" />
        <FilterSelect id="plate-office" label="Office" value={office} onChange={setOffice} options={(lookups.data?.offices ?? []).map((o) => ({ value: o.id, label: o.name }))} all="All offices" />
        {manage && <div className="!flex-none"><button type="button" className="btn btn-p w-full" onClick={() => setReceiving(true)} disabled={!lookups.data}><PackagePlus size={18} aria-hidden="true" />Receive plates</button></div>}
      </FilterBar>

      {plates.data && <ResultCount shown={rows.length} total={plates.data.length} noun="plates" />}
      <DataTable
        storageKey="plates-inventory"
        data={plates.data && lookups.data ? rows : undefined}
        loading={plates.loading || lookups.loading}
        columns={columns}
        initialSort={[{ id: "plate", desc: false }]}
        mobileCard={(p) => (
          <MobileCard
            title={p.plateNumber}
            badge={<StatusBadge kind="plate" status={p.status} />}
            lines={[officeName(p.officeId), p.motorcycleId ? vehicleCell(p) : "Not assigned to a motorcycle", `Received ${formatDate(p.receivedDate)}${p.assignedDate ? ` · Assigned ${formatDate(p.assignedDate)}` : ""}`]}
            footer={manage ? <div className="w-full">{statusAction(p, true)}</div> : undefined}
          />
        )}
        empty={{ title: "No plates found", message: q || status || office ? "No plates match the current filters." : "No motorcycle plates are in inventory yet.", action: manage ? { label: "Receive plates", onClick: () => setReceiving(true) } : undefined }}
      />

      {receiving && lookups.data && <ReceiveModal offices={lookups.data.offices} defaultOfficeId={office || myOffice?.id} onDone={() => setReceiving(false)} />}

      <ConfirmDialog
        open={!!change}
        onClose={() => setChange(null)}
        busy={changeAction.busy}
        requireReason
        reasonLabel="Note"
        tone={change && ["lost", "damaged", "cancelled"].includes(change.to) ? "danger" : "primary"}
        title={change ? `${VERB[change.to]}: ${change.plate.plateNumber}` : ""}
        confirmLabel={change ? VERB[change.to] : "Confirm"}
        message={change ? (
          <>
            Plate <span className="mono font-semibold">{change.plate.plateNumber}</span> will change from <StatusBadge kind="plate" status={change.plate.status} /> to <StatusBadge kind="plate" status={change.to} />.
            {change.plate.status === "assigned" && <> It will be unlinked from its motorcycle.</>}
          </>
        ) : null}
        onConfirm={async (note) => {
          if (change && (await changeAction.run(change, note))) setChange(null);
        }}
      />
    </div>
  );
}
