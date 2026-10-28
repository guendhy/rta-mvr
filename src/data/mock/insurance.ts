import { INSURANCE_PROVIDERS } from "@/lib/constants";
import type { InsuranceRecord, InsuranceStatus } from "@/types";

export function buildInsurance(input: {
  id: string;
  applicationId: string;
  motorcycleId: string;
  policyHolder: string;
  vinOrChassis: string;
  at: string;
  status: InsuranceStatus;
  index: number;
  verifiedBy?: string;
}): InsuranceRecord {
  const start = new Date(input.at);
  const expiry = new Date(input.at);
  if (input.status === "expired") {
    start.setMonth(start.getMonth() - 13);
    expiry.setMonth(expiry.getMonth() - 1);
  } else {
    start.setDate(start.getDate() - 2);
    expiry.setFullYear(expiry.getFullYear() + 1);
  }
  const provider = INSURANCE_PROVIDERS[input.index % INSURANCE_PROVIDERS.length];
  const prefix = provider.includes("MVIL") ? "MVIL-TP" : provider.split(" ")[0].toUpperCase().slice(0, 4) + "-TP";
  return {
    id: input.id,
    applicationId: input.applicationId,
    motorcycleId: input.motorcycleId,
    provider,
    policyNumber: `${prefix}-${2026 - (input.status === "expired" ? 1 : 0)}-${String(40000 + input.index * 137).padStart(6, "0")}`,
    policyHolder: input.policyHolder,
    coverageStart: start.toISOString().slice(0, 10),
    coverageExpiry: expiry.toISOString().slice(0, 10),
    premium: 95 + (input.index % 4) * 15,
    vinOrChassis: input.vinOrChassis,
    certificate: { name: `third-party-certificate-${input.index + 1}.pdf`, size: 186_000 + input.index * 911, type: "application/pdf", uploadedAt: input.at },
    status: input.status,
    verifiedBy: input.status === "verified" ? input.verifiedBy : undefined,
    verifiedAt: input.status === "verified" ? input.at : undefined,
    remarks: input.status === "expired" ? "Policy expired — owner to provide a current third-party certificate." : undefined,
    createdAt: input.at,
    updatedAt: input.at,
  };
}
