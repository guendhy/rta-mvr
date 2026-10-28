"use client";

import { use } from "react";
import { CircleCheck, CircleX, SearchX, ShieldAlert } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { PAYMENT_STATUS } from "@/lib/constants";
import { formatDateLong, formatMoney, formatTime } from "@/lib/formatting";
import { paymentService } from "@/services/payment.service";
import { VerdictBanner, VerifyDetail, VerifyFrame, VerifySkeleton } from "@/components/admin/public-verify";
import { StatusBadge } from "@/components/ui/status-badge";

export default function VerifyReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const result = useServiceQuery(() => paymentService.findByToken(token), [token], { live: false });

  let body: React.ReactNode;
  if (result.loading && result.data === undefined) {
    body = <VerifySkeleton />;
  } else if (result.error) {
    body = <VerdictBanner tone="warn" title="UNABLE TO VERIFY" message="The verification service could not be reached. Please try again shortly." icon={<ShieldAlert size={48} />} />;
  } else if (!result.data) {
    body = (
      <>
        <VerdictBanner tone="bad" title="RECEIPT NOT FOUND" message="This QR code does not match any RTA payment receipt on record." icon={<SearchX size={48} />} />
        <p className="m-0 text-center text-[13.5px] text-[#3a3f4a]">Check that the full QR code was scanned. If the problem continues, contact the RTA office that issued the receipt.</p>
      </>
    );
  } else {
    const p = result.data;
    const ok = p.status === "successful";
    const at = p.completedAt ?? p.createdAt;
    body = (
      <>
        {ok ? (
          <VerdictBanner tone="ok" title="VALID RECEIPT" message="This payment was received by the Road Traffic Authority." icon={<CircleCheck size={52} />} />
        ) : (
          <VerdictBanner tone="bad" title="PAYMENT NOT CONFIRMED" message={`Payment status: ${PAYMENT_STATUS[p.status]?.label ?? p.status}. This is not a valid receipt.`} icon={<CircleX size={52} />} />
        )}
        <section className="card p-5" aria-labelledby="rcpt-h">
          <h2 id="rcpt-h" className="eb mb-2">Receipt details</h2>
          <dl className="m-0">
            <VerifyDetail label="Receipt Number"><span className="mono">{p.receiptNumber ?? "Not issued"}</span></VerifyDetail>
            <VerifyDetail label="Amount">{formatMoney(p.amount)}</VerifyDetail>
            <VerifyDetail label="Date">{formatDateLong(at)}<span className="mut block text-[12.5px] font-semibold">{formatTime(at)}</span></VerifyDetail>
            <VerifyDetail label="Payment Status"><StatusBadge kind="payment" status={p.status} /></VerifyDetail>
          </dl>
        </section>
        <p className="m-0 text-center text-[12.5px] text-[#5a606c]">Payer and vehicle details are not shown on public verification for privacy.</p>
      </>
    );
  }

  return <VerifyFrame title="Receipt Verification">{body}</VerifyFrame>;
}
