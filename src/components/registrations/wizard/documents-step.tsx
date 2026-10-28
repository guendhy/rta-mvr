"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { registrationService } from "@/services/registration.service";
import { documentsChecklist } from "@/lib/workflow";
import { documentLabel } from "@/config/document-requirements";
import { Alert } from "@/components/ui/feedback";
import { DocumentsPanel } from "../documents-panel";
import type { StepProps } from "./types";

export function DocumentsStep({ detail, editable, registerApi }: StepProps) {
  const app = detail.application;
  const docs = documentsChecklist({ documents: app.documents.filter((d) => d.type !== "inspection_certificate" && d.type !== "insurance_certificate") });
  const latest = useRef(detail);
  latest.current = detail;

  useEffect(() => {
    registerApi({
      continueLabel: editable ? (app.status === "returned" ? "Resubmit Application" : "Submit Application") : "Continue",
      continue: async () => {
        if (!editable) return true;
        const check = documentsChecklist({ documents: latest.current.application.documents.filter((d) => d.type !== "inspection_certificate" && d.type !== "insurance_certificate") });
        if (!check.present) {
          toast.error(`Required document missing: ${check.missing.map((m) => documentLabel(m)).join(", ")}.`);
          return false;
        }
        const updated = await registrationService.submit(app.id);
        toast.success(`${updated.transactionNumber} submitted`, { description: "The application moved to the next stage." });
        return true;
      },
    });
    return () => registerApi(null);
  }, [editable, app.id, app.status, registerApi]);

  return (
    <div className="flex flex-col gap-5">
      {app.status === "returned" && app.returnReason && (
        <Alert tone="warn" title="Returned for correction">{app.returnReason} — correct the details, then resubmit.</Alert>
      )}
      {docs.required.length > 0 && (
        <Alert tone={docs.present ? "ok" : "info"} title={docs.present ? "All required documents uploaded" : `${docs.missing.length} required document(s) missing`}>
          Requirements depend on the transaction, vehicle type, vehicle use and ownership type. Generated documents (inspection certificate, insurance) are attached in later steps. All required documents must be <strong>verified</strong> before supervisor approval.
        </Alert>
      )}
      <DocumentsPanel application={app} canUpload={editable} />
    </div>
  );
}
