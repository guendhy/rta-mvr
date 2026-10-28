"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { useAction, useServiceQuery } from "@/hooks/use-service";
import { PROVINCE_NAMES, districtsFor } from "@/lib/constants";
import { settingsService } from "@/services/settings.service";
import type { Office } from "@/types";
import { PageHeader } from "@/components/ui/layout-bits";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/feedback";
import { ActiveBadge, FilterBar, FilterSelect, FormFooter, ResultCount, SearchField } from "@/components/admin/admin-bits";

const schema = z.object({
  name: z.string().trim().min(3, "Enter the office name"),
  code: z.string().trim().min(2, "Enter a short office code").max(12, "Use 12 characters or fewer").regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  province: z.string().min(1, "Select a province"),
  district: z.string().min(1, "Select a district"),
  address: z.string().trim().min(5, "Enter the street address"),
  phone: z.string().trim().min(6, "Enter the office phone number"),
  email: z.string().trim().min(1, "Enter the office email").email("Enter a valid email address"),
  status: z.enum(["active", "inactive"]),
});
type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS = [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }];

function OfficeForm({ office, onDone }: { office: Office | null; onDone: () => void }) {
  const save = useAction((v: FormValues) => settingsService.saveOffice({ ...v, code: v.code.toUpperCase(), id: office?.id }), { success: (o) => `Office ${o.name} saved` });
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: office
      ? { name: office.name, code: office.code, province: office.province, district: office.district, address: office.address, phone: office.phone, email: office.email, status: office.status }
      : { name: "", code: "", province: "", district: "", address: "", phone: "", email: "", status: "active" },
  });
  const province = watch("province");
  const provinceField = register("province");
  return (
    <Modal open onClose={() => !save.busy && onDone()} title={office ? `Edit ${office.name}` : "Add office"} size="lg" footer={<FormFooter formId="office-form" busy={save.busy} onCancel={onDone} submitLabel={office ? "Save changes" : "Add office"} />}>
      <form id="office-form" className="form" onSubmit={handleSubmit(async (v) => { if (await save.run(v)) onDone(); })} noValidate>
        <Field label="Office name" required htmlFor="o-name" error={errors.name?.message} className="full"><Input id="o-name" invalid={!!errors.name} {...register("name")} /></Field>
        <Field label="Code" required htmlFor="o-code" error={errors.code?.message} help="Short unique code, e.g. POM or LAE."><Input id="o-code" mono className="uppercase" invalid={!!errors.code} {...register("code")} /></Field>
        <Field label="Status" required htmlFor="o-status"><Select id="o-status" options={STATUS_OPTIONS} {...register("status")} /></Field>
        <Field label="Province" required htmlFor="o-prov" error={errors.province?.message}>
          <Select id="o-prov" placeholder="Select province" options={PROVINCE_NAMES} invalid={!!errors.province} {...provinceField} onChange={(e) => { provinceField.onChange(e); setValue("district", ""); }} />
        </Field>
        <Field label="District" required htmlFor="o-dist" error={errors.district?.message} help={!province ? "Select a province first." : undefined}>
          <Select id="o-dist" placeholder="Select district" options={districtsFor(province)} invalid={!!errors.district} {...register("district")} />
        </Field>
        <Field label="Address" required htmlFor="o-addr" error={errors.address?.message} className="full"><Textarea id="o-addr" rows={2} invalid={!!errors.address} {...register("address")} /></Field>
        <Field label="Phone" required htmlFor="o-phone" error={errors.phone?.message}><Input id="o-phone" type="tel" invalid={!!errors.phone} {...register("phone")} /></Field>
        <Field label="Email" required htmlFor="o-email" error={errors.email?.message}><Input id="o-email" type="email" invalid={!!errors.email} {...register("email")} /></Field>
      </form>
    </Modal>
  );
}

export default function OfficesPage() {
  const offices = useServiceQuery(() => settingsService.listOffices(), []);
  const [q, setQ] = useState("");
  const [province, setProvince] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Office | "new" | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (offices.data ?? []).filter((o) => (!province || o.province === province) && (!status || o.status === status) && (!term || `${o.name} ${o.code} ${o.district} ${o.address}`.toLowerCase().includes(term)));
  }, [offices.data, q, province, status]);

  const columns: ColumnDef<Office, unknown>[] = [
    { id: "name", header: "Office Name", accessorFn: (o) => o.name, cell: ({ row }) => <span className="font-semibold">{row.original.name}</span> },
    { id: "code", header: "Code", accessorFn: (o) => o.code, cell: ({ row }) => <span className="mono font-semibold">{row.original.code}</span> },
    { id: "province", header: "Province", accessorFn: (o) => o.province },
    { id: "district", header: "District", accessorFn: (o) => o.district },
    { id: "address", header: "Address", accessorFn: (o) => o.address, cell: ({ row }) => <span className="block max-w-[240px]">{row.original.address}</span> },
    { id: "phone", header: "Phone", accessorFn: (o) => o.phone, cell: ({ row }) => <span className="whitespace-nowrap">{row.original.phone}</span> },
    { id: "email", header: "Email", accessorFn: (o) => o.email },
    { id: "status", header: "Status", accessorFn: (o) => o.status, cell: ({ row }) => <ActiveBadge active={row.original.status === "active"} /> },
    { id: "actions", header: "Actions", enableSorting: false, cell: ({ row }) => <button type="button" className="btn btn-s btn-sm" onClick={() => setEditing(row.original)} aria-label={`Edit ${row.original.name}`}><Pencil size={14} aria-hidden="true" />Edit</button> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Administration" title="Offices" description="RTA registration offices. Users, plates and POS terminals are assigned to an office." actions={<button type="button" className="btn btn-p" onClick={() => setEditing("new")}><Plus size={18} aria-hidden="true" />Add Office</button>} />
      <FilterBar>
        <SearchField id="office-q" value={q} onChange={setQ} placeholder="Name, code, district or address" />
        <FilterSelect id="office-prov" label="Province" value={province} onChange={setProvince} options={PROVINCE_NAMES.map((p) => ({ value: p, label: p }))} all="All provinces" />
        <FilterSelect id="office-status" label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} all="All statuses" />
      </FilterBar>
      {offices.error ? (
        <ErrorState message={offices.error} onRetry={() => offices.reload()} />
      ) : (
        <>
          {offices.data && <ResultCount shown={rows.length} total={offices.data.length} noun="offices" />}
          <DataTable
            storageKey="admin-offices"
            data={offices.data ? rows : undefined}
            loading={offices.loading}
            columns={columns}
            initialSort={[{ id: "name", desc: false }]}
            mobileCard={(o) => (
              <MobileCard
                title={o.code}
                badge={<ActiveBadge active={o.status === "active"} />}
                lines={[o.name, `${o.district}, ${o.province}`, o.address, `${o.phone} · ${o.email}`]}
                footer={<button type="button" className="btn btn-s" onClick={() => setEditing(o)}><Pencil size={14} aria-hidden="true" />Edit</button>}
              />
            )}
            empty={{ title: "No offices found", message: q || province || status ? "No offices match the current filters." : "Add the first RTA office to get started.", action: { label: "Add Office", onClick: () => setEditing("new") } }}
          />
        </>
      )}
      {editing && <OfficeForm key={editing === "new" ? "new" : editing.id} office={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
    </div>
  );
}
