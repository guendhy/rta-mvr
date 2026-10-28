"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Plus, RefreshCw, Search, X } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { PROVINCE_NAMES } from "@/lib/constants";
import { downloadText, formatDate, fullName, toCsv } from "@/lib/formatting";
import { APPLICATION_PAYMENT_STATUS, VEHICLE_STATE_OPTIONS, getStatusLabel, vehicleRegistrationState, type ApplicationPaymentState, type VehicleRegistrationState } from "@/config/statuses";
import { TRANSACTION_TYPE_OPTIONS, transactionLabel } from "@/config/transaction-types";
import { VEHICLE_TYPE_OPTIONS, vehicleTypeLabel } from "@/config/vehicle-types";
import { VEHICLE_USAGES, vehicleUsageLabel } from "@/config/vehicle-usage";
import { vehicleService } from "@/services/vehicle.service";
import { paymentService } from "@/services/payment.service";
import type { VehicleRecord } from "@/services/interfaces";
import { PageHeader } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { RegistrationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import {
  EXPIRY_PERIOD_OPTIONS,
  PlateChip,
  applicationHref,
  applicationPaymentState,
  daysToExpiry,
  expiryText,
  matchesExpiryPeriod,
  parseExpiryPeriod,
  type ExpiryPeriod,
} from "@/components/registry/renewal";
import { recordMatches } from "@/components/registry/lookup";

type Row = VehicleRecord & { state: VehicleRegistrationState; days: number | null; payment: ApplicationPaymentState | null };

const STATE_VALUES = new Set<string>(VEHICLE_STATE_OPTIONS.map((o) => o.value));
const RENEWABLE: VehicleRegistrationState[] = ["active", "expiring_soon", "expired"];
const PAYMENT_OPTIONS = (Object.keys(APPLICATION_PAYMENT_STATUS) as ApplicationPaymentState[]).map((k) => ({ value: k, label: APPLICATION_PAYMENT_STATUS[k].label }));

function ExpiryCell({ days, iso }: { days: number | null; iso?: string }) {
  if (days === null) return <span className="mut">—</span>;
  const tone = days < 0 ? "text-[#a3111a]" : days <= 30 ? "text-[#6e5200]" : "mut";
  return (
    <span className="flex flex-col">
      <span className="mono whitespace-nowrap">{formatDate(iso)}</span>
      <span className={`text-[12px] whitespace-nowrap ${tone}`}>{expiryText(days)}</span>
    </span>
  );
}

interface Initial {
  q: string;
  status: string;
  expiry: ExpiryPeriod;
}

function RegistryInner({ initial }: { initial: Initial }) {
  const { can } = useDemoUser();
  const [query, setQuery] = useState(initial.q);
  const [type, setType] = useState("");
  const [usage, setUsage] = useState("");
  const [province, setProvince] = useState("");
  const [status, setStatus] = useState(initial.status);
  const [payment, setPayment] = useState("");
  const [txn, setTxn] = useState("");
  const [expiry, setExpiry] = useState<ExpiryPeriod>(initial.expiry);
  const q = useDebouncedValue(query.trim(), 250);

  const data = useServiceQuery(async () => {
    const [records, payments] = await Promise.all([vehicleService.listRecords(), paymentService.list().catch(() => [])]);
    return { records, payments };
  }, []);

  const all = useMemo<Row[] | undefined>(() => {
    if (!data.data) return undefined;
    const now = Date.now();
    return data.data.records
      .map((r) => ({
        ...r,
        state: vehicleRegistrationState(r.vehicle, now),
        days: daysToExpiry(r.vehicle),
        payment: r.openApplication ? applicationPaymentState(r.openApplication, data.data!.payments) : null,
      }))
      .sort((a, b) => (a.vehicle.registrationNumber ?? "~").localeCompare(b.vehicle.registrationNumber ?? "~"));
  }, [data.data]);

  const rows = useMemo(() => all?.filter((r) => {
    const v = r.vehicle;
    if (type && v.vehicleType !== type) return false;
    if (usage && v.vehicleUsage !== usage) return false;
    if (province && v.provinceOfOperation !== province) return false;
    if (status && r.state !== status) return false;
    if (payment && r.payment !== payment) return false;
    if (txn && r.openApplication?.type !== txn) return false;
    if (!matchesExpiryPeriod(r.days, expiry)) return false;
    if (q && !recordMatches(r, q)) return false;
    return true;
  }), [all, type, usage, province, status, payment, txn, expiry, q]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!all) return <PageSkeleton />;

  const filtersOn = !!(query || type || usage || province || status || payment || txn || expiry);
  const clear = () => { setQuery(""); setType(""); setUsage(""); setProvince(""); setStatus(""); setPayment(""); setTxn(""); setExpiry(""); };
  const canRenew = can("renewal.create");

  const exportCsv = () => {
    const cols = [
      { key: "registrationNumber", label: "Registration Number" },
      { key: "plateNumber", label: "Plate Number" },
      { key: "vehicleType", label: "Vehicle Type" },
      { key: "makeModel", label: "Make / Model" },
      { key: "owner", label: "Registered Owner" },
      { key: "vin", label: "VIN / Chassis" },
      { key: "usage", label: "Vehicle Usage" },
      { key: "registered", label: "Registration Date" },
      { key: "expires", label: "Expiration Date" },
      { key: "status", label: "Registration Status" },
      { key: "payment", label: "Payment Status" },
    ];
    const out = (rows ?? []).map((r) => ({
      registrationNumber: r.vehicle.registrationNumber ?? "",
      plateNumber: r.vehicle.plateNumber ?? "",
      vehicleType: vehicleTypeLabel(r.vehicle.vehicleType),
      makeModel: `${r.vehicle.make} ${r.vehicle.model}`,
      owner: fullName(r.owner),
      vin: r.vehicle.vin || r.vehicle.chassisNumber,
      usage: vehicleUsageLabel(r.vehicle.vehicleUsage),
      registered: formatDate(r.vehicle.registrationDate),
      expires: formatDate(r.vehicle.registrationExpiry),
      status: getStatusLabel("vehicle", r.state),
      payment: r.payment ? getStatusLabel("application-payment", r.payment) : "",
    }));
    downloadText(`motor-vehicle-registry-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(cols, out));
  };

  const actions = (r: Row) => {
    const v = r.vehicle;
    const label = v.plateNumber ?? v.registrationNumber ?? v.vin;
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        <Link href={`/registry/${v.id}`} className="btn btn-s btn-sm" aria-label={`View vehicle record ${label}`}>View</Link>
        {r.openApplication?.type === "renewal" ? (
          <Link href={applicationHref(r.openApplication)} className="btn btn-g btn-sm" aria-label={`Continue renewal ${r.openApplication.transactionNumber}`}>Continue</Link>
        ) : canRenew && RENEWABLE.includes(r.state) && !r.openApplication ? (
          <Link href={`/renewals?vehicle=${v.id}`} className="btn btn-g btn-sm" aria-label={`Renew registration ${label}`}><RefreshCw size={14} aria-hidden="true" />Renew</Link>
        ) : null}
      </div>
    );
  };

  const columns: ColumnDef<Row, unknown>[] = [
    { id: "reg", header: "Registration Number", accessorFn: (r) => r.vehicle.registrationNumber ?? "", cell: ({ row }) => <Link href={`/registry/${row.original.vehicle.id}`} className="mono font-semibold whitespace-nowrap">{row.original.vehicle.registrationNumber ?? "Unregistered"}</Link> },
    { id: "plate", header: "Plate Number", accessorFn: (r) => r.vehicle.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.vehicle.plateNumber} size="sm" /> },
    { id: "type", header: "Vehicle Type", accessorFn: (r) => vehicleTypeLabel(r.vehicle.vehicleType), cell: ({ row }) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><VehicleIcon type={row.original.vehicle.vehicleType} size={16} />{vehicleTypeLabel(row.original.vehicle.vehicleType)}</span> },
    { id: "makeModel", header: "Make / Model", accessorFn: (r) => `${r.vehicle.make} ${r.vehicle.model}`, cell: ({ row }) => <span className="font-semibold">{row.original.vehicle.make} {row.original.vehicle.model}<span className="mut block text-[12px] font-normal">{row.original.vehicle.year} · {row.original.vehicle.color}</span></span> },
    { id: "owner", header: "Registered Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "vin", header: "VIN / Chassis", accessorFn: (r) => r.vehicle.vin || r.vehicle.chassisNumber, cell: ({ row }) => <span className="mono mut text-[12px]">{row.original.vehicle.vin || row.original.vehicle.chassisNumber}</span> },
    { id: "usage", header: "Vehicle Usage", accessorFn: (r) => vehicleUsageLabel(r.vehicle.vehicleUsage) },
    { id: "registered", header: "Registration Date", accessorFn: (r) => r.vehicle.registrationDate ?? "", cell: ({ row }) => <span className="mono whitespace-nowrap">{formatDate(row.original.vehicle.registrationDate)}</span> },
    { id: "expiry", header: "Expiration Date", accessorFn: (r) => r.vehicle.registrationExpiry ?? "", cell: ({ row }) => <ExpiryCell days={row.original.days} iso={row.original.vehicle.registrationExpiry} /> },
    { id: "status", header: "Registration Status", accessorFn: (r) => r.state, cell: ({ row }) => <RegistrationStatusBadge vehicle={row.original.vehicle} /> },
    {
      id: "payment",
      header: "Payment Status",
      accessorFn: (r) => r.payment ?? "",
      cell: ({ row }) => row.original.payment && row.original.openApplication ? (
        <span className="flex flex-col items-start gap-0.5">
          <StatusBadge kind="application-payment" status={row.original.payment} />
          <span className="mut text-[11.5px] whitespace-nowrap">{transactionLabel(row.original.openApplication.type, true)}</span>
        </span>
      ) : <span className="mut"><span aria-hidden="true">—</span><span className="sr">No open transaction</span></span>,
    },
    { id: "actions", header: "Actions", enableSorting: false, meta: { align: "right" }, cell: ({ row }) => actions(row.original) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Registry"
        title="Motor Vehicle Registry"
        description={`${all.length.toLocaleString("en-US")} vehicles on record · every vehicle type · all RTA offices`}
        actions={
          <>
            <button type="button" className="btn btn-s" onClick={exportCsv} disabled={!rows?.length}><Download size={16} aria-hidden="true" />Export CSV</button>
            {can("registration.create") && <Link href="/registrations/new" className="btn btn-p"><Plus size={16} aria-hidden="true" />New Vehicle Transaction</Link>}
          </>
        }
      />

      <section className="card sec" aria-label="Search and filters">
        <div className="form">
          <Field label="Search" htmlFor="reg-q" className="full" help="Registration number, plate, VIN, chassis number, engine number, owner name or phone">
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
              <Input id="reg-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. REG-NCD-25-011207, BFK 207, Mary Tau" className="!pl-10" autoComplete="off" />
            </div>
          </Field>
          <Field label="Vehicle type" htmlFor="reg-type">
            <Select id="reg-type" value={type} onChange={(e) => setType(e.target.value)} placeholder="All vehicle types" options={VEHICLE_TYPE_OPTIONS} />
          </Field>
          <Field label="Vehicle usage" htmlFor="reg-usage">
            <Select id="reg-usage" value={usage} onChange={(e) => setUsage(e.target.value)} placeholder="All uses" options={VEHICLE_USAGES.map((u) => ({ value: u.value, label: u.label }))} />
          </Field>
          <Field label="Province" htmlFor="reg-prov">
            <Select id="reg-prov" value={province} onChange={(e) => setProvince(e.target.value)} placeholder="All provinces" options={PROVINCE_NAMES} />
          </Field>
          <Field label="Registration status" htmlFor="reg-status">
            <Select id="reg-status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={VEHICLE_STATE_OPTIONS} />
          </Field>
          <Field label="Payment status" htmlFor="reg-pay">
            <Select id="reg-pay" value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Any payment status" options={PAYMENT_OPTIONS} />
          </Field>
          <Field label="Transaction type" htmlFor="reg-txn" help="Of the open transaction">
            <Select id="reg-txn" value={txn} onChange={(e) => setTxn(e.target.value)} placeholder="Any transaction" options={TRANSACTION_TYPE_OPTIONS} />
          </Field>
          <Field label="Expiration period" htmlFor="reg-exp">
            <Select id="reg-exp" value={expiry} onChange={(e) => setExpiry(parseExpiryPeriod(e.target.value))} placeholder="Any time" options={EXPIRY_PERIOD_OPTIONS} />
          </Field>
        </div>
        <div className="row justify-between">
          <p className="mut m-0 text-[13px]" aria-live="polite">{rows?.length ?? 0} of {all.length} vehicles</p>
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
            href={`/registry/${r.vehicle.id}`}
            title={r.vehicle.registrationNumber ?? "Unregistered"}
            badge={<RegistrationStatusBadge vehicle={r.vehicle} />}
            lines={[
              <span key="v" className="inline-flex items-center gap-1.5"><VehicleIcon type={r.vehicle.vehicleType} size={18} />{r.vehicle.make} {r.vehicle.model} · {vehicleTypeLabel(r.vehicle.vehicleType)}</span>,
              `${fullName(r.owner)} · ${vehicleUsageLabel(r.vehicle.vehicleUsage)}`,
              r.payment ? <span key="p" className="inline-flex items-center gap-1.5">Payment <StatusBadge kind="application-payment" status={r.payment} /></span> : `VIN ${r.vehicle.vin || r.vehicle.chassisNumber}`,
            ]}
            footer={<><PlateChip plate={r.vehicle.plateNumber} size="sm" /><span className="mut text-right text-[12px]">{r.days === null ? "No expiry" : `${formatDate(r.vehicle.registrationExpiry)} · ${expiryText(r.days)}`}</span></>}
          />
        )}
        empty={{
          title: "No registrations found",
          message: filtersOn ? "No vehicles match the current search and filters." : "There are no vehicles on the registry yet.",
          action: filtersOn ? { label: "Clear filters", onClick: clear } : undefined,
        }}
      />
    </div>
  );
}

function RegistryRoute() {
  const params = useSearchParams();
  const rawStatus = params.get("status") ?? "";
  const initial: Initial = {
    q: params.get("q") ?? "",
    status: STATE_VALUES.has(rawStatus) ? rawStatus : "",
    expiry: parseExpiryPeriod(params.get("expiry")),
  };
  // Remount when the sidebar changes the query so the filters follow the link.
  return <RegistryInner key={params.toString()} initial={initial} />;
}

export default function RegistryPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RegistryRoute />
    </Suspense>
  );
}
