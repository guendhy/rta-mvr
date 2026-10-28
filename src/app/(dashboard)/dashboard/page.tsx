"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Plus, RefreshCw, Smartphone } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { formatDateTime, formatMoney, fullName, motorcycleLabel, shortName } from "@/lib/formatting";
import { reportService } from "@/services/report.service";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import { motorcycleService } from "@/services/motorcycle.service";
import { paymentService } from "@/services/payment.service";
import { posService } from "@/services/pos.service";
import { notificationService } from "@/services/notification.service";
import { KpiCard, PageHeader, Section } from "@/components/ui/layout-bits";
import { Segmented } from "@/components/ui/form";
import { ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Donut, TrendBars } from "@/components/dashboard/charts";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { user, office, can } = useDemoUser();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const stats = useServiceQuery(() => reportService.dashboard(), []);
  const recent = useServiceQuery(async () => {
    const [apps, owners, motos, payments] = await Promise.all([registrationService.list(), ownerService.list(), motorcycleService.list(), paymentService.list()]);
    return apps.slice(0, 10).map((a) => ({
      app: a,
      owner: owners.find((o) => o.id === a.ownerId),
      moto: motos.find((m) => m.id === a.motorcycleId),
      amount: payments.find((p) => p.applicationId === a.id && p.status === "successful")?.amount ?? a.assessment?.total,
    }));
  }, []);
  const pos = useServiceQuery(() => posService.getSimulator(), []);
  const notes = useServiceQuery(() => notificationService.list(), []);

  if (stats.error) return <ErrorState message={stats.error} onRetry={() => stats.reload()} />;
  if (!stats.data) return <PageSkeleton />;
  const s = stats.data;

  type Row = NonNullable<typeof recent.data>[number];
  const columns: ColumnDef<Row, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.app.id}`} className="mono font-semibold">{row.original.app.transactionNumber}</Link> },
    { id: "owner", header: "Owner", accessorFn: (r) => fullName(r.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (r) => motorcycleLabel(r.moto) },
    { id: "status", header: "Status", accessorFn: (r) => r.app.status, cell: ({ row }) => <StatusBadge kind="registration" status={row.original.app.status} /> },
    { id: "amount", header: "Amount", accessorFn: (r) => r.amount ?? 0, meta: { align: "right" }, cell: ({ row }) => (row.original.amount ? formatMoney(row.original.amount) : "—") },
    { id: "officer", header: "Officer", accessorFn: (r) => r.app.createdByName, cell: ({ row }) => shortName({ firstName: row.original.app.createdByName.split(" ")[0], lastName: row.original.app.createdByName.split(" ").slice(1).join(" ") }) },
    { id: "date", header: "Date", accessorFn: (r) => r.app.updatedAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.app.updatedAt)}</span> },
  ];

  const terminal = pos.data;
  const revenueData = s.revenueByMethod.map((r) => ({ name: r.label, value: r.amount }));
  const maxStatus = Math.max(1, ...s.statusDistribution.map((d) => d.count));
  const STATUS_COLORS: Record<string, string> = { draft: "#aeb3bd", pending: "#e0b400", for_inspection: "#1515e8", for_insurance_verification: "#4b4bf0", for_assessment: "#7a3fd1", payment_required: "#c25a00", for_approval: "#8c8cf5", registered: "#137a3b" };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`${office?.name ?? "RTA"} · ${format(new Date(), "EEEE d MMMM yyyy")}`}
        title={`${greeting()}, ${user?.firstName ?? ""}`}
        actions={
          <>
            {can("renewal.view") && <Link href="/renewals" className="btn btn-s"><RefreshCw size={16} aria-hidden="true" />Renew Registration</Link>}
            {can("registration.create") && <Link href="/registrations/new" className="btn btn-p btn-lg"><Plus size={18} aria-hidden="true" />New Motorcycle Registration</Link>}
          </>
        }
      />

      <div className="g4">
        <KpiCard label="Registrations today" value={s.registrationsToday} href={can("registration.view") ? "/registrations" : undefined} footer="New + renewal applications started today" />
        <KpiCard label="Pending applications" value={s.pendingApplications} href={can("registration.view") ? "/registrations?status=pending" : undefined} footer={<StatusBadge kind="registration" status="pending" />} />
        <KpiCard label="Awaiting inspection" value={s.awaitingInspection} href={can("inspection.view") ? "/inspections" : can("registration.view") ? "/registrations?status=for_inspection" : undefined} footer={<StatusBadge kind="registration" status="for_inspection" />} />
        <KpiCard label="Awaiting payment" value={s.awaitingPayment} href={can("payment.view") ? "/payments" : can("registration.view") ? "/registrations?status=payment_required" : undefined} footer={<StatusBadge kind="registration" status="payment_required" />} />
        <KpiCard label="Completed today" value={s.completedToday} href={can("registration.view") ? "/registrations?status=registered" : undefined} footer={<StatusBadge kind="registration" status="registered" />} />
        <KpiCard dark label="Revenue today" value={formatMoney(s.revenueToday)} href={can("payment.view") ? "/payments?tab=history" : undefined} footer={`${s.paymentsToday} successful payment${s.paymentsToday === 1 ? "" : "s"}`} />
        <KpiCard label="Expiring registrations" value={s.expiringRegistrations} href={can("registry.view") ? "/registry?expiry=30" : undefined} footer="Expire within 30 days" />
        <KpiCard tone="danger" label="Failed inspections" value={s.failedInspections} href={can("inspection.view") ? "/inspections?tab=failed" : undefined} footer="Awaiting reinspection" />
      </div>

      <div className="split">
        <div className="l">
          <Section
            title="Registration transactions"
            description={period === "daily" ? "Applications started, last 7 days" : period === "weekly" ? "Applications started, last 8 weeks" : "Applications started, last 12 months"}
            actions={<Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />}
          >
            <TrendBars data={s.transactions[period]} />
          </Section>
          <div className="g2">
            <Section title="Revenue collection" description="Successful payments by channel · last 30 days">
              <Donut data={revenueData} money />
            </Section>
            <Section title="Registration status" description={`${s.statusDistribution.reduce((a, d) => a + d.count, 0)} active and completed applications`}>
              <div className="flex flex-col gap-2.5 text-[13px]" role="list">
                {s.statusDistribution.map((d) => (
                  <div key={d.status} role="listitem" className="grid grid-cols-[96px_1fr_32px] items-center gap-2.5">
                    <span>{d.label}</span>
                    <div className="h-2.5 rounded-full bg-[#edeff3]"><div className="h-2.5 rounded-full" style={{ width: `${(d.count / maxStatus) * 100}%`, background: STATUS_COLORS[d.status] }} /></div>
                    <span className="num font-bold">{d.count}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
        <div className="r">
          {can("payment.process") && terminal ? (
            <Link href="/payments/pos" className="card sec gap-3 text-inherit no-underline" style={{ color: "inherit" }}>
              <div className="sechd"><p className="eb">POS terminal</p><StatusBadge kind="terminal" status={terminal.printer === "error" && terminal.terminalStatus === "connected" ? "printer_error" : terminal.terminalStatus} /></div>
              <div className="flex items-center gap-3">
                <div className="ic bg-[#e9f7ef]"><Smartphone size={22} className="text-[#137a3b]" aria-hidden="true" /></div>
                <div><p className="h3 text-[15px]">Wiseasy P5 · {terminal.activeTerminalId}</p><p className="mut m-0 mt-0.5 text-[12.5px]">Printer {terminal.printer === "ready" ? "ready" : "error"} · next result: {terminal.nextResult}</p></div>
              </div>
            </Link>
          ) : null}
          <Section title="Needs attention" actions={<span className="mut text-[12.5px]">{(notes.data ?? []).filter((n) => !n.read).length} unread</span>}>
            <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
              {(notes.data ?? []).slice(0, 5).map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="ic h-8 w-8 text-[14px] font-extrabold" style={{ background: n.severity === "danger" ? "#fce4e5" : n.severity === "warning" ? "#fff4c2" : n.severity === "success" ? "#dff3e7" : "#e6e6fd", color: n.severity === "danger" ? "#a3111a" : n.severity === "warning" ? "#6e5200" : n.severity === "success" ? "#0d6630" : "#1010a8" }} aria-hidden="true">
                    {n.severity === "danger" ? "!" : n.severity === "success" ? "✓" : n.severity === "warning" ? "•" : "i"}
                  </span>
                  <div className="min-w-0">
                    {n.link ? <Link href={n.link} className="text-[13.5px] font-semibold text-[#0b0b0f]">{n.title}</Link> : <p className="m-0 text-[13.5px] font-semibold">{n.title}</p>}
                    <p className="mut m-0 mt-0.5 text-[12.5px]">{n.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Operational queues">
            <dl className="m-0 flex flex-col gap-2.5 text-[13.5px]">
              {[
                ["For approval", s.awaitingApproval, "/registrations/approval", can("approval.view")],
                ["Awaiting plate", s.awaitingPlate, "/plates?tab=assign", can("plates.view")],
                ["Available plates", s.availablePlates, "/plates", can("plates.view")],
              ].map(([label, value, href, show]) => (
                <div key={String(label)} className="flex items-center justify-between">
                  <dt>{show ? <Link href={String(href)}>{String(label)}</Link> : String(label)}</dt>
                  <dd className="num m-0 font-bold">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>

      <Section title="Recent transactions" actions={can("registration.view") ? <Link href="/registrations" className="btn btn-s btn-sm">All applications</Link> : null}>
        <div className="-mx-6 -mb-[22px]">
          <DataTable
            storageKey="dashboard-recent"
            data={recent.data}
            loading={recent.loading}
            columns={columns}
            mobileCard={(r) => (
              <MobileCard href={`/registrations/${r.app.id}`} title={r.app.transactionNumber} badge={<StatusBadge kind="registration" status={r.app.status} />} lines={[fullName(r.owner), motorcycleLabel(r.moto)]} footer={<><span className="font-extrabold">{r.amount ? formatMoney(r.amount) : "—"}</span><span className="mut text-[12px]">{formatDateTime(r.app.updatedAt)}</span></>} />
            )}
            empty={{ title: "No Applications", message: "No motorcycle registration applications found.", action: can("registration.create") ? { label: "Create Registration", href: "/registrations/new" } : undefined }}
          />
        </div>
      </Section>
    </div>
  );
}
