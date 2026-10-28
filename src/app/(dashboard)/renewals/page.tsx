"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { formatDate, formatDateTime, formatMoney, fullName, vehicleLabel } from "@/lib/formatting";
import { calculateVehicleFees, monthsOverdue } from "@/lib/fees";
import { REGISTRATION_PERIODS } from "@/config/fee-rules";
import { inspectionRequiredFor, inspectionRuleText } from "@/config/inspection-checklists";
import { ownershipTypeLabel, isOrganization } from "@/config/ownership-types";
import { getStatusLabel, vehicleRegistrationState, type BadgeTone, type VehicleRegistrationState } from "@/config/statuses";
import { getTransactionType, transactionLabel } from "@/config/transaction-types";
import { vehicleClassLabel, vehicleTypeLabel } from "@/config/vehicle-types";
import { vehicleUsageLabel } from "@/config/vehicle-usage";
import { vehicleService } from "@/services/vehicle.service";
import { registrationService } from "@/services/registration.service";
import { assessmentService } from "@/services/assessment.service";
import { paymentService } from "@/services/payment.service";
import type { VehicleHistory, VehicleRecord } from "@/services/interfaces";
import { KpiCard, PageHeader, Section } from "@/components/ui/layout-bits";
import { Segmented } from "@/components/ui/form";
import { Alert, ErrorState, PageSkeleton, Spinner } from "@/components/ui/feedback";
import { Badge, RegistrationStatusBadge, StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { VehicleLookup } from "@/components/vehicles/vehicle-lookup";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import { PlateChip, TransactionSteps, applicationHref, applicationPaymentState, daysToExpiry, expiryText, isOpen, useStartTransaction } from "@/components/registry/renewal";
import type { FeeRule, Payment, RegistrationApplication, Vehicle } from "@/types";

type DueRow = VehicleRecord & { state: VehicleRegistrationState; days: number | null };
type AppRow = { app: RegistrationApplication; record: VehicleRecord | undefined };
type Obligation = { key: string; label: string; detail: string; amount?: number; status: string; tone: BadgeTone };

const RENEWABLE: VehicleRegistrationState[] = ["active", "expiring_soon", "expired"];

function Verdict({ tone, title, children }: { tone: "ok" | "warn" | "bad"; title: string; children: React.ReactNode }) {
  const cls = { ok: "border-[#bfe6cd] bg-[#e9f7ef] text-[#0b4f25]", warn: "border-[#f2de85] bg-[#fff8d6] text-[#4d3900]", bad: "border-[#f4c3c5] bg-[#fdecec] text-[#7a0c13]" }[tone];
  return (
    <div className={`rounded-[10px] border p-3.5 ${cls}`} role="status">
      <p className="m-0 text-[16px] font-extrabold">{title}</p>
      <div className="m-0 mt-1 text-[13px] leading-normal">{children}</div>
    </div>
  );
}

/** Selected vehicle: registration check, obligations, fee preview and the next action. */
function RenewalCheck({ record, history, rules, payments, onReset }: { record: VehicleRecord; history: VehicleHistory | null | undefined; rules: FeeRule[]; payments: Payment[]; onReset: () => void }) {
  const { can } = useDemoUser();
  const txn = useStartTransaction();
  const [period, setPeriod] = useState(String(REGISTRATION_PERIODS[0]?.months ?? 12));
  const [alreadyRenewed, setAlreadyRenewed] = useState<string | null>(null);
  const v: Vehicle = history?.record.vehicle ?? record.vehicle;
  const owner = history?.record.owner ?? record.owner;
  const openApp = history ? history.record.openApplication : record.openApplication;
  const state = vehicleRegistrationState(v);
  const days = daysToExpiry(v);
  const overdue = monthsOverdue(v.registrationExpiry);
  const inspectionRequired = inspectionRequiredFor({ transactionType: "renewal", vehicleType: v.vehicleType });
  const insuranceRequired = getTransactionType("renewal").insurance;

  const fees = useMemo(() => calculateVehicleFees({
    transactionType: "renewal",
    vehicleType: v.vehicleType,
    vehicleClass: v.vehicleClass,
    vehicleUsage: v.vehicleUsage,
    specifications: v.specifications,
    registrationPeriodMonths: Number(period),
    inspectionRequired,
    newPlate: false,
    monthsOverdue: overdue,
    rules,
  }), [v, period, inspectionRequired, overdue, rules]);

  const latestIns = history?.insurance[0];
  const insuranceValid = !!latestIns && latestIns.status === "verified" && new Date(latestIns.coverageExpiry).getTime() >= Date.now();
  const lastRenewal = history?.applications.filter((a) => a.type === "renewal" && a.status === "registered").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
  const penalty = fees.lines.filter((l) => l.component === "penalty").reduce((s, l) => s + l.amount, 0);
  const openPay = openApp ? applicationPaymentState(openApp, payments) : null;

  const obligations: Obligation[] = [
    penalty > 0
      ? { key: "pen", label: "Late renewal penalty", detail: `${overdue} month${overdue === 1 ? "" : "s"} past expiry`, amount: penalty, status: "Added to renewal", tone: "payq" }
      : { key: "pen", label: "Penalties", detail: "None", amount: 0, status: "Clear", tone: "ok" },
    openApp
      ? { key: "open", label: "Open transaction", detail: `${transactionLabel(openApp.type)} ${openApp.transactionNumber} · ${getStatusLabel("registration", openApp.status)}`, status: openApp.type === "renewal" ? "In progress" : "Blocks renewal", tone: openApp.type === "renewal" ? "pend" : "bad" }
      : { key: "open", label: "Open transactions", detail: "None", status: "Clear", tone: "ok" },
    openApp?.assessment && (openPay === "unpaid" || openPay === "failed")
      ? { key: "bal", label: "Outstanding balance", detail: `Unpaid assessment on ${openApp.transactionNumber}`, amount: openApp.assessment.total, status: "Arrears", tone: "bad" }
      : { key: "bal", label: "Outstanding balance", detail: "None", amount: 0, status: "Clear", tone: "ok" },
    { key: "ins", label: "Insurance", detail: !insuranceRequired ? "Not required for renewal" : latestIns ? `${latestIns.provider} · ${getStatusLabel("insurance", latestIns.status)} · exp. ${formatDate(latestIns.coverageExpiry)}` : "No policy on record", status: !insuranceRequired || insuranceValid ? "OK" : "Required at renewal", tone: !insuranceRequired || insuranceValid ? "ok" : "payq" },
    { key: "insp", label: "Inspection", detail: inspectionRuleText(v.vehicleType, "renewal"), status: inspectionRequired ? "Required" : "Not required", tone: inspectionRequired ? "insp" : "ok" },
  ];

  const canCreate = can("renewal.create");
  const proceed = async () => {
    setAlreadyRenewed(null);
    const r = await txn.start("renewal", v.id);
    if (r.error && /already renewed/i.test(r.error)) setAlreadyRenewed(r.error);
  };
  const busy = txn.busy?.vehicleId === v.id;

  let next: React.ReactNode;
  if (state === "deregistered") {
    next = <Verdict tone="bad" title="Vehicle deregistered">This vehicle has been removed from the registry and cannot be renewed.</Verdict>;
  } else if (state === "unregistered") {
    next = <Verdict tone="bad" title="No registration to renew">This vehicle has never completed a registration. Start a new vehicle registration instead.</Verdict>;
  } else if (state === "suspended" || state === "cancelled") {
    next = (
      <>
        <Verdict tone="bad" title="Renewal blocked">The registration is {getStatusLabel("vehicle", state).toLowerCase()}{v.statusReason ? ` — ${v.statusReason}` : ""}. Resolve the registration issue (reinstatement) before renewing.</Verdict>
        <button type="button" className="btn btn-p btn-xl w-full" disabled>Proceed to Renewal</button>
        {can("registration.create") && (
          <button type="button" className="btn btn-d btn-lg w-full" disabled={!!txn.busy || !!openApp} onClick={() => txn.start("reinstatement", v.id)}>
            {txn.busy?.type === "reinstatement" ? <span className="spin" aria-hidden="true" /> : <ShieldAlert size={18} aria-hidden="true" />}Resolve Registration Issue
          </button>
        )}
      </>
    );
  } else if (openApp) {
    next = (
      <>
        <Verdict tone={openApp.type === "renewal" ? "warn" : "bad"} title={openApp.type === "renewal" ? "Renewal already in progress" : "Another transaction is open"}>
          {transactionLabel(openApp.type)} <span className="mono font-semibold">{openApp.transactionNumber}</span> is {getStatusLabel("registration", openApp.status).toLowerCase()}. Finish or cancel it first.
        </Verdict>
        <Link href={applicationHref(openApp)} className="btn btn-p btn-lg w-full">Open {openApp.transactionNumber}</Link>
      </>
    );
  } else {
    next = (
      <>
        {alreadyRenewed ? (
          <Verdict tone="ok" title="Registration already renewed">{alreadyRenewed}</Verdict>
        ) : state === "expired" ? (
          <Verdict tone="warn" title={penalty > 0 ? "Renewal allowed with penalty" : "Renewal allowed"}>Registration expired {formatDate(v.registrationExpiry)}.{penalty > 0 ? ` A late penalty of ${formatMoney(penalty)} is included in the fee.` : ""}{inspectionRequired ? " Inspection must pass first." : ""}</Verdict>
        ) : (
          <Verdict tone="ok" title="Ready to renew">No issues found.{inspectionRequired ? " An inspection is required during the renewal." : ""}</Verdict>
        )}
        {canCreate ? (
          <button type="button" className="btn btn-p btn-xl w-full" disabled={!!txn.busy || !!alreadyRenewed || !RENEWABLE.includes(state)} onClick={proceed}>
            <RefreshCw size={18} aria-hidden="true" className={busy && txn.busy?.type === "renewal" ? "animate-spin" : ""} />
            {busy && txn.busy?.type === "renewal" ? "Starting renewal…" : "Proceed to Renewal"}
          </button>
        ) : <Alert tone="info" title="View only">Your role can view renewals but cannot start them.</Alert>}
      </>
    );
  }

  return (
    <div className="split">
      <div className="l flex flex-col gap-4">
        <section className="card overflow-hidden" aria-label="Existing registration">
          <div className="flex flex-wrap items-center gap-5 border-b border-[#e1e4ea] px-6 py-5 max-[760px]:px-4">
            <PlateChip plate={v.plateNumber} size="md" />
            <div className="min-w-0 flex-[1_1_260px]">
              <p className="h2 m-0">{vehicleLabel(v)} · {v.color}</p>
              <p className="mut m-0 mt-1 text-[14px]">
                <VehicleIcon type={v.vehicleType} size={16} className="mr-1 inline align-[-3px]" />
                {vehicleTypeLabel(v.vehicleType)} · {vehicleClassLabel(v.vehicleType, v.vehicleClass)} · <span className="mono">{v.registrationNumber ?? "Unregistered"}</span>
              </p>
            </div>
            <div className="row gap-2">
              <Link href={`/registry/${v.id}`} className="btn btn-s btn-sm">Full record</Link>
              <button type="button" className="btn btn-g btn-sm" onClick={onReset}>Change vehicle</button>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))]">
            <div className="border-r border-b border-[#edeff3] px-6 py-4"><p className="eb">Registration status</p><div className="mt-2"><RegistrationStatusBadge vehicle={v} /></div></div>
            <div className="border-r border-b border-[#edeff3] px-6 py-4"><p className="eb">Expiration date</p><p className="m-0 mt-1.5 text-[16px] font-bold">{formatDate(v.registrationExpiry)}</p><p className={`m-0 text-[12.5px] ${days !== null && days < 0 ? "text-[#a3111a]" : "mut"}`}>{expiryText(days)}</p></div>
            <div className="border-r border-b border-[#edeff3] px-6 py-4"><p className="eb">Inspection requirement</p><p className="m-0 mt-1.5 text-[14px] font-bold">{inspectionRuleText(v.vehicleType, "renewal")}</p></div>
            <div className="border-b border-[#edeff3] px-6 py-4"><p className="eb">Renewal fee (preview)</p><p className="m-0 mt-1.5 text-[18px] font-extrabold">{formatMoney(fees.total)}</p>{fees.containsSampleAmounts && <Badge tone="soon">Sample</Badge>}</div>
          </div>
          <div className="g2 px-6 py-5 max-[760px]:px-4">
            <dl className="dl text-[13px]">
              <dt>Registered owner</dt><dd>{fullName(owner)}{owner ? ` (${ownershipTypeLabel(owner.ownershipType)})` : ""}</dd>
              <dt>Owner ID</dt><dd className="mono">{owner ? (isOrganization(owner.ownershipType) ? owner.organizationRegistrationNumber ?? owner.identificationNumber : owner.identificationNumber) : "—"}</dd>
              <dt>Contact</dt><dd className="mono">{owner?.businessPhone ?? owner?.mobile ?? "—"}</dd>
              <dt>Vehicle use</dt><dd>{vehicleUsageLabel(v.vehicleUsage)}</dd>
            </dl>
            <dl className="dl text-[13px]">
              <dt>VIN / chassis</dt><dd className="mono">{v.vin || v.chassisNumber}</dd>
              <dt>Engine</dt><dd className="mono">{v.engineNumber || "Not applicable"}</dd>
              <dt>Insurance</dt><dd>{insuranceRequired ? (latestIns ? `${getStatusLabel("insurance", latestIns.status)} · to ${formatDate(latestIns.coverageExpiry)}` : history === undefined ? "Checking…" : "Required — none on record") : "Not required"}</dd>
              <dt>Last renewal</dt><dd>{lastRenewal ? formatDate(lastRenewal.completedAt) : "First registration period"}</dd>
            </dl>
          </div>
        </section>

        <section className="card overflow-hidden" aria-labelledby="obl-h">
          <div className="border-b border-[#e1e4ea] px-[22px] py-4"><h2 id="obl-h" className="h3">Penalties &amp; outstanding obligations</h2></div>
          <div className="overflow-x-auto">
            <table className="tbl text-[14px]">
              <thead className="sr"><tr><th>Obligation</th><th>Detail</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {obligations.map((o) => (
                  <tr key={o.key}>
                    <td className="font-semibold">{o.label}</td>
                    <td className="mut">{o.detail}</td>
                    <td className="num font-semibold">{o.amount === undefined ? "—" : formatMoney(o.amount)}</td>
                    <td><Badge tone={o.tone}>{o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Section title="Renewal fee preview" description="Calculated from the configurable fee rules. The final assessment is generated inside the renewal transaction." actions={
          <Segmented label="Registration period" value={period} onChange={setPeriod} options={REGISTRATION_PERIODS.map((p) => ({ value: String(p.months), label: p.label }))} />
        }>
          <FeeBreakdown assessment={{ lines: fees.lines, total: fees.total, containsSampleAmounts: fees.containsSampleAmounts }} />
        </Section>
      </div>

      <div className="r">
        <section className="card sec gap-3.5" aria-label="Next action">
          <p className="eb">Next action</p>
          {next}
          <p className="help m-0">Renewal steps: verify owner &amp; vehicle → inspection (if required) → insurance → fees → payment → approval → issue.</p>
        </section>
      </div>
    </div>
  );
}

function RenewalsInner({ initialVehicleId }: { initialVehicleId: string | null }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(initialVehicleId);
  const [picked, setPicked] = useState<VehicleRecord | null>(null);

  const data = useServiceQuery(async () => {
    const [records, renewals, rules, payments] = await Promise.all([
      vehicleService.listRecords(),
      registrationService.list({ type: "renewal" }),
      assessmentService.listFeeRules(),
      paymentService.list().catch(() => [] as Payment[]),
    ]);
    return { records, renewals, rules, payments };
  }, []);

  const history = useServiceQuery(async () => (selectedId ? vehicleService.getHistory(selectedId) : null), [selectedId]);

  const derived = useMemo(() => {
    if (!data.data) return null;
    const { records, renewals } = data.data;
    const byId = new Map(records.map((r) => [r.vehicle.id, r]));
    const now = Date.now();
    const due: DueRow[] = records
      .map((r) => ({ ...r, state: vehicleRegistrationState(r.vehicle, now), days: daysToExpiry(r.vehicle) }))
      .filter((r) => r.state === "expiring_soon" || r.state === "expired")
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));
    const open: AppRow[] = renewals.filter(isOpen).map((app) => ({ app, record: app.vehicleId ? byId.get(app.vehicleId) : undefined }));
    return { byId, due, open, expired: due.filter((r) => r.state === "expired").length, expiring: due.filter((r) => r.state === "expiring_soon").length };
  }, [data.data]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!derived || !data.data) return <PageSkeleton />;

  const selected = selectedId ? derived.byId.get(selectedId) ?? (picked?.vehicle.id === selectedId ? picked : null) : null;

  const select = (r: VehicleRecord) => {
    setPicked(r);
    setSelectedId(r.vehicle.id);
    router.replace(`/renewals?vehicle=${r.vehicle.id}`, { scroll: false });
    requestAnimationFrame(() => document.getElementById("renewal-check")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const reset = () => {
    setSelectedId(null);
    setPicked(null);
    router.replace("/renewals", { scroll: false });
  };

  const dueCols: ColumnDef<DueRow, unknown>[] = [
    { id: "plate", header: "Plate", accessorFn: (r) => r.vehicle.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.vehicle.plateNumber} size="sm" /> },
    { id: "reg", header: "Registration No.", accessorFn: (r) => r.vehicle.registrationNumber ?? "", cell: ({ row }) => <Link href={`/registry/${row.original.vehicle.id}`} className="mono font-semibold">{row.original.vehicle.registrationNumber ?? "—"}</Link> },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.vehicle), cell: ({ row }) => <span className="inline-flex items-center gap-1.5"><VehicleIcon type={row.original.vehicle.vehicleType} size={16} />{vehicleLabel(row.original.vehicle)}<span className="mut text-[12px]">· {vehicleTypeLabel(row.original.vehicle.vehicleType)}</span></span> },
    { id: "owner", header: "Registered Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "expiry", header: "Expiry", accessorFn: (r) => r.days ?? 0, cell: ({ row }) => <span className="flex flex-col"><span className="mono">{formatDate(row.original.vehicle.registrationExpiry)}</span><span className={`text-[12px] ${row.original.days !== null && row.original.days < 0 ? "text-[#a3111a]" : "mut"}`}>{expiryText(row.original.days)}</span></span> },
    { id: "status", header: "Status", accessorFn: (r) => r.state, cell: ({ row }) => <RegistrationStatusBadge vehicle={row.original.vehicle} /> },
    {
      id: "action", header: "Action", enableSorting: false, cell: ({ row }) => row.original.openApplication
        ? <Link href={applicationHref(row.original.openApplication)} className="btn btn-s btn-sm">Open {row.original.openApplication.transactionNumber}</Link>
        : <button type="button" className="btn btn-p btn-sm" onClick={() => select(row.original)} aria-label={`Check renewal for ${row.original.vehicle.plateNumber ?? row.original.vehicle.registrationNumber}`}>Check renewal</button>,
    },
  ];

  const appCols: ColumnDef<AppRow, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={applicationHref(row.original.app)} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "plate", header: "Plate", accessorFn: (r) => r.record?.vehicle.plateNumber ?? "", cell: ({ row }) => <PlateChip plate={row.original.record?.vehicle.plateNumber} size="sm" /> },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.record?.vehicle), cell: ({ row }) => row.original.record ? <span>{vehicleLabel(row.original.record.vehicle)}<span className="mut block text-[12px]">{vehicleTypeLabel(row.original.record.vehicle.vehicleType)}</span></span> : "—" },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.record?.owner) },
    { id: "status", header: "Status", accessorFn: (r) => r.app.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "payment", header: "Payment", accessorFn: (r) => applicationPaymentState(r.app, data.data!.payments), cell: ({ row }) => <StatusBadge kind="application-payment" status={applicationPaymentState(row.original.app, data.data!.payments)} /> },
    { id: "updated", header: "Updated", accessorFn: (r) => r.app.updatedAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.app.updatedAt)}</span> },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => <Link href={applicationHref(row.original.app)} className="btn btn-s btn-sm">Continue</Link> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Vehicle transactions" title="Registration renewal" description="Any motor vehicle type — the existing record is checked before a renewal starts. A renewal never overwrites history." />

      <Section title="Renewal workflow"><TransactionSteps type="renewal" current={selected ? 1 : 0} /></Section>

      <VehicleLookup onSelect={select} selectedId={selectedId ?? undefined} actionLabel="Check renewal" title="Find vehicle record" />

      <div id="renewal-check" className="scroll-mt-4">
        {selectedId && !selected && (history.loading || data.loading) && <div className="card p-6"><Spinner label="Loading vehicle record…" /></div>}
        {selectedId && !selected && !history.loading && !data.loading && (
          history.data
            ? <RenewalCheck key={history.data.record.vehicle.id} record={history.data.record} history={history.data} rules={data.data.rules} payments={data.data.payments} onReset={reset} />
            : <Alert tone="bad" title="No vehicle found" action={<button type="button" className="btn btn-s btn-sm min-h-[44px]" onClick={reset}>Clear</button>}>The linked vehicle record could not be found. Search by registration number, plate, VIN, chassis or engine number.</Alert>
        )}
        {selected && (
          <RenewalCheck
            key={selected.vehicle.id}
            record={selected}
            history={history.data?.record.vehicle.id === selected.vehicle.id ? history.data : undefined}
            rules={data.data.rules}
            payments={data.data.payments}
            onReset={reset}
          />
        )}
      </div>

      <div className="g3">
        <KpiCard tone="danger" label="Expired registrations" value={derived.expired} href="/registry?status=expired" footer="Past expiry date — renewal overdue" />
        <KpiCard label="Expiring within 30 days" value={derived.expiring} href="/registry?status=expiring_soon" footer="Due for renewal soon" />
        <KpiCard label="Renewals in progress" value={derived.open.length} footer="Open renewal transactions" />
      </div>

      <Section title="Renewals due" description="Expired registrations and registrations expiring within 30 days.">
        <div className="-mx-6 -mb-[22px] max-[760px]:-mx-4 max-[760px]:-mb-[18px]">
          <DataTable
            storageKey="renewals-due"
            data={derived.due}
            loading={data.loading}
            columns={dueCols}
            mobileCard={(r) => (
              <div className="card flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <PlateChip plate={r.vehicle.plateNumber} size="sm" />
                  <RegistrationStatusBadge vehicle={r.vehicle} />
                </div>
                <Link href={`/registry/${r.vehicle.id}`} className="text-[15px] font-bold text-[#0b0b0f]">{vehicleLabel(r.vehicle)} · {vehicleTypeLabel(r.vehicle.vehicleType)}</Link>
                <p className="mut m-0 text-[13px]">{fullName(r.owner)} · <span className="mono">{r.vehicle.registrationNumber}</span></p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edeff3] pt-2.5">
                  <span className={`text-[12.5px] ${r.days !== null && r.days < 0 ? "text-[#a3111a]" : "mut"}`}>{formatDate(r.vehicle.registrationExpiry)} · {expiryText(r.days)}</span>
                  {r.openApplication
                    ? <Link href={applicationHref(r.openApplication)} className="btn btn-s btn-sm min-h-[44px]">Open transaction</Link>
                    : <button type="button" className="btn btn-p btn-sm min-h-[44px]" onClick={() => select(r)}>Check renewal</button>}
                </div>
              </div>
            )}
            empty={{ title: "Nothing due for renewal", message: "No registrations are expired or expiring within 30 days. Search above to renew any registered vehicle." }}
          />
        </div>
      </Section>

      <Section title="Open renewal applications" description="Renewal transactions in progress — continue in the registration workflow.">
        <div className="-mx-6 -mb-[22px] max-[760px]:-mx-4 max-[760px]:-mb-[18px]">
          <DataTable
            storageKey="renewals-open"
            data={derived.open}
            columns={appCols}
            mobileCard={(r) => <MobileCard href={applicationHref(r.app)} title={r.app.transactionNumber} badge={<StatusBadge kind="registration" status={r.app.status} />} lines={[fullName(r.record?.owner), `${vehicleLabel(r.record?.vehicle)}${r.record?.vehicle.plateNumber ? ` · ${r.record.vehicle.plateNumber}` : ""}`]} footer={<span className="mut text-[12px]">Updated {formatDateTime(r.app.updatedAt)}</span>} />}
            empty={{ title: "No renewals in progress", message: "Find a vehicle above to start a renewal." }}
          />
        </div>
      </Section>
    </div>
  );
}

function RenewalsRoute() {
  const params = useSearchParams();
  return <RenewalsInner initialVehicleId={params.get("vehicle")} />;
}

export default function RenewalsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RenewalsRoute />
    </Suspense>
  );
}
