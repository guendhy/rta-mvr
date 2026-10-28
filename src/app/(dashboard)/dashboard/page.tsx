"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeftRight, Plus, RefreshCw, Smartphone } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { formatDateTime, formatMoney, fullName, shortName, vehicleLabel } from "@/lib/formatting";
import { transactionLabel } from "@/config/transaction-types";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { vehicleUsageLabel } from "@/config/vehicle-usage";
import { reportService } from "@/services/report.service";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import { vehicleService } from "@/services/vehicle.service";
import { paymentService } from "@/services/payment.service";
import { posService } from "@/services/pos.service";
import { notificationService } from "@/services/notification.service";
import type { DashboardStats, Owner, RegistrationApplication, Vehicle } from "@/types";
import { KpiCard, PageHeader, Section } from "@/components/ui/layout-bits";
import { Segmented } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";
import { CHART_COLORS, ColumnBars, HorizontalBars, ProportionBar, STATE_COLORS, TrendBars } from "@/components/dashboard/charts";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const n = (v: number) => v.toLocaleString("en-PG");

type Can = ReturnType<typeof useDemoUser>["can"];
type TileKey =
  | "total" | "active" | "expiring" | "expired"
  | "newToday" | "renewalsToday" | "transfersToday" | "pendingApps" | "pendingInspections"
  | "collected" | "failedPayments" | "awaitingPayment" | "paymentsToday";

/** Default layout: registry first. Cashiers get payment tiles first (same data, payment-centric order). */
const LAYOUT: Record<"default" | "cashier", { primary: TileKey[]; secondary: TileKey[] }> = {
  default: {
    primary: ["total", "active", "expiring", "expired"],
    secondary: ["newToday", "renewalsToday", "transfersToday", "pendingApps", "pendingInspections", "collected", "failedPayments"],
  },
  cashier: {
    primary: ["collected", "paymentsToday", "awaitingPayment", "failedPayments"],
    secondary: ["newToday", "renewalsToday", "transfersToday", "pendingApps", "total", "active", "expiring", "expired"],
  },
};

function tiles(s: DashboardStats, can: Can, compact: boolean): Record<TileKey, React.ReactNode> {
  const registry = (status?: string) => (can("registry.view") ? `/registry${status ? `?status=${status}` : ""}` : undefined);
  const apps = (status?: string) => (can("registration.view") ? `/registrations${status ? `?status=${status}` : ""}` : undefined);
  const k = (v: number | string) => (compact ? <span className="text-[24px]">{v}</span> : v);
  return {
    total: <KpiCard key="total" label="Total registered vehicles" value={k(n(s.totalVehicles))} href={registry()} footer="All vehicle types · all provinces" />,
    active: <KpiCard key="active" label="Active registrations" value={k(n(s.activeRegistrations))} href={registry("active")} footer={<StatusBadge kind="vehicle" status="active" />} />,
    expiring: <KpiCard key="expiring" label={`Expiring in ${s.expiringSoonDays} days`} value={k(n(s.expiringRegistrations))} href={registry("expiring_soon")} footer={<StatusBadge kind="vehicle" status="expiring_soon" />} />,
    expired: <KpiCard key="expired" tone="danger" label="Expired registrations" value={k(n(s.expiredRegistrations))} href={registry("expired")} footer={<StatusBadge kind="vehicle" status="expired" />} />,
    newToday: <KpiCard key="newToday" label="New registrations today" value={k(n(s.newToday))} href={apps()} />,
    renewalsToday: <KpiCard key="renewalsToday" label="Renewals today" value={k(n(s.renewalsToday))} href={can("renewal.view") ? "/renewals" : apps()} />,
    transfersToday: <KpiCard key="transfersToday" label="Transfers today" value={k(n(s.transfersToday))} href={can("transfer.view") ? "/transfers" : apps()} />,
    pendingApps: <KpiCard key="pendingApps" label="Pending applications" value={k(n(s.pendingApplications))} href={apps("pending")} />,
    pendingInspections: <KpiCard key="pendingInspections" label="Pending inspections" value={k(n(s.awaitingInspection))} href={can("inspection.view") ? "/inspections" : apps("for_inspection")} />,
    collected: <KpiCard key="collected" dark label="Payments collected today" value={k(formatMoney(s.revenueToday))} href={can("payment.view") ? "/payments?tab=history" : undefined} footer={`${s.paymentsToday} successful payment${s.paymentsToday === 1 ? "" : "s"}`} />,
    paymentsToday: <KpiCard key="paymentsToday" label="Successful payments today" value={k(n(s.paymentsToday))} href={can("payment.view") ? "/payments?tab=history" : undefined} footer={<StatusBadge kind="payment" status="successful" />} />,
    awaitingPayment: <KpiCard key="awaitingPayment" label="Awaiting payment" value={k(n(s.awaitingPayment))} href={can("payment.view") ? "/payments" : apps("payment_required")} footer={<StatusBadge kind="registration" status="payment_required" />} />,
    failedPayments: <KpiCard key="failedPayments" tone={s.failedOrPendingPayments ? "danger" : undefined} label="Failed / pending payments" value={k(n(s.failedOrPendingPayments))} href={can("payment.view") ? "/payments?tab=failed" : undefined} footer={s.failedOrPendingPayments ? "Needs follow-up" : "None outstanding"} />,
  };
}

interface RecentRow {
  app: RegistrationApplication;
  owner?: Owner;
  vehicle?: Vehicle;
  amount?: number;
}

function vehicleTypeText(r: RecentRow) {
  const type = r.vehicle?.vehicleType ?? r.app.draft.classification?.vehicleType;
  const usage = r.vehicle?.vehicleUsage ?? r.app.draft.classification?.vehicleUsage;
  if (!type) return "—";
  return usage && usage !== "private" ? `${vehicleTypeLabel(type)} · ${vehicleUsageLabel(usage)}` : vehicleTypeLabel(type);
}

function officerName(name: string) {
  const [first, ...rest] = name.split(" ");
  return shortName({ firstName: first, lastName: rest.join(" ") });
}

export default function DashboardPage() {
  const { user, office, role, can } = useDemoUser();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [typeMeasure, setTypeMeasure] = useState<"all" | "active">("all");
  const [txnPeriod, setTxnPeriod] = useState<"today" | "30d">("today");
  const stats = useServiceQuery(() => reportService.dashboard(), []);
  const recent = useServiceQuery<RecentRow[]>(async () => {
    const [apps, owners, vehicles, payments] = await Promise.all([registrationService.list(), ownerService.list(), vehicleService.list(), paymentService.list()]);
    const ownerById = new Map(owners.map((o) => [o.id, o]));
    const vehicleById = new Map(vehicles.map((v) => [v.id, v]));
    const paid = new Map(payments.filter((p) => p.status === "successful").map((p) => [p.applicationId, p.amount]));
    return [...apps]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 10)
      .map((a) => ({
        app: a,
        owner: a.ownerId ? ownerById.get(a.ownerId) : undefined,
        vehicle: a.vehicleId ? vehicleById.get(a.vehicleId) : undefined,
        amount: paid.get(a.id) ?? a.assessment?.total,
      }));
  }, []);
  const pos = useServiceQuery(() => posService.getSimulator(), []);
  const notes = useServiceQuery(() => notificationService.list(), []);

  const charts = useMemo(() => {
    const s = stats.data;
    if (!s) return null;
    const types = (typeMeasure === "all" ? s.vehicleTypeDistribution : s.activeVehicleTypeDistribution).map((d) => ({ name: d.label, value: d.count }));
    const txns = (txnPeriod === "today" ? s.transactionTypeDistributionToday : s.transactionTypeDistribution).map((d) => ({ name: d.label, value: d.count }));
    const states = s.registrationStatusDistribution.map((d) => ({ name: d.label, value: d.count, color: STATE_COLORS[d.key] ?? "#aeb3bd", key: d.key }));
    const collections = s.collectionsToday.filter((c) => c.amount > 0).map((c, i) => ({ name: c.label, value: c.amount, count: c.count, color: CHART_COLORS[i % CHART_COLORS.length] }));
    return {
      types,
      typesTotal: types.reduce((a, d) => a + d.value, 0),
      txns,
      txnsTotal: txns.reduce((a, d) => a + d.value, 0),
      states,
      collections,
    };
  }, [stats.data, typeMeasure, txnPeriod]);

  if (stats.error) return <ErrorState message={stats.error} onRetry={() => stats.reload()} />;
  if (!stats.data || !charts) return <PageSkeleton />;
  const s = stats.data;
  const layout = LAYOUT[role === "cashier" ? "cashier" : "default"];
  const primaryTiles = tiles(s, can, false);
  const secondaryTiles = tiles(s, can, true);

  const columns: ColumnDef<RecentRow, unknown>[] = [
    { id: "ref", header: "Reference", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="mono font-semibold whitespace-nowrap">{row.original.app.transactionNumber}</Link> },
    { id: "txn", header: "Transaction", accessorFn: (r) => transactionLabel(r.app.type, true) },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner), cell: ({ row }) => <span className="font-semibold">{fullName(row.original.owner)}</span> },
    { id: "vehicle", header: "Vehicle", accessorFn: (r) => vehicleLabel(r.vehicle ?? r.app.draft.vehicle) },
    {
      id: "type", header: "Type", accessorFn: vehicleTypeText,
      cell: ({ row }) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><VehicleIcon type={row.original.vehicle?.vehicleType ?? row.original.app.draft.classification?.vehicleType} size={16} className="text-[#5a606c]" />{vehicleTypeText(row.original)}</span>,
    },
    { id: "status", header: "Status", accessorFn: (r) => r.app.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "amount", header: "Amount", accessorFn: (r) => r.amount ?? 0, meta: { align: "right" }, cell: ({ row }) => (row.original.amount ? formatMoney(row.original.amount) : "—") },
    { id: "officer", header: "Officer", accessorFn: (r) => r.app.createdByName, cell: ({ row }) => officerName(row.original.app.createdByName) },
  ];

  const terminal = pos.data;
  const collectedCount = s.collectionsToday.reduce((a, c) => a + c.count, 0);
  const txnCaption = txnPeriod === "today" ? "Transactions started today by type" : "Transactions started in the last 30 days by type";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${office?.name ?? "RTA"} · ${format(new Date(), "EEEE d MMMM yyyy")}`}
        title="Motor vehicle registration overview"
        description={`${greeting()}, ${user?.firstName ?? ""}.`}
        actions={
          <>
            {can("renewal.view") && <Link href="/renewals" className="btn btn-s"><RefreshCw size={16} aria-hidden="true" />Renew</Link>}
            {can("transfer.view") && <Link href="/transfers" className="btn btn-s"><ArrowLeftRight size={16} aria-hidden="true" />Transfer</Link>}
            {can("registration.create") && <Link href="/registrations/new" className="btn btn-p btn-lg"><Plus size={18} aria-hidden="true" />New Vehicle Transaction</Link>}
          </>
        }
      />

      <div className="g4">{layout.primary.map((k) => primaryTiles[k])}</div>
      <div className="g4 !gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))" }}>{layout.secondary.map((k) => secondaryTiles[k])}</div>

      <div className="split">
        <div className="l">
          <Section
            title="Registered vehicles by type"
            description={`${n(charts.typesTotal)} vehicles · ${typeMeasure === "all" ? "all registry records" : "active and expiring soon only"}`}
            actions={<Segmented label="Measure" value={typeMeasure} onChange={setTypeMeasure} options={[{ value: "all", label: "All registered" }, { value: "active", label: "Active only" }]} />}
          >
            <HorizontalBars data={charts.types} caption={typeMeasure === "all" ? "Registered vehicles by type" : "Active registrations by vehicle type"} />
          </Section>

          <div className="g2">
            <Section title="By registration status" description={`All ${n(s.totalVehicles)} registry records`}>
              <ProportionBar data={charts.states} caption="Vehicles by registration status" />
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
                {charts.states.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: d.color }} aria-hidden="true" />
                      {can("registry.view") ? <Link href={`/registry?status=${d.key}`} aria-label={`${d.name}: ${d.value} vehicles — open registry`}><StatusBadge kind="vehicle" status={d.key} /></Link> : <StatusBadge kind="vehicle" status={d.key} />}
                    </span>
                    <span className="num font-bold">{n(d.value)}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section
              title="By transaction type"
              description={`${txnPeriod === "today" ? "Today" : "Last 30 days"} · ${n(charts.txnsTotal)} transaction${charts.txnsTotal === 1 ? "" : "s"}`}
              actions={<Segmented label="Period" value={txnPeriod} onChange={setTxnPeriod} options={[{ value: "today", label: "Today" }, { value: "30d", label: "30 days" }]} />}
            >
              <ColumnBars data={charts.txns} caption={txnCaption} />
            </Section>
          </div>

          <Section
            title="Transaction trend"
            description={period === "daily" ? "Transactions started, last 7 days" : period === "weekly" ? "Transactions started, last 8 weeks" : "Transactions started, last 12 months"}
            actions={<Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />}
          >
            <TrendBars data={s.transactions[period]} caption="Transactions started" />
          </Section>
        </div>

        <div className="r">
          <Section title="Collections today" description={`${formatMoney(s.revenueToday)} · ${collectedCount} payment${collectedCount === 1 ? "" : "s"}`} className="!gap-3">
            {charts.collections.length ? (
              <>
                <ProportionBar data={charts.collections} caption="Collections today by payment method" money />
                <dl className="m-0 flex flex-col gap-2 text-[13.5px]">
                  {charts.collections.map((c) => (
                    <div key={c.name} className="flex items-center gap-2.5">
                      <span className="h-3 w-3 flex-none rounded-[3px]" style={{ background: c.color }} aria-hidden="true" />
                      <dt className="flex-1">{c.name} <span className="mut text-[12px]">({c.count})</span></dt>
                      <dd className="num m-0 font-bold">{formatMoney(c.value)}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="mut m-0 text-[13.5px]">No payments have been collected yet today.</p>
            )}
            {can("payment.view") && <Link href="/payments?tab=history" className="text-[13px] font-semibold">Payment history</Link>}
          </Section>

          {can("payment.process") && terminal ? (
            <Link href="/payments/pos" className="card sec gap-3 text-inherit no-underline" style={{ color: "inherit" }}>
              <div className="sechd"><p className="eb">POS terminal</p><StatusBadge kind="terminal" status={terminal.printer === "error" && terminal.terminalStatus === "connected" ? "printer_error" : terminal.terminalStatus} /></div>
              <div className="flex items-center gap-3">
                <div className="ic bg-[#e9f7ef]"><Smartphone size={22} className="text-[#137a3b]" aria-hidden="true" /></div>
                <div><p className="h3 text-[15px]">Wiseasy P5 · {terminal.activeTerminalId}</p><p className="mut m-0 mt-0.5 text-[12.5px]">Printer {terminal.printer === "ready" ? "ready" : "error"} · next result: {terminal.nextResult}</p></div>
              </div>
            </Link>
          ) : null}

          <Section title="Needs attention" actions={<span className="mut text-[12.5px]">{(notes.data ?? []).filter((x) => !x.read).length} unread</span>}>
            {(notes.data ?? []).length ? (
              <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
                {(notes.data ?? []).slice(0, 5).map((x) => (
                  <li key={x.id} className="flex gap-3">
                    <span className="ic h-8 w-8 text-[14px] font-extrabold" style={{ background: x.severity === "danger" ? "#fce4e5" : x.severity === "warning" ? "#fff4c2" : x.severity === "success" ? "#dff3e7" : "#e6e6fd", color: x.severity === "danger" ? "#a3111a" : x.severity === "warning" ? "#6e5200" : x.severity === "success" ? "#0d6630" : "#1010a8" }} aria-hidden="true">
                      {x.severity === "danger" ? "!" : x.severity === "success" ? "✓" : x.severity === "warning" ? "•" : "i"}
                    </span>
                    <div className="min-w-0">
                      <span className="sr-only">{x.severity === "danger" ? "Urgent: " : x.severity === "warning" ? "Warning: " : ""}</span>
                      {x.link ? <Link href={x.link} className="text-[13.5px] font-semibold text-[#0b0b0f]">{x.title}</Link> : <p className="m-0 text-[13.5px] font-semibold">{x.title}</p>}
                      <p className="mut m-0 mt-0.5 text-[12.5px]">{x.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mut m-0 text-[13.5px]">Nothing needs attention right now.</p>
            )}
          </Section>

          <Section title="Operational queues">
            <dl className="m-0 flex flex-col gap-2.5 text-[13.5px]">
              {([
                ["For approval", s.awaitingApproval, "/registrations/approval", can("approval.view")],
                ["Awaiting plate", s.awaitingPlate, "/plates?tab=assign", can("plates.view")],
                ["Available plates", s.availablePlates, "/plates", can("plates.view")],
                ["Failed inspections", s.failedInspections, "/inspections?tab=failed", can("inspection.view")],
              ] as const).map(([label, value, href, show]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt>{show ? <Link href={href}>{label}</Link> : label}</dt>
                  <dd className="num m-0 font-bold">{n(value)}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>

      <Section title="Recent applications" actions={can("registration.view") ? <Link href="/registrations" className="btn btn-s btn-sm">All applications</Link> : null}>
        <div className="-mx-6 -mb-[22px]">
          <DataTable
            storageKey="dashboard-recent"
            data={recent.data}
            loading={recent.loading}
            columns={columns}
            mobileCard={(r) => (
              <MobileCard
                href={`/registrations/${r.app.id}`}
                title={r.app.transactionNumber}
                badge={<StatusBadge kind="registration" status={r.app.status} />}
                lines={[<strong key="o">{fullName(r.owner)}</strong>, `${transactionLabel(r.app.type, true)} · ${vehicleLabel(r.vehicle ?? r.app.draft.vehicle)}`, vehicleTypeText(r)]}
                footer={<><span className="font-extrabold">{r.amount ? formatMoney(r.amount) : "—"}</span><span className="mut text-[12px]">{officerName(r.app.createdByName)} · {formatDateTime(r.app.updatedAt)}</span></>}
              />
            )}
            empty={{ title: "No Applications", message: "No motor vehicle transactions have been started yet.", action: can("registration.create") ? { label: "New Vehicle Transaction", href: "/registrations/new" } : undefined }}
          />
        </div>
      </Section>
    </div>
  );
}
