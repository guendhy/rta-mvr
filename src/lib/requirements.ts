import { DEFAULT_DOCUMENT_RULES, resolveDocumentRequirements, type DocumentRule } from "@/config/document-requirements";
import { inspectionRequiredFor } from "@/config/inspection-checklists";
import { getTransactionType } from "@/config/transaction-types";
import { uuid } from "./generators";
import type { ApplicationDocument, ImportStatus, OwnershipType, TransactionType, VehicleType, VehicleUsage } from "@/types";

export interface RequirementContext {
  transactionType: TransactionType;
  vehicleType?: VehicleType;
  vehicleUsage?: VehicleUsage;
  ownershipType?: OwnershipType;
  importStatus?: ImportStatus;
  technicalChange?: boolean;
}

/** Inspection, insurance, plate and document requirements for one application. */
export function resolveApplicationRequirements(ctx: RequirementContext, rules: DocumentRule[] = DEFAULT_DOCUMENT_RULES) {
  const def = getTransactionType(ctx.transactionType);
  return {
    inspectionRequired: inspectionRequiredFor(ctx),
    insuranceRequired: def.insurance,
    plateRequired: def.issuesPlate,
    documents: resolveDocumentRequirements(ctx, rules),
  };
}

/**
 * Re-applies document requirements without losing uploads: existing documents keep their
 * files and status, new requirements are added, and untouched ones that no longer apply
 * are dropped.
 */
export function syncDocuments(existing: ApplicationDocument[], resolved: ReturnType<typeof resolveDocumentRequirements>): ApplicationDocument[] {
  const out: ApplicationDocument[] = [];
  for (const r of resolved) {
    const prev = existing.find((d) => d.type === r.type);
    out.push(prev ? { ...prev, required: r.required, reason: r.reason } : { id: uuid(), type: r.type, status: "missing", required: r.required, reason: r.reason });
  }
  for (const d of existing) {
    if (!out.some((o) => o.type === d.type) && d.status !== "missing") out.push({ ...d, required: false, reason: d.reason ?? "Uploaded earlier" });
  }
  return out;
}
