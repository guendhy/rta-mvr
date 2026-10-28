"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { MAKES, MOTORCYCLE_STATUS, PROVINCE_NAMES } from "@/lib/constants";
import { formatDate, fullName } from "@/lib/formatting";
import { motorcycleService } from "@/services/motorcycle.service";
import { ownerService } from "@/services/owner.service";
import { settingsService } from "@/services/settings.service";
import { PageHeader } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { PlateChip, daysToExpiry, expiryText } from "@/components/registry/renewal";
import type { Motorcycle, MotorcycleRegistrationStatus, Owner } from "@/types";

type Expiry = "" | "expired" | "30" | "90";
type Row = { moto: Motorcycle; owner: Owner | undefined; days: number | null; officeName: string };

const EXPIRY_OPTIONS = [
  { value: "expired", label: "Expired" },
  { value: "30", label: "Expiring in 30 days or less" },
  { value: "90", label: "Expiring in 90 days or less" },
];

function ExpiryCell({ days, iso }: { days: number | null; iso?: string }) {
  if (days === null) return <span className="mut">—</span>;
  const tone = days < 0 ? "text-[#a3111a]" : days <= 30 ? "text-[#6e5200]" : "mut";
  return (
    <span className="flex flex-col">
      <span className="mono">{formatDate(iso)}</span>
      <span className={`text-[12px] ${tone}`}>{expiryText(days)}</span>
    </span>
  );
}

function RegistryInner() {
  const params = useSearchParams();
  const initialExpiry = params.get("expiry");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState<string>(params.get("status") ?? "");
  const [province, setProvince] = useState("");
  const [make, setMake] = useState("");
  const [expiry, setExpiry] = useState<Expiry>(initialExpiry === "expired" || initialExpiry === "30" || initialExpiry === "90" ? initialExpiry : "");
  const [office, setOffice] = useState("");
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);

  const data = useServiceQuery(async () => {
    const [motos, owners, offices] = await Promise.all([motorcycleService.list(), ownerService.list(), settingsService.listOffices()]);
    return { motos, owners, offices };
  }, []);

  const rows = useMemo<Row[] | undefined>(() => {
    if (!data.data) return undefined;
    const { motos, owners, offices } = data.data;
    return motos
      .map((m) => ({ moto: m, owner: owners.find((o) => o.id === m.ownerId), days: daysToExpiry(m), officeName: offices.find((o) => o.id === m.officeId)?.name ?? "—" }))
      .filter((r) => {
        const m = r.moto;
        if (status && m.registrationStatus !== status) return false;
        if (province && m.provinceOfOperation !== province) return false;
        if (make && m.make !== make) return false;
        if (office && m.officeId !== office) return false;
        if (expiry === "expired" && !(r.days !== null && r.days < 0)) return false;
        if ((expiry === "30" || expiry === "90") && !(r.days !== null && r.days >= 0 && r.days <= Number(expiry))) return false;
        if (q) {
          const hay = [m.registrationNumber, m.plateNumber, fullName(r.owner), r.owner?.mobile, m.engineNumber, m.chassisNumber, m.vin].filter(Boolean).join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.moto.plateNumber ?? "~").localeCompare(b.moto.plateNumber ?? "~"));
  }, [data.data, status, province, make, office, expiry, q]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!data.data) return <PageSkeleton />;

  const filtersOn = !!(query || status || province || make || expiry || office);
  const clear = () => { setQuery(""); setStatus(""); setProvince(""); setMake(""); setExpiry(""); setOffice(""); };

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "plate", header: "Plate", accessorFn: (r) => r.moto.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.moto.plateNumber} size="sm" /> },
    { id: "reg", header: "Registration No.", accessorFn: (r) => r.moto.registrationNumber ?? "", cell: ({ row }) => <span className="mono">{row.original.moto.registrationNumber ?? "—"}</span> },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "makeModel", header: "Make / Model", accessorFn: (r) => `${r.moto.make} ${r.moto.model}` },
    { id: "year", header: "Year", accessorFn: (r) => r.moto.year, meta: { align: "right" } },
    { id: "province", header: "Province", accessorFn: (r) => r.moto.provinceOfOperation },
    { id: "expiry", header: "Expiry", accessorFn: (r) => r.moto.registrationExpiry ?? "", cell: ({ row }) => <ExpiryCell days={row.original.days} iso={row.original.moto.registrationExpiry} /> },
    { id: "status", header: "Status", accessorFn: (r) => r.moto.registrationStatus, cell: ({ row }) => <StatusBadge kind="motorcycle" status={row.original.moto.registrationStatus} /> },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={`/registry/${row.original.moto.id}`} className="btn btn-s btn-sm" aria-label={`View motorcycle ${row.original.moto.plateNumber ?? row.original.moto.engineNumber}`}>View</Link> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Registry" title="Motorcycle Registry" description="Every motorcycle on record — registered, expired, suspended and not yet registered." />

      <section className="card sec" aria-label="Search and filters">
        <div className="form">
          <Field label="Search" htmlFor="reg-q" className="full" help="Registration number, plate, owner name, engine number, chassis number or VIN">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
              <Input id="reg-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. NCD-2025-00012, P1234, Kila" className="!pl-10" autoComplete="off" />
            </div>
          </Field>
          <Field label="Status" htmlFor="reg-status">
            <Select id="reg-status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={(Object.keys(MOTORCYCLE_STATUS) as MotorcycleRegistrationStatus[]).map((k) => ({ value: k, label: MOTORCYCLE_STATUS[k].label }))} />
          </Field>
          <Field label="Province" htmlFor="reg-prov">
            <Select id="reg-prov" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="All provinces" options={PROVINCE_NAMES} />
          </Field>
          <Field label="Make" htmlFor="reg-make">
            <Select id="reg-make" value={make} onChange={(e) => setMake(e.target.value)} placeholder="All makes" options={Object.keys(MAKES)} />
          </Field>
          <Field label="Registration expiry" htmlFor="reg-exp">
            <Select id="reg-exp" value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)} placeholder="Any expiry" options={EXPIRY_OPTIONS} />
          </Field>
          <Field label="Office" htmlFor="reg-office">
            <Select id="reg-office" value={office} onChange={(e) => setOffice(e.target.value)} placeholder="All offices" options={data.data.offices.map((o) => ({ value: o.id, label: o.name }))} />
          </Field>
        </div>
        <div className="row justify-between">
          <p className="mut m-0 text-[13px]" aria-live="polite">{rows?.length ?? 0} of {data.data.motos.length} motorcycles</p>
          {filtersOn && <button type="button" className="btn btn-g btn-sm min-h-[44px]" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button>}
        </div>
      </section>

      <DataTable
        storageKey="registry"
        data={rows}
        loading={data.loading}
        columns={columns}
        mobileCard={(r) => (
          <MobileCard
            href={`/registry/${r.moto.id}`}
            title={r.moto.registrationNumber ?? "Not registered"}
            badge={<StatusBadge kind="motorcycle" status={r.moto.registrationStatus} />}
            lines={[fullName(r.owner), `${r.moto.make} ${r.moto.model} · ${r.moto.year} · ${r.moto.provinceOfOperation}`]}
            footer={<><PlateChip plate={r.moto.plateNumber} size="sm" /><span className="mut text-right text-[12px]">{r.days === null ? "No expiry" : `${formatDate(r.moto.registrationExpiry)} · ${expiryText(r.days)}`}</span></>}
          />
        )}
        empty={{ title: "No motorcycles found", message: filtersOn ? "No motorcycles match the current search and filters." : "There are no motorcycles on record yet.", action: filtersOn ? { label: "Clear filters", onClick: clear } : undefined }}
      />
    </div>
  );
}

export default function RegistryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RegistryInner />
    </Suspense>
  );
}
