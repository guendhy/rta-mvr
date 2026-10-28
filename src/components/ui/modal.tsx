"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = node?.querySelector<HTMLElement>("[data-autofocus], input, select, textarea, button:not([data-close])");
    (focusable ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && node) {
        const items = [...node.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])")];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <div className="no-print fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(11,11,15,.55)] p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={`card flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-b-none shadow-2xl sm:rounded-xl`}>
        <div className="flex items-start justify-between gap-3 border-b border-[#e1e4ea] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="h2 text-[18px]">{title}</h2>
            {description && <div className="mut mt-1 text-[13.5px]">{description}</div>}
          </div>
          <button type="button" data-close className="btn btn-g btn-icon -mr-2 -mt-1" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2.5 border-t border-[#e1e4ea] bg-[#f7f8fa] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

/** Confirmation for critical actions. Set `requireReason` for return / reject style actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  tone = "primary",
  requireReason,
  reasonLabel = "Reason",
  busy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger" | "success" | "dark";
  requireReason?: boolean;
  reasonLabel?: string;
  busy?: boolean;
  children?: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const id = useId();
  useEffect(() => {
    if (open) {
      setReason("");
      setTouched(false);
    }
  }, [open]);
  const invalid = requireReason && reason.trim().length < 5;
  const cls = { primary: "btn-p", danger: "btn-d", success: "btn-ok", dark: "btn-k" }[tone];
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-s" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={`btn ${cls}`}
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (invalid) return;
              onConfirm(reason.trim());
            }}
          >
            {busy && <span className="spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4 text-[14px] leading-relaxed">
        <div>{message}</div>
        {children}
        {requireReason && (
          <div>
            <label htmlFor={id} className="lbl">{reasonLabel}<span className="req">*</span></label>
            <textarea id={id} data-autofocus className={`inp ${touched && invalid ? "inp-err" : ""}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            {touched && invalid ? <p className="err">Enter a reason of at least 5 characters.</p> : <p className="help">The reason is recorded in the audit log and shown to the officer.</p>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function Drawer({ open, onClose, title, children, side = "left" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; side?: "left" | "right" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[70] bg-[rgba(11,11,15,.5)]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`absolute top-0 bottom-0 flex w-[88%] max-w-[340px] flex-col bg-white shadow-2xl ${side === "left" ? "left-0" : "right-0"}`}>
        <div className="flex items-center justify-between border-b border-[#e1e4ea] px-4 py-3">
          <p className="h3">{title}</p>
          <button type="button" className="btn btn-g btn-icon" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
