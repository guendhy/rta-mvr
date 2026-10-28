"use client";

import { use } from "react";
import { CircleCheck, CircleX, SearchX, ShieldAlert } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { getStatusLabel, vehicleRegistrationState } from "@/config/statuses";
import { vehicleTypeLabel } from "@/config/vehicle-types";
import { generators } from "@/lib/generators";
import { formatDateLong } from "@/lib/formatting";
import { registrationService } from "@/services/registration.service";
import { VerdictBanner, VerifyDetail, VerifyFrame, VerifySkeleton } from "@/components/admin/public-verify";
import { StatusBadge } from "@/components/ui/status-badge";
import { VehicleIcon } from "@/components/vehicles/vehicle-icon";

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
        <VerdictBanner tone="bad" title="REGISTRATION NOT FOUND" message="This QR code does not match any motor vehicle registration on record." icon={<SearchX size={48} />} />
        <p className="m-0 text-center text-[13.5px] text-[#3a3f4a]">If you believe this is an error, contact your nearest RTA office. A missing record may indicate a forged certificate or label.</p>
      </>
    );
  } else {
    const { vehicle: v, application: a } = result.data;
    const expiry = v.registrationExpiry ?? a.expiryDate;
    const state = vehicleRegistrationState({ registrationStatus: v.registrationStatus, registrationExpiry: expiry });
    const valid = state === "active" || state === "expiring_soon";
    const plate = v.plateNumber ?? a.plateNumber;
    body = (
      <>
        {valid ? (
          <VerdictBanner tone="ok" title="VALID REGISTRATION" message={state === "expiring_soon" ? `This vehicle is registered with the RTA. The registration expires on ${formatDateLong(expiry)}.` : "This vehicle is currently registered with the RTA."} icon={<CircleCheck size={52} />} />
        ) : state === "expired" ? (
          <VerdictBanner tone="bad" title="REGISTRATION EXPIRED" message={`This registration expired on ${formatDateLong(expiry)}.`} icon={<CircleX size={52} />} />
        ) : (
          <VerdictBanner tone="bad" title="REGISTRATION NOT VALID" message={`Current status: ${getStatusLabel("vehicle", state)}.`} icon={<CircleX size={52} />} />
        )}
        <section className="card p-5" aria-labelledby="veh-h">
          <h2 id="veh-h" className="eb mb-2">Vehicle details</h2>
          {plate && (
            <p className="mono m-0 mb-3 inline-block rounded-md border-2 border-[#0b0b0f] bg-[#ffd21a] px-4 py-1.5 text-[24px] font-extrabold tracking-[.06em]">{plate}</p>
          )}
          <dl className="m-0">
            <VerifyDetail label="Registration No."><span className="mono">{v.registrationNumber ?? a.registrationNumber ?? "—"}</span></VerifyDetail>
            <VerifyDetail label="Plate">{plate ?? "Not yet issued"}</VerifyDetail>
            <VerifyDetail label="Vehicle Type"><span className="inline-flex items-center gap-1.5"><VehicleIcon type={v.vehicleType} size={18} />{vehicleTypeLabel(v.vehicleType)}</span></VerifyDetail>
            <VerifyDetail label="Make / Model">{[v.make, v.model].filter(Boolean).join(" ")}</VerifyDetail>
            <VerifyDetail label="Colour">{v.color}</VerifyDetail>
            <VerifyDetail label="Registration Status"><StatusBadge kind="vehicle" status={state} /></VerifyDetail>
            <VerifyDetail label="Expiry Date">{formatDateLong(expiry)}</VerifyDetail>
            <VerifyDetail label="Verification Ref."><span className="mono">{generators.verificationReference(token)}</span></VerifyDetail>
          </dl>
        </section>
        <p className="m-0 text-center text-[12.5px] text-[#5a606c]">Owner details are not shown on public verification for privacy.</p>
      </>
    );
  }

  return <VerifyFrame title="Registration Verification">{body}</VerifyFrame>;
}
