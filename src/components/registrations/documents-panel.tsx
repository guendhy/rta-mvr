"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, FileText, XCircle } from "lucide-react";
import { registrationService } from "@/services/registration.service";
import { useDemoUser } from "@/hooks/use-demo-user";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { friendlyError } from "@/lib/errors";
import { formatBytes, formatDateTime } from "@/lib/formatting";
import { previewStore } from "@/lib/preview-store";
import { FileDrop } from "@/components/ui/file-upload";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ApplicationDocument, RegistrationApplication } from "@/types";

/** Document cards with Upload / Preview / Replace / Verify / Reject (local simulation). */
export function DocumentsPanel({ application, canUpload }: { application: RegistrationApplication; canUpload: boolean }) {
  const { can } = useDemoUser();
  const canVerify = can("documents.verify");
  const [preview, setPreview] = useState<ApplicationDocument | null>(null);
  const [rejecting, setRejecting] = useState<ApplicationDocument | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const key = (d: ApplicationDocument) => `${application.id}:doc:${d.type}`;

  if (application.type === "renewal" && application.documents.length === 0) {
    return <Alert tone="info" title="No new documents required for renewal">Owner identification and ownership documents are already on record from the original registration. Roadworthiness and insurance are checked in the next steps.</Alert>;
  }

  const run = async (id: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="g2">
      {DOCUMENT_TYPES.map((def) => {
        const doc = application.documents.find((d) => d.type === def.type);
        if (!doc) return null;
        const isPdf = doc.file?.type === "application/pdf" || doc.file?.name.endsWith(".pdf");
        return (
          <div key={doc.id} className="card flex flex-col gap-3 p-[18px]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[15px] font-semibold">{def.label}{def.required && application.type === "new" && <span className="req" aria-label="required">*</span>}</p>
                <p className="mut m-0 mt-0.5 text-[12.5px]">{def.help}</p>
              </div>
              <StatusBadge kind="document" status={doc.status} />
            </div>
            {doc.file && (
              <div className="flex items-center gap-3">
                <div className={`grid h-14 w-11 flex-none place-items-center rounded-md text-[10px] font-bold ${isPdf ? "bg-[#fdecec] text-[#a3111a]" : "bg-[#e6e6fd] text-[#1010a8]"}`}>{isPdf ? "PDF" : "IMG"}</div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[13.5px] font-semibold">{doc.file.name}</p>
                  <p className="mut m-0 text-[12px]">{formatBytes(doc.file.size)} · {formatDateTime(doc.file.uploadedAt)}</p>
                  {doc.verifiedBy && doc.status !== "uploaded" && <p className="mut m-0 text-[12px]">{doc.status === "rejected" ? "Rejected" : "Verified"} by {doc.verifiedBy}</p>}
                </div>
              </div>
            )}
            {doc.status === "rejected" && doc.rejectionReason && <Alert tone="bad" title="Rejected">{doc.rejectionReason}</Alert>}
            {canUpload && doc.note !== "Generated from inspection" && (
              <FileDrop compact label={doc.file ? "Replace — drop file or browse" : "Upload — drop file or browse"} onFile={(file, meta) => {
                previewStore.set(key(doc), file);
                run(doc.id, () => registrationService.uploadDocument(application.id, doc.type, meta), `${def.label} uploaded`);
              }} />
            )}
            {doc.file && (
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className="btn btn-s btn-sm" onClick={() => setPreview(doc)}><Eye size={14} aria-hidden="true" />Preview</button>
                {canVerify && doc.status !== "verified" && (
                  <button type="button" className="btn btn-ok btn-sm" disabled={busy === doc.id} onClick={() => run(doc.id, () => registrationService.verifyDocument(application.id, doc.id), `${def.label} verified`)}>
                    {busy === doc.id ? <span className="spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}Verify
                  </button>
                )}
                {canVerify && doc.status !== "rejected" && (
                  <button type="button" className="btn btn-do btn-sm" onClick={() => setRejecting(doc)}><XCircle size={14} aria-hidden="true" />Reject</button>
                )}
              </div>
            )}
            {!doc.file && !canUpload && <p className="mut m-0 text-[13px]">Not uploaded.</p>}
          </div>
        );
      })}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={DOCUMENT_TYPES.find((d) => d.type === preview?.type)?.label ?? "Document"} size="lg" description={preview?.file?.name}>
        {preview && (() => {
          const local = previewStore.get(key(preview));
          if (!local) return (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <FileText size={40} className="text-[#5a606c]" aria-hidden="true" />
              <p className="mut m-0 max-w-md text-[14px]">This prototype keeps uploaded files only in the current browser session. The file details are saved: <strong>{preview.file?.name}</strong> ({formatBytes(preview.file?.size ?? 0)}).</p>
            </div>
          );
          return local.type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={local.url} alt="Document preview" className="max-h-[70vh] w-full rounded-md object-contain" />
          ) : (
            <object data={local.url} type={local.type} className="h-[70vh] w-full rounded-md" aria-label="Document preview"><p>Preview not supported — the file is stored locally.</p></object>
          );
        })()}
      </Modal>
      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject document"
        message={<>Reject <strong>{DOCUMENT_TYPES.find((d) => d.type === rejecting?.type)?.label}</strong>? The officer must upload a replacement.</>}
        confirmLabel="Reject Document"
        tone="danger"
        requireReason
        reasonLabel="Rejection reason"
        busy={!!busy}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          await run(rejecting.id, () => registrationService.rejectDocument(application.id, rejecting.id, reason), "Document rejected");
          setRejecting(null);
        }}
      />
    </div>
  );
}
