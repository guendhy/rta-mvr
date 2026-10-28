"use client";

import { transferSchema } from "@/lib/validation/schemas";
import { Field, Input, Select } from "@/components/ui/form";
import type { TransferDetails } from "@/types";

export type TransferReason = TransferDetails["reason"];

export const TRANSFER_REASONS: { value: TransferReason; label: string }[] = [
  { value: "sale", label: "Sale" },
  { value: "gift", label: "Gift" },
  { value: "inheritance", label: "Inheritance" },
  { value: "court_order", label: "Court order" },
  { value: "company_restructure", label: "Company restructure" },
  { value: "other", label: "Other" },
];

export function transferReasonLabel(value: string | undefined): string {
  return TRANSFER_REASONS.find((r) => r.value === value)?.label ?? (value ? value.replace(/_/g, " ") : "—");
}

export interface SaleDetailsValues {
  saleDate: string;
  salePrice: string;
  reason: TransferReason;
  sellerConsent: boolean;
}

export type SaleDetailsErrors = Partial<Record<keyof SaleDetailsValues, string>>;

export const EMPTY_SALE_DETAILS: SaleDetailsValues = { saleDate: "", salePrice: "", reason: "sale", sellerConsent: false };

/** Validates with the shared transfer schema; returns field errors or the parsed values. */
export function validateSaleDetails(values: SaleDetailsValues): { errors: SaleDetailsErrors } | { data: { saleDate: string; salePrice?: number; reason: TransferReason; sellerConsent: true } } {
  const parsed = transferSchema.safeParse({ ...values, salePrice: values.salePrice.trim() });
  if (!parsed.success) {
    const errors: SaleDetailsErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof SaleDetailsValues;
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }
  const price = parsed.data.salePrice;
  return { data: { saleDate: parsed.data.saleDate, salePrice: typeof price === "number" ? price : undefined, reason: parsed.data.reason, sellerConsent: true } };
}

/** Sale date, price, reason and seller consent — the details captured before the new owner. */
export function SaleDetailsForm({ values, errors, onChange, disabled }: { values: SaleDetailsValues; errors: SaleDetailsErrors; onChange: (v: SaleDetailsValues) => void; disabled?: boolean }) {
  const set = <K extends keyof SaleDetailsValues>(k: K, v: SaleDetailsValues[K]) => onChange({ ...values, [k]: v });
  const today = new Date().toISOString().slice(0, 10);
  const priceOptional = values.reason !== "sale";
  return (
    <fieldset className="form m-0 border-0 p-0" disabled={disabled}>
      <legend className="sr">Sale details</legend>
      <Field label="Sale / transfer date" htmlFor="tr-date" required error={errors.saleDate}>
        <Input id="tr-date" type="date" max={today} value={values.saleDate} onChange={(e) => set("saleDate", e.target.value)} invalid={!!errors.saleDate} />
      </Field>
      <Field label="Reason for transfer" htmlFor="tr-reason" required error={errors.reason}>
        <Select id="tr-reason" value={values.reason} onChange={(e) => set("reason", e.target.value as TransferReason)} options={TRANSFER_REASONS} invalid={!!errors.reason} />
      </Field>
      <Field label={`Sale price (PGK)${priceOptional ? " — optional" : ""}`} htmlFor="tr-price" error={errors.salePrice} help={priceOptional ? "Leave blank for gifts, inheritance and court orders." : "As stated on the bill of sale."}>
        <Input id="tr-price" type="number" inputMode="decimal" min={0} step="0.01" mono value={values.salePrice} onChange={(e) => set("salePrice", e.target.value)} invalid={!!errors.salePrice} placeholder="0.00" />
      </Field>
      <div className="full">
        <label className={`opt ${values.sellerConsent ? "opt-on" : ""} cursor-pointer items-start`} htmlFor="tr-consent">
          <input id="tr-consent" type="checkbox" className="chk mt-0.5" checked={values.sellerConsent} onChange={(e) => set("sellerConsent", e.target.checked)} aria-invalid={!!errors.sellerConsent || undefined} aria-describedby={errors.sellerConsent ? "tr-consent-err" : undefined} />
          <span className="min-w-0">
            <span className="block font-bold">Seller consent confirmed</span>
            <span className="mut block text-[13px] font-medium">The registered owner (seller) has signed the transfer form and their identification has been sighted.</span>
          </span>
        </label>
        {errors.sellerConsent && <p id="tr-consent-err" className="err" role="alert">{errors.sellerConsent}</p>}
      </div>
    </fieldset>
  );
}
