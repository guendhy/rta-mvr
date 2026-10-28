"use client";

import { useState } from "react";
import { Printer, Receipt } from "lucide-react";
import { paymentService } from "@/services/payment.service";
import { useServiceQuery } from "@/hooks/use-service";
import { A4Receipt, ThermalReceipt } from "@/components/printing/documents";
import { PrintPreview } from "@/components/printing/print-preview";

/** "Print Receipt" buttons with 58 mm thermal and A4 previews. */
export function ReceiptButtons({ paymentId, applicationId, size = "md" }: { paymentId: string; applicationId?: string; size?: "md" | "lg" }) {
  const [open, setOpen] = useState<null | "58mm" | "A4">(null);
  const { data } = useServiceQuery(() => paymentService.getReceiptData(paymentId), [paymentId]);
  const cls = size === "lg" ? "btn-lg" : "";
  return (
    <>
      <button type="button" className={`btn btn-k ${cls}`} disabled={!data} onClick={() => setOpen("58mm")}><Receipt size={16} aria-hidden="true" />Print Receipt (58mm)</button>
      <button type="button" className={`btn btn-s ${cls}`} disabled={!data} onClick={() => setOpen("A4")}><Printer size={16} aria-hidden="true" />A4 Receipt</button>
      {data && (
        <>
          <PrintPreview open={open === "58mm"} onClose={() => setOpen(null)} title="58 mm thermal receipt" page="58mm" elementId={`rcpt-58-${paymentId}`} naturalWidth={220} receipt={data} audit={{ applicationId, what: "receipt" }}>
            <ThermalReceipt data={data} id={`rcpt-58-${paymentId}`} />
          </PrintPreview>
          <PrintPreview open={open === "A4"} onClose={() => setOpen(null)} title="A4 official receipt" page="A4" elementId={`rcpt-a4-${paymentId}`} naturalWidth={794} audit={{ applicationId, what: "receipt" }}>
            <A4Receipt data={data} id={`rcpt-a4-${paymentId}`} />
          </PrintPreview>
        </>
      )}
    </>
  );
}
