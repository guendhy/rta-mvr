"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { PROVINCE_NAMES, districtsFor } from "@/lib/constants";
import { inspectionService } from "@/services/inspection.service";
import type { InspectionCenter } from "@/types";
import { PageHeader } from "@/components/ui/layout-bits";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/feedback";
import { ActiveBadge, FilterBar, FilterSelect, FormFooter, ResultCount, SearchField } from "@/components/admin/admin-bits";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the center name"),
  code: z.string().trim().min(2, "Enter a short center code").max(16, "Use 16 characters or fewer").regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  province: z.string().min(1, "Select a province"),
  district: z.string().min(1, "Select a district"),
  address: z.string().trim().min(5, "Enter the address"),
  status: z.enum(["active", "inactive"]),
});
type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS = [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }];

function CenterForm({ center, onDone }: { center: InspectionCenter | null; onDone: () => void }) {
  const save = useAction((v: FormValues) => inspectionService.saveCenter({ ...v, code: v.code.toUpperCase(), id: center?.id }), { success: (c) => `${c.name} saved` });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: center
      ? { name: center.name, code: center.code, province: center.province, district: center.district, address: center.address, status: center.status }
      : { name: "", code: "", province: "", district: "", address: "", status: "active" },
  });
  const province = watch("province");
  const provinceField = register("province");
  return (
    <Modal open onClose={() => !save.busy && onDone()} title={center ? `Edit ${center.name}` : "Add inspection center"} size="lg" footer={<FormFooter formId="center-form" busy={save.busy} onCancel={onDone} submitLabel={center ? "Save changes" : "Add center"} />}>
      <form id="center-form" className="form" onSubmit={handleSubmit(async (v) => { if (await save.run(v)) onDone(); })} noValidate>
        <Field label="Center name" required htmlFor="c-name" error={errors.name?.message} className="full"><Input id="c-name" invalid={!!errors.name} {...register("name")} /></Field>
        <Field label="Code" required htmlFor="c-code" error={errors.code?.message}><Input id="c-code" mono className="uppercase" invalid={!!errors.code} {...register("code")} /></Field>
        <Field label="Status" required htmlFor="c-status"><Select id="c-status" options={STATUS_OPTIONS} {...register("status")} /></Field>
        <Field label="Province" required htmlFor="c-prov" error={errors.province?.message}>
          <Select id="c-prov" placeholder="Select province" options={PROVINCE_NAMES} invalid={!!errors.province} {...provinceField} onChange={(e) => { provinceField.onChange(e); setValue("district", ""); }} />
        </Field>
        <Field label="District" required htmlFor="c-dist" error={errors.district?.message} help={!province ? "Select a province first." : undefined}>
          <Select id="c-dist" placeholder="Select district" options={districtsFor(province)} invalid={!!errors.district} {...register("district")} />
        </Field>
        <Field label="Address" required htmlFor="c-addr" error={errors.address?.message} className="full"><Textarea id="c-addr" rows={2} invalid={!!errors.address} {...register("address")} /></Field>
      </form>
    </Modal>
  );
}

export default function InspectionCentersPage() {
  const centers = useServiceQuery(() => inspectionService.listCenters(), []);
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<InspectionCenter | "new" | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (centers.data ?? []).filter((c) => (!province || c.province === province) && (!status || c.status === status) && (!term || `${c.name} ${c.code} ${c.district} ${c.address}`.toLowerCase().includes(term)));
  }, [centers.data, q, province, status]);

  const columns: ColumnDef<InspectionCenter, unknown>[] = [
    { id: "name", header: "Center Name", accessorFn: (c) => c.name, cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
    { id: "code", header: "Code", accessorFn: (c) => c.code, cell: ({ row }) => <span className="mono font-semibold">{row.original.code}</span> },
    { id: "province", header: "Province", accessorFn: (c) => c.province },
    { id: "district", header: "District", accessorFn: (c) => c.district },
    { id: "address", header: "Address", accessorFn: (c) => c.address, cell: ({ row }) => <span className="block max-w-[280px]">{row.original.address}</span> },
    { id: "status", header: "Status", accessorFn: (c) => c.status, cell: ({ row }) => <ActiveBadge active={row.original.status === "active"} /> },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => <button type="button" className="btn btn-s btn-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.name}`}><Pencil size={14} aria-hidden="true" />Edit</button> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration" title="Inspection Centers" description="Roadworthiness inspection sites. Inactive centers cannot be selected when scheduling an inspection." actions={<button type="button" className="btn btn-p" onClick={() => setEditing("new")}><Plus size={18} aria-hidden="true" />Add Center</button>} />
      <FilterBar>
        <SearchField id="center-q" value={q} onChange={setQ} placeholder="Name, code, district or address" />
        <FilterSelect id="center-prov" label="Province" value={province} onChange={setProvince} options={PROVINCE_NAMES.map((p) => ({ value: p, label: p }))} all="All provinces" />
        <FilterSelect id="center-status" label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} all="All statuses" />
      </FilterBar>
      {centers.error ? (
        <ErrorState message={centers.error} onRetry={() => centers.reload()} />
      ) : (
        <>
          {centers.data && <ResultCount shown={rows.length} total={centers.data.length} noun="centers" />}
          <DataTable
            storageKey="admin-centers"
            data={centers.data ? rows : undefined}
            loading={centers.loading}
            columns={columns}
            initialSort={[{ id: "name", desc: false }]}
            mobileCard={(c) => (
              <MobileCard
                title={c.code}
                badge={<ActiveBadge active={c.status === "active"} />}
                lines={[c.name, `${c.district}, ${c.province}`, c.address]}
                footer={<button type="button" className="btn btn-s" onClick={() => setEditing(c)}><Pencil size={14} aria-hidden="true" />Edit</button>}
              />
            )}
            empty={{ title: "No inspection centers found", message: q || province || status ? "No centers match the current filters." : "Add the first inspection center.", action: { label: "Add Center", onClick: () => setEditing("new") } }}
          />
        </>
      )}
      {editing && <CenterForm key={editing === "new" ? "new" : editing.id} center={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
    </div>
  );
}
