"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { isSameDay } from "date-fns";
import { CreditCard, Search, X } from "lucide-react";
import { useDemoUser } from "@/hooks/use-demo-user";
import { useServiceQuery } from "@/hooks/use-service";
import { useDebouncedValue } from "@/hooks/use-local-storage";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS } from "@/lib/constants";
import { formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { paymentService } from "@/services/payment.service";
import { registrationService } from "@/services/registration.service";
import { ownerService } from "@/services/owner.service";
import type { PaymentQueueItem } from "@/services/interfaces";
import { KpiCard, PageHeader, Tabs } from "@/components/ui/layout-bits";
import { Field, Input, Select } from "@/components/ui/form";
import { Alert, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import type { Owner, Payment, PaymentMethod, PaymentStatus, RegistrationApplication } from "@/types";

type TabKey = "queue" | "history" | "failed";
const TAB_KEYS: TabKey[] = ["queue", "history", "failed"];
const FAILED: PaymentStatus[] = ["declined", "failed", "unknown", "timeout"];
type PayRow = { p: Payment; app: RegistrationApplication | undefined; owner: Owner | undefined };

function PaymentsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { can } = useDemoUser();
  const raw = params.get("tab") as TabKey | null;
  const tab: TabKey = raw && TAB_KEYS.includes(raw) ? raw : "queue";
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("");
  const urlStatus = params.get("status") ?? "";
  const [status, setStatus] = useState(urlStatus);
  const [seenUrlStatus, setSeenUrlStatus] = useState(urlStatus);
  if (urlStatus !== seenUrlStatus) {
    // Follow links such as ?tab=history&status=unknown while already on this page.
    setSeenUrlStatus(urlStatus);
    setStatus(urlStatus);
  }
  const q = useDebouncedValue(query.trim().toLowerCase(), 250);
  const canProcess = can("payment.process");

  const data = useServiceQuery(async () => {
    const [queue, payments, apps, owners] = await Promise.all([paymentService.queue(), paymentService.list(), registrationService.list(), ownerService.list()]);
    const rows: PayRow[] = [...payments]
      .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt))
      .map((p) => {
        const app = apps.find((a) => a.id === p.applicationId);
        return { p, app, owner: owners.find((o) => o.id === app?.ownerId) };
      });
    return { queue, rows };
  }, []);

  const view = useMemo(() => {
    if (!data.data) return null;
    const match = (parts: (string | undefined)[]) => !q || parts.filter(Boolean).join(" ").toLowerCase().includes(q);
    const rowMatch = (r: PayRow) => match([r.p.reference, r.p.receiptNumber, r.app?.transactionNumber, fullName(r.owner), r.p.cashierName, r.p.terminalId]);
    const queue = data.data.queue.filter((i) => match([i.application.transactionNumber, fullName(i.owner), motorcycleLabel(i.motorcycle), i.motorcycle?.plateNumber]));
    const history = data.data.rows.filter((r) => rowMatch(r) && (!method || r.p.method === method) && (!status || r.p.status === status));
    const failed = data.data.rows.filter((r) => FAILED.includes(r.p.status) && rowMatch(r) && (!method || r.p.method === method));
    return { queue, history, failed };
  }, [data.data, q, method, status]);

  if (data.error) return <ErrorState message={data.error} onRetry={() => data.reload()} />;
  if (!data.data || !view) return <PageSkeleton />;

  const now = new Date();
  const today = (iso?: string) => !!iso && isSameDay(new Date(iso), now);
  const all = data.data.rows;
  const okToday = all.filter((r) => r.p.status === "successful" && today(r.p.completedAt ?? r.p.createdAt));
  const attemptsToday = all.filter((r) => today(r.p.createdAt));
  const failedToday = attemptsToday.filter((r) => FAILED.includes(r.p.status));
  const unknown = all.filter((r) => r.p.status === "unknown");

  const setTab = (v: TabKey) => router.replace(v === "queue" ? "/payments" : `/payments?tab=${v}`, { scroll: false });
  const filtersOn = !!(query || method || (tab === "history" && status));
  const clear = () => { setQuery(""); setMethod(""); setStatus(""); };

  const queueAction = (i: PaymentQueueItem) => canProcess
    ? <Link href={`/payments/collect/${i.application.id}`} className="btn btn-p btn-sm"><CreditCard size={14} aria-hidden="true" />Collect payment</Link>
    : <Link href={`/registrations/${i.application.id}`} className="btn btn-s btn-sm">View</Link>;

  const queueCols: ColumnDef<PaymentQueueItem, unknown>[] = [
    { id: "txn", header: "Transaction", accessorFn: (i) => i.application.transactionNumber, cell: ({ row }) => <Link href={`/registrations/${row.original.application.id}`} className="mono font-semibold">{row.original.application.transactionNumber}</Link> },
    { id: "type", header: "Type", accessorFn: (i) => i.application.type, cell: ({ row }) => (row.original.application.type === "renewal" ? "Renewal" : "New") },
    { id: "owner", header: "Owner", accessorFn: (i) => fullName(i.owner) },
    { id: "moto", header: "Motorcycle", accessorFn: (i) => motorcycleLabel(i.motorcycle) },
    { id: "due", header: "Amount due", accessorFn: (i) => i.application.assessment?.total ?? 0, meta: { align: "right" }, cell: ({ row }) => <span className="font-bold">{row.original.application.assessment ? formatMoney(row.original.application.assessment.total) : "—"}</span> },
    { id: "last", header: "Last attempt", accessorFn: (i) => i.lastAttempt?.status ?? "", cell: ({ row }) => (row.original.lastAttempt
      ? <span className="flex flex-col items-start gap-0.5"><StatusBadge kind="payment" status={row.original.lastAttempt.status} /><span className="mut text-[12px]">{PAYMENT_METHOD_LABELS[row.original.lastAttempt.method]} · {formatDateTime(row.original.lastAttempt.createdAt)}</span></span>
      : <span className="mut">No attempts</span>) },
    { id: "action", header: "Action", enableSorting: false, cell: ({ row }) => queueAction(row.original) },
  ];

  const reasonCol: ColumnDef<PayRow, unknown> = { id: "reason", header: "Reason", accessorFn: (r) => r.p.failureReason ?? "", cell: ({ row }) => row.original.p.failureReason ?? (row.original.p.status === "unknown" ? "Status check required" : "—") };
  const payCols = (withReason: boolean): ColumnDef<PayRow, unknown>[] => [
    { id: "date", header: "Date", accessorFn: (r) => r.p.completedAt ?? r.p.createdAt, cell: ({ row }) => <span className="mono">{formatDateTime(row.original.p.completedAt ?? row.original.p.createdAt)}</span> },
    { id: "ref", header: "Reference", accessorFn: (r) => r.p.reference, cell: ({ row }) => <Link href={`/payments/${row.original.p.id}`} className="mono font-semibold">{row.original.p.reference}</Link> },
    { id: "receipt", header: "Receipt", accessorFn: (r) => r.p.receiptNumber ?? "", cell: ({ row }) => <span className="mono">{row.original.p.receiptNumber ?? "—"}</span> },
    { id: "txn", header: "Transaction", accessorFn: (r) => r.app?.transactionNumber ?? "", cell: ({ row }) => (row.original.app ? <Link href={`/registrations/${row.original.app.id}`} className="mono">{row.original.app.transactionNumber}</Link> : "—") },
    { id: "method", header: "Method", accessorFn: (r) => PAYMENT_METHOD_LABELS[r.p.method] },
    { id: "amount", header: "Amount", accessorFn: (r) => r.p.amount, meta: { align: "right" }, cell: ({ row }) => formatMoney(row.original.p.amount) },
    { id: "status", header: "Status", accessorFn: (r) => r.p.status, cell: ({ row }) => <StatusBadge kind="payment" status={row.original.p.status} /> },
    ...(withReason ? [reasonCol] : []),
    { id: "cashier", header: "Cashier", accessorFn: (r) => r.p.cashierName },
  ];

  const payCard = (r: PayRow) => (
    <MobileCard href={`/payments/${r.p.id}`} title={r.p.reference} badge={<StatusBadge kind="payment" status={r.p.status} />}
      lines={[formatMoney(r.p.amount), `${PAYMENT_METHOD_LABELS[r.p.method]} · ${r.app?.transactionNumber ?? "—"} · ${fullName(r.owner)}`, ...(r.p.failureReason ? [r.p.failureReason] : [])]}
      footer={<><span className="mut text-[12px]">{r.p.cashierName}</span><span className="mut text-[12px]">{formatDateTime(r.p.completedAt ?? r.p.createdAt)}</span></>} />
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Payments"
        title="Payments"
        description="Collect assessed fees and review payment history across POS, cash, online and bank transfer."
        actions={canProcess ? <Link href="/payments/pos" className="btn btn-s"><CreditCard size={16} aria-hidden="true" />POS terminal</Link> : null}
      />

      <div className="g4">
        <KpiCard dark label="Collected today" value={formatMoney(okToday.reduce((s, r) => s + r.p.amount, 0))} footer={`${okToday.length} successful payment${okToday.length === 1 ? "" : "s"}`} />
        <KpiCard label="Transactions today" value={attemptsToday.length} href="/payments?tab=history" footer="Payment attempts started today" />
        <KpiCard tone="danger" label="Failed today" value={failedToday.length} href="/payments?tab=failed" footer="Declined, failed, timed out or unknown" />
        <KpiCard label="Status unknown" value={unknown.length} href={unknown.length === 1 ? `/payments/${unknown[0].p.id}` : "/payments?tab=history&status=unknown"} footer="Attempts needing a status check" />
      </div>

      {unknown.length > 0 && (
        <Alert tone="warn" title={`${unknown.length} payment${unknown.length === 1 ? "" : "s"} with unknown status`}>
          <p className="m-0">Check the status with the terminal before collecting again — this prevents duplicate charges.</p>
          <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
            {unknown.slice(0, 6).map((r) => (
              <li key={r.p.id}><Link href={`/payments/${r.p.id}`} className="mono inline-flex min-h-[44px] items-center font-semibold">{r.p.reference}</Link> <span className="text-[12.5px]">· {r.app?.transactionNumber ?? ""} · {formatMoney(r.p.amount)}</span></li>
            ))}
          </ul>
        </Alert>
      )}

      <Tabs<TabKey>
        label="Payment sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "queue", label: "Payment Queue", count: view.queue.length },
          { value: "history", label: "History", count: view.history.length },
          { value: "failed", label: "Failed", count: view.failed.length },
        ]}
      />

      <section className="card sec" aria-label="Search and filters">
        <div className="form">
          <Field label="Search" htmlFor="pay-q" className={tab === "queue" ? "full" : ""}>
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#5a606c]" aria-hidden="true" />
              <Input id="pay-q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="!pl-10" autoComplete="off"
                placeholder={tab === "queue" ? "Transaction, owner, motorcycle or plate" : "Reference, receipt, transaction, owner or cashier"} />
            </div>
          </Field>
          {tab !== "queue" && (
            <Field label="Method" htmlFor="pay-method">
              <Select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="All methods" options={(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
            </Field>
          )}
          {tab === "history" && (
            <Field label="Status" htmlFor="pay-status">
              <Select id="pay-status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All statuses" options={(Object.keys(PAYMENT_STATUS) as PaymentStatus[]).map((s) => ({ value: s, label: PAYMENT_STATUS[s].label }))} />
            </Field>
          )}
        </div>
        {filtersOn && <div><button type="button" className="btn btn-g btn-sm min-h-[44px]" onClick={clear}><X size={16} aria-hidden="true" />Clear filters</button></div>}
      </section>

      <div role="tabpanel" aria-label="Payment records">
        {tab === "queue" && (
          <DataTable key="queue" storageKey="payments-queue" data={view.queue} loading={data.loading} columns={queueCols}
            mobileCard={(i) => (
              <div className="card flex flex-col gap-2 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/registrations/${i.application.id}`} className="mono truncate text-[12.5px] font-semibold">{i.application.transactionNumber}</Link>
                  {i.lastAttempt ? <StatusBadge kind="payment" status={i.lastAttempt.status} /> : <StatusBadge kind="registration" status={i.application.status} />}
                </div>
                <p className="m-0 text-[15px] font-bold">{fullName(i.owner)}</p>
                <p className="mut m-0 text-[13px]">{motorcycleLabel(i.motorcycle)}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#edeff3] pt-2.5">
                  <span className="text-[16px] font-extrabold">{i.application.assessment ? formatMoney(i.application.assessment.total) : "—"}</span>
                  <span className="[&_.btn]:min-h-[44px]">{queueAction(i)}</span>
                </div>
              </div>
            )}
            empty={{ title: "Payment queue is empty", message: q ? "No applications in the queue match your search." : "No applications are waiting for payment." }} />
        )}
        {tab === "history" && (
          <DataTable key="history" storageKey="payments-history" data={view.history} loading={data.loading} columns={payCols(false)} mobileCard={payCard}
            onRowClick={(r) => router.push(`/payments/${r.p.id}`)}
            empty={{ title: "No payments", message: filtersOn ? "No payments match the current filters." : "No payments have been recorded yet.", action: filtersOn ? { label: "Clear filters", onClick: clear } : undefined }} />
        )}
        {tab === "failed" && (
          <DataTable key="failed" storageKey="payments-failed" data={view.failed} loading={data.loading} columns={payCols(true)} mobileCard={payCard}
            onRowClick={(r) => router.push(`/payments/${r.p.id}`)}
            empty={{ title: "No failed payments", message: filtersOn ? "No failed payments match the current filters." : "There are no declined, failed, timed out or unknown payments." }} />
        )}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaymentsInner />
    </Suspense>
  );
}
