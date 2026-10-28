"use client";

import { useEffect, useState } from "react";
import { Award, Tag } from "lucide-react";
import { CertificateOfRegistration, RegistrationLabel, type CertificateData } from "@/components/printing/documents";
import { PrintPreview } from "@/components/printing/print-preview";
import type { RegistrationDetail } from "@/services/interfaces";

export function certificateData(d: RegistrationDetail): CertificateData | null {
  if (!d.owner || !d.motorcycle || !d.application.registrationNumber) return null;
  return {
    application: d.application,
    owner: d.owner,
    motorcycle: d.motorcycle,
    office: d.office,
    supervisorName: d.application.approval?.byName ?? "Authorized Supervisor",
    receiptNumber: d.payment?.receiptNumber,
  };
}

/** Print Certificate / Print Registration Label buttons with previews. `autoOpen` supports ?print= links. */
export function RegistrationDocButtons({ detail, autoOpen, size = "md" }: { detail: RegistrationDetail; autoOpen?: "certificate" | "label" | null; size?: "md" | "lg" }) {
  const [open, setOpen] = useState<null | "certificate" | "label">(null);
  const data = certificateData(detail);
  useEffect(() => {
    if (autoOpen && data) setOpen(autoOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, !!data]);
  if (!data) return null;
  const id = detail.application.id;
  const cls = size === "lg" ? "btn-lg" : "";
  return (
    <>
      <button type="button" className={`btn btn-p ${cls}`} onClick={() => setOpen("certificate")}><Award size={16} aria-hidden="true" />Print Certificate</button>
      <button type="button" className={`btn btn-s ${cls}`} onClick={() => setOpen("label")} disabled={!data.application.plateNumber && !data.motorcycle.plateNumber}><Tag size={16} aria-hidden="true" />Print Registration Label</button>
      <PrintPreview open={open === "certificate"} onClose={() => setOpen(null)} title="Certificate of Registration (A4)" page="A4" elementId={`cert-${id}`} naturalWidth={794} audit={{ applicationId: id, what: "certificate" }}>
        <CertificateOfRegistration data={data} id={`cert-${id}`} />
      </PrintPreview>
      <PrintPreview open={open === "label"} onClose={() => setOpen(null)} title="Registration label (100 × 70 mm)" page="label" elementId={`label-${id}`} naturalWidth={378} audit={{ applicationId: id, what: "label" }}>
        <RegistrationLabel data={data} id={`label-${id}`} />
      </PrintPreview>
    </>
  );
}
