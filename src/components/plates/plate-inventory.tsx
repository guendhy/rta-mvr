"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BadgeCheck, PackagePlus } from "lucide-react";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { PLATE_STATUS } from "@/config/statuses";
import { PLATE_CATEGORIES, plateCategoryLabel } from "@/config/vehicle-usage";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { formatDate, vehicleLabel } from "@/lib/formatting";
import { plateService } from "@/services/plate.service";
import { settingsService } from "@/services/settings.service";
import { vehicleService } from "@/services/vehicle.service";
import { registrationService } from "@/services/registration.service";
import type { Office, Plate, PlateCategory, PlateStatus, RegistrationApplication, Vehicle } from "@/types";
import { Field, Input, Select } from "@/components/ui/form";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Alert, ErrorState, Skeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { FilterBar, FilterSelect, FormFooter, ResultCount, SearchField } from "@/components/admin/admin-bits";
import { LOW_PLATE_STOCK, PlateChip, platePreview } from "./plate-bits";

const STATUS_KEYS = Object.keys(PLATE_STATUS) as PlateStatus[];
const CHANGE_TARGETS: PlateStatus[] = ["available", "damaged", "lost", "cancelled", "released"];
const VERB: Partial<Record<PlateStatus, string>> = { available: "Mark Available", damaged: "Mark Damaged", lost: "Mark Lost", cancelled: "Mark Cancelled", released: "Release" };
const CATEGORY_OPTIONS = PLATE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
const CATEGORY_VALUES = PLATE_CATEGORIES.map((c) => c.value) as [PlateCategory, ...PlateCategory[]];

/** Statuses a plate may move to; the service only allows releasing an assigned plate. */
function targetsFor(p: Plate): PlateStatus[] {
  if (p.status === "assigned") return ["released"];
  return CHANGE_TARGETS.filter((s) => s !== p.status);
}

const receiveSchema = z
  .object({
    category: z.enum(CATEGORY_VALUES, { errorMap: () => ({ message: "Select the plate category" }) }),
    from: z.number({ invalid_type_error: "Enter the first plate number" }).int("Use whole numbers").min(1, "Enter the first plate number"),
    to: z.number({ invalid_type_error: "Enter the last plate number" }).int("Use whole numbers").min(1, "Enter the last plate number"),
    officeId: z.string().min(1, "Select the receiving office"),
    receivedDate: z.string().min(1, "Select the received date"),
  })
  .refine((v) => v.to >= v.from, { message: "The last number must be the same as or after the first.", path: ["to"] })
  .refine((v) => v.to - v.from < 500, { message: "Receive at most 500 plates at a time.", path: ["to"] });
type ReceiveValues = z.infer<typeof receiveSchema>;

function ReceiveModal({ offices, defaultOfficeId, defaultCategory, onDone }: { offices: Office[]; defaultOfficeId?: string; defaultCategory?: PlateCategory; onDone: () => void }) {
  const save = useAction((v: ReceiveValues) => plateService.receiveBatch(v), { success: (r) => `${r.length} ${plateCategoryLabel(r[0]?.category)} plate${r.length === 1 ? "" : "s"} received into inventory` });
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ReceiveValues>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { category: defaultCategory, from: undefined, to: undefined, officeId: defaultOfficeId ?? offices[0]?.id ?? "", receivedDate: new Date().toISOString().slice(0, 10) },
  });
  const [category, from, to] = watch(["category", "from", "to"]);
  const count = Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from + 1 : 0;
  return (
    <Modal open onClose={() => !save.busy && onDone()} title="Receive plate batch" description="Record a batch of new plates of one category delivered to an office." footer={<FormFooter formId="receive-form" busy={save.busy} onCancel={onDone} submitLabel={count ? `Receive ${count} plate${count === 1 ? "" : "s"}` : "Receive plates"} />}>
      <form id="receive-form" className="form" onSubmit={handleSubmit(async (v) => { if (await save.run(v)) onDone(); })} noValidate>
        <Field label="Plate category" required htmlFor="r-cat" error={errors.category?.message} className="full" help="Each category is a separate plate series.">
          <Select id="r-cat" placeholder="Select category" options={CATEGORY_OPTIONS} invalid={!!errors.category} {...register("category")} />
        </Field>
        <Field label="From number" required htmlFor="r-from" error={errors.from?.message} help="Digits only — the series prefix is added">
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
          {!category
            ? "Select the plate category, then enter the first and last numbers in the batch."
            : count
              ? <>Creates <strong>{count}</strong> {plateCategoryLabel(category)} plate{count === 1 ? "" : "s"}: <span className="mono font-semibold">{platePreview(category, from)}</span>{count > 1 && <> to <span className="mono font-semibold">{platePreview(category, to)}</span></>}</>
              : <>Enter the first and last numbers. {plateCategoryLabel(category)} plates look like <span className="mono font-semibold">{platePreview(category, 100)}</span>.</>}
        </p>
      </form>
    </Modal>
  );
}

interface Lookups {
  offices: Office[];
  vehicles: Map<string, Vehicle>;
  apps: Map<string, RegistrationApplication>;
}

export function PlateInventory() {
  const { can, office: myOffice } = useDemoUser();
  const manage = can("plates.manage");
  const canAssign = can("plates.assign");
  const plates = useServiceQuery(() => plateService.list(), []);
  const lookups = useServiceQuery<Lookups>(async () => {
    const [offices, vehicles, apps] = await Promise.all([settingsService.listOffices(), vehicleService.list(), registrationService.list()]);
    return { offices, vehicles: new Map(vehicles.map((v) => [v.id, v])), apps: new Map(apps.map((a) => [a.id, a])) };
  }, []);
  const [category, setCategory] = useState<PlateCategory | "">("");
  const [status, setStatus] = useState("");
  const [office, setOffice] = useState("");
  const [q, setQ] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [change, setChange] = useState<{ plate: Plate; to: PlateStatus } | null>(null);
  const changeAction = useAction((c: { plate: Plate; to: PlateStatus }, note: string) => plateService.changeStatus(c.plate.id, c.to, note), { success: (p) => `Plate ${p.plateNumber} is now ${PLATE_STATUS[p.status].label}` });

  const officeName = (id: string) => lookups.data?.offices.find((o) => o.id === id)?.name ?? "—";
  const vehicleOf = (p: Plate) => (p.vehicleId ? lookups.data?.vehicles.get(p.vehicleId) : undefined);
  const appOf = (p: Plate) => (p.applicationId ? lookups.data?.apps.get(p.applicationId) : undefined);

  const scoped = useMemo(() => (plates.data ?? []).filter((p) => !office || p.officeId === office), [plates.data, office]);
  const available = useMemo(() => {
    const m = new Map<PlateCategory, number>();
    for (const p of scoped) if (p.status === "available") m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [scoped]);
  const totalAvailable = useMemo(() => [...available.values()].reduce((a, b) => a + b, 0), [available]);
  // Only categories the office actually stocks are flagged as low.
  const lowStock = useMemo(() => {
    const stocked = new Set(scoped.map((p) => p.category));
    return PLATE_CATEGORIES.filter((c) => stocked.has(c.value) && (available.get(c.value) ?? 0) < LOW_PLATE_STOCK);
  }, [scoped, available]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const l = lookups.data;
    return scoped.filter((p) => {
      if (category && p.category !== category) return false;
      if (status && p.status !== status) return false;
      if (!term) return true;
      const v = p.vehicleId ? l?.vehicles.get(p.vehicleId) : undefined;
      const a = p.applicationId ? l?.apps.get(p.applicationId) : undefined;
      return `${p.plateNumber} ${v?.registrationNumber ?? ""} ${a?.transactionNumber ?? ""} ${vehicleLabel(v)} ${p.notes ?? ""}`.toLowerCase().includes(term);
    });
  }, [scoped, category, status, q, lookups.data]);

  const statusAction = (p: Plate, mobile = false) => {
    if (!manage) return null;
    return (
      <select
        className={`inp text-[13px] ${mobile ? "" : "!h-9 !w-auto"}`}
        value=""
        aria-label={`Change status of plate ${p.plateNumber}`}
        onChange={(e) => e.target.value && setChange({ plate: p, to: e.target.value as PlateStatus })}
      >
        <option value="">Change status…</option>
        {targetsFor(p).map((t) => <option key={t} value={t}>{VERB[t]}</option>)}
      </select>
    );
  };

  const assignedCell = (p: Plate) => {
    const v = vehicleOf(p);
    const a = appOf(p);
    if (!v && !a) return <span className="mut">—</span>;
    const label = v?.registrationNumber ?? a?.transactionNumber ?? "View vehicle";
    const href = v ? `/registry/${v.id}` : `/registrations/${a!.id}`;
    return (
      <span className="flex flex-col">
        <Link href={href} className="mono font-semibold whitespace-nowrap">{label}</Link>
        {v && <span className="mut text-[12px]">{vehicleLabel(v)}</span>}
      </span>
    );
  };

  const typeCell = (p: Plate) => {
    const v = vehicleOf(p);
    if (!v) return <span className="mut">—</span>;
    return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><VehicleIcon type={v.vehicleType} size={16} className="text-[#5a606c]" />{vehicleTypeLabel(v.vehicleType)}</span>;
  };

  const columns: ColumnDef<Plate, unknown>[] = [
    { id: "plate", header: "Plate", accessorFn: (p) => p.plateNumber, sortingFn: "alphanumeric", cell: ({ row }) => <PlateChip number={row.original.plateNumber} /> },
    { id: "category", header: "Category", accessorFn: (p) => plateCategoryLabel(p.category) },
    { id: "status", header: "Status", accessorFn: (p) => p.status, cell: ({ row }) => <StatusBadge kind="plate" status={row.original.status} /> },
    { id: "assigned", header: "Assigned vehicle", accessorFn: (p) => vehicleOf(p)?.registrationNumber ?? appOf(p)?.transactionNumber ?? "", cell: ({ row }) => assignedCell(row.original) },
    { id: "type", header: "Vehicle type", accessorFn: (p) => vehicleTypeLabel(vehicleOf(p)?.vehicleType), cell: ({ row }) => typeCell(row.original) },
    { id: "office", header: "Office", accessorFn: (p) => officeName(p.officeId) },
    { id: "received", header: "Received", accessorFn: (p) => p.receivedDate, cell: ({ row }) => <span className="mono whitespace-nowrap">{formatDate(row.original.receivedDate)}</span> },
    { id: "issued", header: "Issued", accessorFn: (p) => p.assignedDate ?? "", cell: ({ row }) => <span className="mono whitespace-nowrap">{formatDate(row.original.assignedDate)}</span> },
    ...(manage || canAssign
      ? [{
        id: "action", header: "Action", enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            {canAssign && row.original.status === "available" && <Link href="/plates?tab=assign" className="btn btn-g btn-sm" aria-label={`Assign plate ${row.original.plateNumber}`}>Assign</Link>}
            {statusAction(row.original)}
          </div>
        ),
      } as ColumnDef<Plate, unknown>]
      : []),
  ];

  if (plates.error || lookups.error) return <ErrorState message={plates.error ?? lookups.error ?? ""} onRetry={() => { plates.reload(); lookups.reload(); }} />;

  const categoryButton = (value: PlateCategory | "", label: string, count: number, low = false) => (
    <button
      key={value || "all"}
      type="button"
      aria-pressed={category === value}
      onClick={() => setCategory(category === value && value ? "" : value)}
      className={`opt !min-h-[72px] !flex-col !items-start !gap-0.5 ${category === value ? "opt-on" : ""}`}
    >
      <span className="text-[12.5px] font-semibold">{label}</span>
      <span className={`text-[22px] font-extrabold ${low ? "text-[#8a4100]" : "text-[#0b0b0f]"}`}>{count}</span>
      {low && <span className="text-[11.5px] font-semibold text-[#8a4100]">Low stock</span>}
    </button>
  );

  return (
    <div className="flex flex-col gap-5">
      {lowStock.length > 0 && (
        <Alert tone="warn" title="Low plate stock" action={manage ? <button type="button" className="btn btn-s btn-sm" onClick={() => { setCategory(lowStock[0].value); setReceiving(true); }} disabled={!lookups.data}><PackagePlus size={15} aria-hidden="true" />Receive batch</button> : undefined}>
          {lowStock.map((c) => `${c.label} ${available.get(c.value) ?? 0}`).join(" · ")} available{office ? ` at ${officeName(office)}` : ""} (reorder below {LOW_PLATE_STOCK}).
        </Alert>
      )}

      <section className="card sec !gap-3" aria-labelledby="plate-cat-h">
        <div className="sechd">
          <h2 id="plate-cat-h" className="eb">Available by plate category</h2>
          {manage && <button type="button" className="btn btn-p btn-sm" onClick={() => setReceiving(true)} disabled={!lookups.data}><PackagePlus size={16} aria-hidden="true" />Receive batch</button>}
        </div>
        {plates.data ? (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(120px, 100%), 1fr))" }} role="group" aria-label="Filter by plate category">
            {categoryButton("", "All categories", totalAvailable)}
            {PLATE_CATEGORIES.map((c) => categoryButton(c.value, c.label, available.get(c.value) ?? 0, lowStock.some((l) => l.value === c.value)))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}</div>
        )}
      </section>

      <FilterBar>
        <SearchField id="plate-q" label="Search" value={q} onChange={setQ} placeholder="Plate, registration or transaction" />
        <FilterSelect id="plate-cat" label="Category" value={category} onChange={(v) => setCategory(v as PlateCategory | "")} options={CATEGORY_OPTIONS} all="All categories" />
        <FilterSelect id="plate-status" label="Status" value={status} onChange={setStatus} options={STATUS_KEYS.map((s) => ({ value: s, label: PLATE_STATUS[s].label }))} all="All statuses" />
        <FilterSelect id="plate-office" label="Office" value={office} onChange={setOffice} options={(lookups.data?.offices ?? []).map((o) => ({ value: o.id, label: o.name }))} all="All offices" />
      </FilterBar>

      {plates.data && <ResultCount shown={rows.length} total={plates.data.length} noun="plates" />}
      <DataTable
        storageKey="plates-inventory"
        data={plates.data && lookups.data ? rows : undefined}
        loading={plates.loading || lookups.loading}
        columns={columns}
        initialSort={[{ id: "plate", desc: false }]}
        mobileCard={(p) => {
          const v = vehicleOf(p);
          return (
            <MobileCard
              title={<PlateChip number={p.plateNumber} size="sm" />}
              badge={<StatusBadge kind="plate" status={p.status} />}
              lines={[
                `${plateCategoryLabel(p.category)} · ${officeName(p.officeId)}`,
                v || appOf(p) ? <span key="v" className="flex flex-wrap items-center gap-1.5">{assignedCell(p)}{v && <span className="mut">· {vehicleTypeLabel(v.vehicleType)}</span>}</span> : "Not assigned",
                `Received ${formatDate(p.receivedDate)}${p.assignedDate ? ` · Issued ${formatDate(p.assignedDate)}` : ""}`,
              ]}
              footer={manage || (canAssign && p.status === "available") ? (
                <div className="flex w-full flex-col gap-2">
                  {canAssign && p.status === "available" && <Link href="/plates?tab=assign" className="btn btn-s w-full"><BadgeCheck size={15} aria-hidden="true" />Assign plate</Link>}
                  {statusAction(p, true)}
                </div>
              ) : undefined}
            />
          );
        }}
        empty={{ title: "No plates found", message: q || status || office || category ? "No plates match the current filters." : "No plates are in inventory yet.", action: manage ? { label: "Receive batch", onClick: () => setReceiving(true) } : undefined }}
      />

      {receiving && lookups.data && <ReceiveModal offices={lookups.data.offices} defaultOfficeId={office || myOffice?.id} defaultCategory={category || undefined} onDone={() => setReceiving(false)} />}

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
            {plateCategoryLabel(change.plate.category)} plate <span className="mono font-semibold">{change.plate.plateNumber}</span> will change from <StatusBadge kind="plate" status={change.plate.status} /> to <StatusBadge kind="plate" status={change.to} />.
            {change.plate.status === "assigned" && <> It will be unlinked from its vehicle.</>}
          </>
        ) : null}
        onConfirm={async (note) => {
          if (change && (await changeAction.run(change, note))) setChange(null);
        }}
      />
    </div>
  );
}
