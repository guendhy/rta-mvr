"use client";

import { use } from "react";
import Link from "next/link";
import { paymentService } from "@/services/payment.service";
import { registrationService } from "@/services/registration.service";
import { useServiceQuery } from "@/hooks/use-service";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatDateTime, formatMoney, fullName, motorcycleLabel } from "@/lib/formatting";
import { Breadcrumbs, DescriptionList, PageHeader, Section } from "@/components/ui/layout-bits";
import { Alert, EmptyState, ErrorState, PageSkeleton } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { QrCard } from "@/components/ui/qr-code";
import { ReceiptButtons } from "@/components/payments/receipt-buttons";
import { AssessmentTable } from "@/components/registrations/assessment-panel";

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useServiceQuery(async () => {
    const payment = await paymentService.getById(id);
    if (!payment) return null;
    const detail = await registrationService.getDetail(payment.applicationId);
    return { payment, detail };
  }, [id]);
  if (error) return <ErrorState message={error} onRetry={() => reload()} />;
  if (loading && !data) return <PageSkeleton />;
  if (!data) return <EmptyState title="Payment not found" message="No payment transactions found for this reference." action={{ label: "Payment history", href: "/payments?tab=history" }} />;
  const { payment: p, detail } = data;
  const app = detail?.application;
  const attempts = detail?.payments ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments?tab=history" }, { label: p.reference }]} />
      <PageHeader
        title={p.receiptNumber ?? p.reference}
        eyebrow={`${PAYMENT_METHOD_LABELS[p.method]} payment`}
        badge={<StatusBadge kind="payment" status={p.status} />}
        description={<>Reference <span className="mono font-semibold text-[#0b0b0f]">{p.reference}</span> · attempt {p.attempt} · {formatDateTime(p.createdAt)}</>}
        actions={p.status === "successful" ? <ReceiptButtons paymentId={p.id} applicationId={app?.id} /> : app && app.status === "payment_required" ? <Link href={`/payments/collect/${app.id}`} className="btn btn-p">Collect payment</Link> : null}
      />
      {(p.status === "unknown" || p.status === "processing") && app && (
        <Alert tone="warn" title="Payment status unknown" action={<Link href={`/payments/collect/${app.id}`} className="btn btn-p btn-sm">Check Payment Status</Link>}>The terminal did not return a final result. Check the status before taking another payment.</Alert>
      )}
      {p.failureReason && p.status !== "unknown" && <Alert tone="bad" title={`Payment ${p.status}`}>{p.failureReason}</Alert>}
      <div className="split">
        <div className="l">
          <Section title="Payment details">
            <DescriptionList items={[
              ["Amount", <strong key="a" className="text-[16px]">{formatMoney(p.amount)}</strong>],
              ["Method", PAYMENT_METHOD_LABELS[p.method]],
              ["Receipt number", <span key="r" className="mono">{p.receiptNumber ?? "—"}</span>],
              ["Payment reference", <span key="pr" className="mono">{p.reference}</span>],
              ["Idempotency key", <span key="ik" className="mono text-[12px]">{p.idempotencyKey}</span>],
              ["Terminal ID", <span key="t" className="mono">{p.terminalId ?? "—"}</span>],
              ["Approval code", <span key="ac" className="mono">{p.approvalCode ?? "—"}</span>],
              ["Card", p.cardMasked],
              ["Tendered / change", p.amountTendered !== undefined ? `${formatMoney(p.amountTendered)} / ${formatMoney(p.change)}` : undefined],
              ["Bank / reference", p.bankName ? `${p.bankName} · ${p.bankReference ?? ""}` : undefined],
              ["Cashier", p.cashierName],
              ["Completed", formatDateTime(p.completedAt)],
            ]} />
          </Section>
          {app?.assessment && <Section title="Assessment paid"><AssessmentTable assessment={app.assessment} /></Section>}
        </div>
        <div className="r">
          {app && (
            <Section title="Application">
              <DescriptionList items={[
                ["Transaction", <Link key="t" href={`/registrations/${app.id}`} className="mono">{app.transactionNumber}</Link>],
                ["Owner", fullName(detail?.owner)],
                ["Motorcycle", motorcycleLabel(detail?.motorcycle)],
                ["Status", <StatusBadge key="s" kind="registration" status={app.status} />],
              ]} />
            </Section>
          )}
          {p.status === "successful" && <QrCard path={`/verify/receipt/${p.verificationToken}`} title="Scan to verify receipt" subtitle={p.receiptNumber ?? p.reference} />}
          {attempts.length > 1 && (
            <Section title="All attempts for this application" description="One idempotency key — at most one successful charge.">
              <ul className="m-0 flex list-none flex-col divide-y divide-[#edeff3] p-0">
                {attempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                    <Link href={`/payments/${a.id}`} className={`mono ${a.id === p.id ? "font-bold" : ""}`}>{a.reference}</Link>
                    <StatusBadge kind="payment" status={a.status} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
