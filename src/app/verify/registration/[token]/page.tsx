"use client";

import { use } from "react";
import { CircleCheck, CircleX, SearchX, ShieldAlert } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { MOTORCYCLE_STATUS } from "@/lib/constants";
import { formatDateLong } from "@/lib/formatting";
import { registrationService } from "@/services/registration.service";
import { VerdictBanner, VerifyDetail, VerifyFrame, VerifySkeleton } from "@/components/admin/public-verify";
import { StatusBadge } from "@/components/ui/status-badge";

export default function VerifyRegistrationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const result = useServiceQuery(() => registrationService.findByToken(token), [token], { live: false });

  let body: React.ReactNode;
  if (result.loading && result.data === undefined) {
    body = <VerifySkeleton />;
  } else if (result.error) {
    body = <VerdictBanner tone="warn" title="UNABLE TO VERIFY" message="The verification service could not be reached. Please try again shortly." icon={<ShieldAlert size={48} />} />;
  } else if (!result.data) {
    body = (
      <>
        <VerdictBanner tone="bad" title="REGISTRATION NOT FOUND" message="This QR code does not match any motorcycle registration on record." icon={<SearchX size={48} />} />
        <p className="m-0 text-center text-[13.5px] text-[#3a3f4a]">If you believe this is an error, contact your nearest RTA office. A missing record may indicate a forged certificate or label.</p>
      </>
    );
  } else {
    const { motorcycle: m, application: a } = result.data;
    const expiry = m.registrationExpiry ?? a.expiryDate;
    const expired = m.registrationStatus === "expired" || (!!expiry && new Date(expiry).getTime() < Date.now());
    const valid = !expired && m.registrationStatus === "registered";
    body = (
      <>
        {valid ? (
          <VerdictBanner tone="ok" title="VALID REGISTRATION" message="This motorcycle is currently registered with the RTA." icon={<CircleCheck size={52} />} />
        ) : expired ? (
          <VerdictBanner tone="bad" title="REGISTRATION EXPIRED" message={`This registration expired on ${formatDateLong(expiry)}.`} icon={<CircleX size={52} />} />
        ) : (
          <VerdictBanner tone="bad" title="REGISTRATION NOT VALID" message={`Current status: ${MOTORCYCLE_STATUS[m.registrationStatus]?.label ?? m.registrationStatus}.`} icon={<CircleX size={52} />} />
        )}
        <section className="card p-5" aria-labelledby="veh-h">
          <h2 id="veh-h" className="eb mb-2">Motorcycle details</h2>
          {(m.plateNumber ?? a.plateNumber) && (
            <p className="mono m-0 mb-3 inline-block rounded-md border-2 border-[#0b0b0f] bg-[#ffd21a] px-4 py-1.5 text-[24px] font-extrabold tracking-[.06em]">{m.plateNumber ?? a.plateNumber}</p>
          )}
          <dl className="m-0">
            <VerifyDetail label="Plate">{m.plateNumber ?? a.plateNumber ?? "Not yet issued"}</VerifyDetail>
            <VerifyDetail label="Registration No."><span className="mono">{m.registrationNumber ?? a.registrationNumber ?? "—"}</span></VerifyDetail>
            <VerifyDetail label="Make">{m.make}</VerifyDetail>
            <VerifyDetail label="Model">{m.model}</VerifyDetail>
            <VerifyDetail label="Registration Status"><StatusBadge kind="motorcycle" status={expired ? "expired" : m.registrationStatus} /></VerifyDetail>
            <VerifyDetail label="Expiry Date">{formatDateLong(expiry)}</VerifyDetail>
          </dl>
        </section>
        <p className="m-0 text-center text-[12.5px] text-[#5a606c]">Owner details are not shown on public verification for privacy.</p>
      </>
    );
  }

  return <VerifyFrame title="Registration Verification">{body}</VerifyFrame>;
}
