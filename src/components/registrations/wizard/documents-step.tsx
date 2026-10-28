"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { registrationService } from "@/services/registration.service";
import { documentsChecklist } from "@/lib/workflow";
import { DOCUMENT_TYPES } from "@/lib/constants";
import { Alert } from "@/components/ui/feedback";
import { DocumentsPanel } from "../documents-panel";
import type { StepProps } from "./types";

export function DocumentsStep({ detail, editable, registerApi }: StepProps) {
  const app = detail.application;
  const docs = documentsChecklist(app);
  const latest = useRef(detail);
  latest.current = detail;

  useEffect(() => {
    registerApi({
      continueLabel: editable ? (app.status === "returned" ? "Resubmit Application" : "Submit Application") : "Continue",
      continue: async () => {
        if (!editable) return true;
        const check = documentsChecklist(latest.current.application);
        if (!check.present) {
          toast.error(`Upload the required documents: ${check.missing.map((m) => DOCUMENT_TYPES.find((d) => d.type === m)?.label).join(", ")}.`);
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
      {app.type === "new" && (
        <Alert tone={docs.present ? "ok" : "info"} title={docs.present ? "All required documents uploaded" : `${docs.missing.length} required document(s) missing`}>
          Required: Owner Identification, Proof of Ownership and Import/Purchase Documents. All required documents must be <strong>verified</strong> before supervisor approval.
        </Alert>
      )}
      <DocumentsPanel application={app} canUpload={editable} />
    </div>
  );
}
