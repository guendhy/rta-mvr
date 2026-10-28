"use client";

import { useEffect, useRef, useState } from "react";
import { Printer, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { friendlyError } from "@/lib/errors";
import { browserPrinter, posPrinter } from "@/services/printer.service";
import { registrationService } from "@/services/registration.service";
import { printElement, type PrintPage } from "@/lib/print";
import type { ReceiptData } from "@/types";

/**
 * Shows a document scaled to fit, with "Print" (browser dialog) and, for receipts,
 * "Print on POS" (simulated terminal printer that honours Demo Tools printer errors).
 */
export function PrintPreview({
  open,
  onClose,
  title,
  page,
  elementId,
  naturalWidth,
  children,
  receipt,
  audit,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  page: PrintPage;
  elementId: string;
  naturalWidth: number;
  children: React.ReactNode;
  receipt?: ReceiptData;
  audit?: { applicationId?: string; what: "certificate" | "label" | "receipt" };
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fit = () => {
      const w = wrap.current?.clientWidth ?? naturalWidth;
      const sc = Math.min(1, (w - 8) / naturalWidth);
      setScale(sc);
      requestAnimationFrame(() => setHeight(inner.current ? inner.current.offsetHeight * sc : undefined));
    };
    fit();
    const t = setTimeout(fit, 400);
    window.addEventListener("resize", fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", fit);
    };
  }, [open, naturalWidth]);

  const record = () => audit?.applicationId && registrationService.recordPrint(audit.applicationId, audit.what);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size={naturalWidth > 500 ? "xl" : "md"}
      footer={
        <>
          <button type="button" className="btn btn-s" onClick={onClose}>Close</button>
          {receipt && (
            <button type="button" className="btn btn-s" disabled={busy} onClick={async () => {
              setBusy(true);
              try {
                await posPrinter.printReceipt({ ...receipt, elementId, format: "58mm" });
                record();
                toast.success("Receipt printed on the POS terminal (simulated)");
              } catch (e) {
                toast.error(friendlyError(e), { description: "Use the browser printer or fix the terminal printer in Demo Tools." });
              } finally {
                setBusy(false);
              }
            }}>
              {busy ? <span className="spin" aria-hidden="true" /> : <Smartphone size={16} aria-hidden="true" />}Print on POS
            </button>
          )}
          <button type="button" className="btn btn-k" onClick={async () => {
            if (receipt) await browserPrinter.printReceipt({ ...receipt, elementId, format: page === "58mm" ? "58mm" : "A4" });
            else await printElement(elementId, page);
            record();
          }}>
            <Printer size={16} aria-hidden="true" />Print
          </button>
        </>
      }
    >
      <div ref={wrap} className="flex justify-center rounded-lg bg-[#e7e9ee] p-3">
        <div style={{ width: naturalWidth * scale, height, overflow: "hidden" }}>
          <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: naturalWidth, boxShadow: "0 8px 30px rgba(11,11,15,.18)" }}>{children}</div>
        </div>
      </div>
    </Modal>
  );
}
