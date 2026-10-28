"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { friendlyError } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { calculateVehicleFees } from "@/lib/fees";
import { getStatusLabel, vehicleRegistrationState, type VehicleRegistrationState } from "@/config/statuses";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { vehicleUsageLabel } from "@/config/vehicle-usage";
import { vehicleService } from "@/services/vehicle.service";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import { assessmentService } from "@/services/assessment.service";
import type { VehicleRecord } from "@/services/interfaces";
import { PageHeader, Section } from "@/components/ui/layout-bits";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { Badge, RegistrationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { CheckRow, OwnerCard } from "@/components/registrations/cards";
import { VehicleLookup } from "@/components/vehicles/vehicle-lookup";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import { PlateChip, TransactionSteps, applicationHref, daysToExpiry, expiryText, isOpen } from "@/components/registry/renewal";
import { EMPTY_SALE_DETAILS, SaleDetailsForm, transferReasonLabel, validateSaleDetails, type SaleDetailsErrors, type SaleDetailsValues } from "@/components/transfers/sale-details";
import type { FeeRule, Owner, RegistrationApplication } from "@/types";

const CURRENT: VehicleRegistrationState[] = ["active", "expiring_soon"];

type TransferRow = { app: RegistrationApplication; record: VehicleRecord | undefined; seller: string; buyer: string };

/** Selected vehicle: registration verification, current owner and sale details. */
function TransferStart({ record, rules, onReset }: { record: VehicleRecord; rules: FeeRule[]; onReset: () => void }) {
  const router = useRouter();
  const { can } = useDemoUser();
  const [values, setValues] = useState<SaleDetailsValues>(EMPTY_SALE_DETAILS);
  const [errors, setErrors] = useState<SaleDetailsErrors>({});
  const [busy, setBusy] = useState(false);
  const { vehicle: v, owner, openApplication: openApp } = record;
  const state = vehicleRegistrationState(v);
  const days = daysToExpiry(v);

  const checks = [
    { ok: CURRENT.includes(state), label: "Registration active", detail: CURRENT.includes(state) ? `Valid to ${formatDate(v.registrationExpiry)} · ${expiryText(days)}` : `Current status: ${getStatusLabel("vehicle", state)}` },
    { ok: !["suspended", "cancelled", "deregistered"].includes(state), label: "Not suspended, cancelled or deregistered", detail: v.statusReason },
    { ok: !openApp, label: "No open transaction on this vehicle", detail: openApp ? `${transactionLabel(openApp.type)} ${openApp.transactionNumber} · ${getStatusLabel("registration", openApp.status)}` : undefined },
    { ok: !!owner, label: "Registered owner on record", detail: owner ? fullName(owner) : "Owner record missing" },
  ];
  const blocked = checks.some((c) => !c.ok);
  const canCreate = can("transfer.create");

  const fees = useMemo(() => calculateVehicleFees({
    transactionType: "transfer",
    vehicleType: v.vehicleType,
    vehicleClass: v.vehicleClass,
    vehicleUsage: v.vehicleUsage,
    specifications: v.specifications,
    inspectionRequired: false,
    newPlate: false,
    monthsOverdue: 0,
    rules,
  }), [v, rules]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner || blocked) return;
    const result = validateSaleDetails(values);
    if ("errors" in result) {
      setErrors(result.errors);
      const first = Object.keys(result.errors)[0];
      const focusId = first === "saleDate" ? "tr-date" : first === "salePrice" ? "tr-price" : first === "reason" ? "tr-reason" : "tr-consent";
      document.getElementById(focusId)?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    let app: RegistrationApplication;
    try {
      app = await registrationService.createForVehicle("transfer", v.id);
    } catch (err) {
      toast.error("Transfer not started", { description: friendlyError(err, "The transfer could not be started.") });
      setBusy(false);
      return;
    }
    try {
      await registrationService.setTransfer(app.id, { previousOwnerId: owner.id, ...result.data });
      toast.success(`Transfer ${app.transactionNumber} started`, { description: "Now capture the new owner. The seller is kept as a previous owner." });
    } catch (err) {
      toast.error("Sale details not saved", { description: `${friendlyError(err)} You can re-enter them in ${app.transactionNumber}.` });
    }
    router.push(`/registrations/new?id=${app.id}&step=2`);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-wrap items-center gap-5 px-[22px] py-[18px] max-[760px]:px-4" aria-label="Selected vehicle">
        <PlateChip plate={v.plateNumber} size="md" />
        <div className="min-w-0 flex-[1_1_300px]">
          <p className="h3">{vehicleLabel(v)} · {v.color}</p>
          <p className="mut m-0 mt-0.5 text-[13px]">
            <VehicleIcon type={v.vehicleType} size={15} className="mr-1 inline align-[-2px]" />
            {vehicleTypeLabel(v.vehicleType)} · {vehicleClassLabel(v.vehicleType, v.vehicleClass)} · {vehicleUsageLabel(v.vehicleUsage)} · <span className="mono">{v.registrationNumber ?? "Unregistered"}</span> · VIN <span className="mono">{v.vin || v.chassisNumber}</span>
          </p>
        </div>
        <div className="row gap-2">
          <RegistrationStatusBadge vehicle={v} />
          <Link href={`/registry/${v.id}`} className="btn btn-s btn-sm">Full record</Link>
          <button type="button" className="btn btn-g btn-sm" onClick={onReset}>Change vehicle</button>
        </div>
      </section>

      {state === "expired" && (
        <Alert tone="bad" title="Registration expired" action={can("renewal.create") ? <Link href={`/renewals?vehicle=${v.id}`} className="btn btn-s btn-sm min-h-[44px]">Renew first</Link> : undefined}>
          The registration expired on {formatDate(v.registrationExpiry)}. Renew the registration before transferring ownership.
        </Alert>
      )}
      {(state === "suspended" || state === "cancelled") && (
        <Alert tone="bad" title={`Registration ${getStatusLabel("vehicle", state).toLowerCase()}`}>
          {v.statusReason ? `${v.statusReason}. ` : ""}A {state} registration cannot be transferred. Resolve the registration issue (reinstatement) first.
        </Alert>
      )}
      {state === "deregistered" && <Alert tone="bad" title="Vehicle deregistered">This vehicle has been removed from the registry and cannot be transferred.</Alert>}
      {state === "unregistered" && <Alert tone="bad" title="No registration found">This vehicle has never been registered, so there is no registration to transfer.</Alert>}
      {openApp && (
        <Alert tone="warn" title={`${transactionLabel(openApp.type)} ${openApp.transactionNumber} is open`} action={<Link href={applicationHref(openApp)} className="btn btn-s btn-sm min-h-[44px]">Open transaction</Link>}>
          Finish or cancel the open transaction before starting a transfer of ownership.
        </Alert>
      )}

      <div className="split">
        <div className="l flex flex-col gap-4">
          {owner ? (
            <OwnerCard owner={owner} title="Current owner (seller)" actions={<Badge tone="draft">Will become previous owner</Badge>} />
          ) : (
            <Alert tone="bad" title="Registered owner not found">The owner linked to this vehicle could not be loaded.</Alert>
          )}

          <section className="card sec" aria-labelledby="sale-h">
            <div className="sechd">
              <div className="min-w-0">
                <h2 id="sale-h" className="h3">Sale details</h2>
                <p className="mut m-0 mt-0.5 text-[13px]">Recorded on the transfer. The new owner (buyer) is captured on the next step.</p>
              </div>
            </div>
            {!canCreate ? (
              <Alert tone="info" title="View only">Your role can view transfers but cannot start them.</Alert>
            ) : blocked ? (
              <p className="mut m-0 text-[13.5px]">Resolve the verification issues above before entering the sale details.</p>
            ) : (
              <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                <SaleDetailsForm values={values} errors={errors} onChange={setValues} disabled={busy} />
                <div className="row justify-end">
                  <button type="submit" className="btn btn-p btn-lg" disabled={busy}>
                    {busy ? <span className="spin" aria-hidden="true" /> : null}
                    Continue to New Owner
                    {!busy && <ArrowRight size={18} aria-hidden="true" />}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="r flex flex-col gap-4">
          <section className="card sec gap-3" aria-labelledby="verify-h">
            <p id="verify-h" className="eb">Registration verification</p>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {checks.map((c) => <CheckRow key={c.label} ok={c.ok} label={c.label} detail={c.detail} />)}
            </ul>
            {blocked ? <Badge tone="bad">Transfer blocked</Badge> : <Badge tone="ok">Eligible for transfer</Badge>}
          </section>
          <Section title="Indicative fees" description="Final fees are assessed in the transfer transaction.">
            <FeeBreakdown assessment={{ lines: fees.lines, total: fees.total, containsSampleAmounts: fees.containsSampleAmounts }} compact showBasis={false} />
          </Section>
          <section className="card sec gap-2" aria-label="After approval">
            <p className="eb">After approval</p>
            <p className="m-0 text-[13px] leading-normal">The registered owner changes to the buyer, the plate stays with the vehicle and an updated Motor Vehicle Registration Certificate is issued. {owner ? fullName(owner) : "The seller"} is kept as a previous owner in the vehicle record and audit trail.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function TransfersInner({ initialVehicleId }: { initialVehicleId: string | null }) {
  const router = useRouter();
  const { can } = useDemoUser();
  const [selectedId, setSelectedId] = useState<string | null>(initialVehicleId);
  const [picked, setPicked] = useState<VehicleRecord | null>(null);

  const data = useServiceQuery(async () => {
    const [records, transfers, owners, rules] = await Promise.all([
      vehicleService.listRecords(),
      registrationService.list({ type: "transfer" }),
      ownerService.list().catch(() => [] as Owner[]),
      assessmentService.listFeeRules(),
    ]);
    return { records, transfers, owners, rules };
  }, []);

  const derived = useMemo(() => {
    if (!data.data) return null;
    const { records, transfers, owners } = data.data;
    const byId = new Map(records.map((r) => [r.vehicle.id, r]));
    const ownerName = (id?: string) => (id ? fullName(owners.find((o) => o.id === id)) : "Not captured yet");
    const rows: TransferRow[] = transfers.map((app) => ({
      app,
      record: app.vehicleId ? byId.get(app.vehicleId) : undefined,
      seller: ownerName(app.transfer?.previousOwnerId ?? app.ownerId),
      buyer: ownerName(app.transfer?.newOwnerId),
    }));
    return { byId, rows, open: rows.filter((r) => isOpen(r.app)).length };
  }, [data.data]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!derived || !data.data) return <PageSkeleton />;

  const selected = selectedId ? derived.byId.get(selectedId) ?? (picked?.vehicle.id === selectedId ? picked : null) : null;

  const select = (r: VehicleRecord) => {
    setPicked(r);
    setSelectedId(r.vehicle.id);
    router.replace(`/transfers?vehicle=${r.vehicle.id}`, { scroll: false });
    requestAnimationFrame(() => document.getElementById("transfer-start")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const reset = () => {
    setSelectedId(null);
    setPicked(null);
    router.replace("/transfers", { scroll: false });
  };

  const cols: ColumnDef<TransferRow, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={applicationHref(row.original.app)} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "plate", header: "Plate", accessorFn: (r) => r.record?.vehicle.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.record?.vehicle.plateNumber ?? row.original.app.plateNumber} size="sm" /> },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.record?.vehicle), cell: ({ row }) => row.original.record ? <span>{vehicleLabel(row.original.record.vehicle)}<span className="mut block text-[12px]">{vehicleTypeLabel(row.original.record.vehicle.vehicleType)}</span></span> : "—" },
    { id: "seller", header: "Seller (previous owner)", accessorFn: (r) => r.seller },
    { id: "buyer", header: "Buyer (new owner)", accessorFn: (r) => r.buyer, cell: ({ row }) => <span className={row.original.app.transfer?.newOwnerId ? "" : "mut"}>{row.original.buyer}</span> },
    { id: "sale", header: "Sale", accessorFn: (r) => r.app.transfer?.saleDate ?? "", cell: ({ row }) => { const t = row.original.app.transfer; return t?.saleDate ? <span>{transferReasonLabel(t.reason)} · <span className="mono">{formatDate(t.saleDate)}</span>{t.salePrice !== undefined && <span className="mut block text-[12px]">{formatMoney(t.salePrice)}</span>}</span> : <span className="mut">—</span>; } },
    { id: "status", header: "Status", accessorFn: (r) => r.app.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "updated", header: "Updated", accessorFn: (r) => r.app.updatedAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.app.updatedAt)}</span> },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={applicationHref(row.original.app)} className="btn btn-s btn-sm">{isOpen(row.original.app) ? "Continue" : "View"}</Link> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Vehicle transactions" title="Transfer of ownership" description="Verify the existing registration and record the sale. The current owner is kept as a previous owner — ownership history is never overwritten." />

      <Section title="Transfer workflow"><TransactionSteps type="transfer" current={selected ? 2 : 0} /></Section>

      {!can("transfer.create") && <Alert tone="info" title="View only">Your role can view transfers but cannot start them.</Alert>}

      <VehicleLookup onSelect={select} selectedId={selectedId ?? undefined} actionLabel="Select for transfer" title="Find the existing vehicle record" />

      <div id="transfer-start" className="scroll-mt-4">
        {selected && <TransferStart key={selected.vehicle.id} record={selected} rules={data.data.rules} onReset={reset} />}
        {selectedId && !selected && (
          <Alert tone="bad" title="No vehicle found" action={<button type="button" className="btn btn-s btn-sm min-h-[44px]" onClick={reset}>Clear</button>}>
            The linked vehicle record could not be found. Search by registration number, plate, VIN, chassis or engine number.
          </Alert>
        )}
      </div>

      <Section title="Transfer applications" description={`${derived.open} in progress · ${derived.rows.length} in total`}>
        <div className="-mx-6 -mb-[22px] max-[760px]:-mx-4 max-[760px]:-mb-[18px]">
          <DataTable
            storageKey="transfers"
            data={derived.rows}
            loading={data.loading}
            columns={cols}
            mobileCard={(r) => (
              <MobileCard
                href={applicationHref(r.app)}
                title={r.app.transactionNumber}
                badge={<StatusBadge kind="registration" status={r.app.status} />}
                lines={[`${vehicleLabel(r.record?.vehicle)}${r.record?.vehicle.plateNumber ? ` · ${r.record.vehicle.plateNumber}` : ""}`, `${r.seller} → ${r.buyer}`]}
                footer={<span className="mut text-[12px]">Updated {formatDateTime(r.app.updatedAt)}</span>}
              />
            )}
            empty={{ title: "No transfers yet", message: "Find a vehicle above to start a transfer of ownership." }}
          />
        </div>
      </Section>
    </div>
  );
}

function TransfersRoute() {
  const params = useSearchParams();
  return <TransfersInner initialVehicleId={params.get("vehicle")} />;
}

export default function TransfersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TransfersRoute />
    </Suspense>
  );
}
