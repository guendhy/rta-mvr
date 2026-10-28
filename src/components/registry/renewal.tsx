"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";
import { friendlyError } from "@/lib/errors";
import { getTransactionType, transactionLabel } from "@/config/transaction-types";
import type { ApplicationPaymentState } from "@/config/statuses";
import { registrationService } from "@/services/registration.service";
import type { Payment, RegistrationApplication, TransactionType, Vehicle } from "@/types";

/** Application statuses that close a transaction (anything else is "open"). */
export const CLOSED_STATUSES: RegistrationApplication["status"][] = ["registered", "rejected", "cancelled"];

export function isOpen(app: RegistrationApplication) {
  return !CLOSED_STATUSES.includes(app.status);
}

/** Where an application is continued (open) or reviewed (closed). */
export function applicationHref(app: Pick<RegistrationApplication, "id" | "status">): string {
  return CLOSED_STATUSES.includes(app.status) ? `/registrations/${app.id}` : `/registrations/new?id=${app.id}`;
}

/** Days until registration expiry (negative = already expired), or null when not registered. */
export function daysToExpiry(v: Pick<Vehicle, "registrationExpiry"> | null | undefined): number | null {
  if (!v?.registrationExpiry) return null;
  return differenceInCalendarDays(new Date(v.registrationExpiry), new Date());
}

export function expiryText(days: number | null): string {
  if (days === null) return "Not registered";
  if (days < 0) return `Expired ${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** Expiration period filter used by the registry and renewal screens. */
export type ExpiryPeriod = "" | "expired" | "30" | "60" | "90";
export const EXPIRY_PERIOD_OPTIONS: { value: Exclude<ExpiryPeriod, "">; label: string }[] = [
  { value: "expired", label: "Expired" },
  { value: "30", label: "Expiring in the next 30 days" },
  { value: "60", label: "Expiring in the next 60 days" },
  { value: "90", label: "Expiring in the next 90 days" },
];

export function parseExpiryPeriod(v: string | null | undefined): ExpiryPeriod {
  return v === "expired" || v === "30" || v === "60" || v === "90" ? v : "";
}

export function matchesExpiryPeriod(days: number | null, period: ExpiryPeriod): boolean {
  if (!period) return true;
  if (days === null) return false;
  if (period === "expired") return days < 0;
  return days >= 0 && days <= Number(period);
}

const PAID_STATES: RegistrationApplication["status"][] = ["paid", "for_approval", "approved", "registered"];
const FAILED_PAYMENTS: Payment["status"][] = ["declined", "failed", "timeout", "cancelled", "unknown"];

/**
 * Summary payment state of an application: paid once the payment is taken, unpaid while
 * the assessment waits for payment (failed if the latest attempt did not go through),
 * otherwise not yet due.
 */
export function applicationPaymentState(app: RegistrationApplication, payments: Payment[] = []): ApplicationPaymentState {
  if (PAID_STATES.includes(app.status) || payments.some((p) => p.applicationId === app.id && p.status === "successful")) return "paid";
  if (app.status === "payment_required") {
    const latest = payments.filter((p) => p.applicationId === app.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return latest && FAILED_PAYMENTS.includes(latest.status) ? "failed" : "unpaid";
  }
  return "not_due";
}

export interface StartResult {
  app?: RegistrationApplication;
  error?: string;
}

/**
 * Starts a transaction for a vehicle already on the registry and opens it in the
 * registration wizard. On failure shows a toast (linking to any open application) and
 * returns the message so screens can react (e.g. "Registration already renewed").
 */
export function useStartTransaction() {
  const router = useRouter();
  const [busy, setBusy] = useState<{ vehicleId: string; type: TransactionType } | null>(null);

  const start = useCallback(async (type: TransactionType, vehicleId: string, opts: { quiet?: boolean } = {}): Promise<StartResult> => {
    setBusy({ vehicleId, type });
    try {
      const app = type === "renewal" ? await registrationService.createRenewal(vehicleId) : await registrationService.createForVehicle(type, vehicleId);
      toast.success(`${transactionLabel(type)} ${app.transactionNumber} started`, { description: "A new transaction was created — the existing registration history is kept." });
      router.push(`/registrations/new?id=${app.id}`);
      return { app };
    } catch (e) {
      const msg = friendlyError(e, `The ${transactionLabel(type).toLowerCase()} could not be started.`);
      if (!opts.quiet) {
        let open: RegistrationApplication | undefined;
        try {
          open = (await registrationService.list()).find((a) => a.vehicleId === vehicleId && isOpen(a));
        } catch {
          /* ignore lookup failure — the original error is shown */
        }
        toast.error(`${getTransactionType(type).shortLabel} not started`, {
          description: msg,
          action: open ? { label: `Open ${open.transactionNumber}`, onClick: () => router.push(applicationHref(open)) } : undefined,
        });
      }
      return { error: msg };
    } finally {
      setBusy(null);
    }
  }, [router]);

  return { start, busy };
}

/** Starts a renewal for a vehicle (thin wrapper kept for existing callers). */
export function useStartRenewal() {
  const { start, busy } = useStartTransaction();
  const startRenewal = useCallback(async (vehicleId: string) => (await start("renewal", vehicleId)).app, [start]);
  return { start: startRenewal, busyId: busy?.vehicleId ?? null };
}

/** PNG-style number plate. */
export function PlateChip({ plate, size = "md" }: { plate?: string | null; size?: "sm" | "md" | "lg" }) {
  if (!plate) return <span className="mut text-[13px]">No plate</span>;
  const cls = size === "lg"
    ? "px-4 py-2 text-[24px] sm:text-[30px] tracking-[.1em] border-[3px] sm:border-4 rounded-[8px]"
    : size === "sm"
      ? "px-2 py-0.5 text-[12.5px] tracking-[.06em] border-[1.5px] rounded-[4px]"
      : "px-2.5 py-1 text-[14px] tracking-[.06em] border-2 rounded-[6px]";
  return (
    <span className={`mono inline-block flex-none border-[#0b0b0f] bg-white font-bold whitespace-nowrap text-[#0b0b0f] ${cls}`}>
      <span className="sr">Plate </span>{plate}
    </span>
  );
}

/** Workflow strip for a transaction type (informational), from the transaction catalogue. */
export function TransactionSteps({ type, current }: { type: TransactionType; current?: number }) {
  const steps = getTransactionType(type).steps;
  return (
    <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={`${transactionLabel(type)} workflow`}>
      {steps.map((s, i) => {
        const state = current === undefined ? "todo" : i < current ? "done" : i === current ? "now" : "todo";
        const dot = state === "done" ? "bg-[#137a3b] text-white" : state === "now" ? "bg-[#1515e8] text-white" : "bg-[#e6e6fd] text-[#1010a8]";
        return (
          <li key={s} className={`flex items-center gap-2 rounded-full border bg-white py-1 pr-3 pl-1 text-[12.5px] font-semibold ${state === "now" ? "border-[#1515e8]" : "border-[#e1e4ea]"}`} aria-current={state === "now" ? "step" : undefined}>
            <span className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11.5px] font-bold ${dot}`} aria-hidden="true">{state === "done" ? "✓" : i + 1}</span>
            <span><span className="sr">Step {i + 1}{state === "done" ? " (complete)" : state === "now" ? " (current)" : ""}: </span>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function RenewalSteps() {
  return <TransactionSteps type="renewal" />;
}
