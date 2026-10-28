"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";
import { friendlyError } from "@/lib/errors";
import { registrationService } from "@/services/registration.service";
import type { Motorcycle, RegistrationApplication } from "@/types";

/** Application statuses that close a transaction (anything else is "open"). */
export const CLOSED_STATUSES: RegistrationApplication["status"][] = ["registered", "rejected", "cancelled"];

export function isOpen(app: RegistrationApplication) {
  return !CLOSED_STATUSES.includes(app.status);
}

/** Days until registration expiry (negative = already expired), or null when not registered. */
export function daysToExpiry(m: Pick<Motorcycle, "registrationExpiry"> | null | undefined): number | null {
  if (!m?.registrationExpiry) return null;
  return differenceInCalendarDays(new Date(m.registrationExpiry), new Date());
}

export function expiryText(days: number | null): string {
  if (days === null) return "Not registered";
  if (days < 0) return `Expired ${Math.abs(days)} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/**
 * Starts a renewal transaction for a motorcycle and opens it in the registration wizard.
 * If an application is already open, shows an error toast that links to it.
 */
export function useStartRenewal() {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const start = useCallback(async (motorcycleId: string) => {
    setBusyId(motorcycleId);
    try {
      const app = await registrationService.createRenewal(motorcycleId);
      toast.success(`Renewal ${app.transactionNumber} started`, { description: "A new transaction was created — the previous registration is kept in history." });
      router.push(`/registrations/new?id=${app.id}`);
      return app;
    } catch (e) {
      const msg = friendlyError(e, "The renewal could not be started.");
      let open: RegistrationApplication | undefined;
      try {
        open = (await registrationService.list()).find((a) => a.motorcycleId === motorcycleId && isOpen(a));
      } catch {
        /* ignore lookup failure — the original error is shown */
      }
      toast.error("Renewal not started", {
        description: msg,
        action: open ? { label: `Open ${open.transactionNumber}`, onClick: () => router.push(open.type === "renewal" ? `/registrations/new?id=${open.id}` : `/registrations/${open.id}`) } : undefined,
      });
      return undefined;
    } finally {
      setBusyId(null);
    }
  }, [router]);

  return { start, busyId };
}

/** Yellow PNG-style number plate. */
export function PlateChip({ plate, size = "md" }: { plate?: string | null; size?: "sm" | "md" | "lg" }) {
  if (!plate) return <span className="mut text-[13px]">No plate</span>;
  const cls = size === "lg"
    ? "px-4 py-2 text-[26px] sm:text-[34px] tracking-[.08em] border-[3px] rounded-[10px]"
    : size === "sm"
      ? "px-2 py-0.5 text-[12.5px] tracking-[.06em] border-2 rounded-[5px]"
      : "px-2.5 py-1 text-[14px] tracking-[.06em] border-2 rounded-[6px]";
  return (
    <span className={`mono inline-block border-[#0b0b0f] bg-[#FFD21A] font-extrabold whitespace-nowrap text-[#0b0b0f] ${cls}`}>
      <span className="sr">Plate </span>{plate}
    </span>
  );
}

/** Renewal workflow strip (informational). */
export const RENEWAL_STEPS = ["Find Registration", "Review Owner", "Review Motorcycle", "Inspection", "Insurance", "Assessment", "Payment", "Approval", "Renewed"];

export function RenewalSteps() {
  return (
    <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Renewal workflow">
      {RENEWAL_STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2 rounded-full border border-[#e1e4ea] bg-white py-1 pr-3 pl-1 text-[12.5px] font-semibold">
          <span className={`grid h-6 w-6 flex-none place-items-center rounded-full text-[11.5px] font-bold ${i === RENEWAL_STEPS.length - 1 ? "bg-[#137a3b] text-white" : "bg-[#e6e6fd] text-[#1010a8]"}`} aria-hidden="true">{i + 1}</span>
          <span><span className="sr">Step {i + 1}: </span>{s}</span>
        </li>
      ))}
    </ol>
  );
}
