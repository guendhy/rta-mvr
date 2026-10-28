"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { formatDateLong, fullName, motorcycleLabel } from "@/lib/formatting";
import { useDemoUser } from "@/hooks/use-demo-user";
import { ReceiptButtons } from "@/components/payments/receipt-buttons";
import { Flag } from "@/components/ui/layout-bits";
import { RegistrationDocButtons } from "./registration-docs";
import type { RegistrationDetail } from "@/services/interfaces";

/** "Motorcycle registered successfully" screen (spec §40). */
export function RegistrationSuccess({ detail, autoPrint }: { detail: RegistrationDetail; autoPrint?: "certificate" | "label" | null }) {
  const { can } = useDemoUser();
  const a = detail.application;
  const plate = a.plateNumber ?? detail.motorcycle?.plateNumber;
  return (
    <div className="card overflow-hidden">
      <Flag height={6} />
      <div className="flex flex-col items-center gap-3 px-6 pt-8 pb-6 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-[#137a3b]"><Check size={34} strokeWidth={3} className="text-white" aria-hidden="true" /></span>
        <p className="eb !text-[#137a3b]">{a.type === "renewal" ? "Renewal complete" : "Registration complete"}</p>
        <h2 className="m-0 text-[24px] font-extrabold tracking-[-.01em] sm:text-[30px]">{a.type === "renewal" ? "MOTORCYCLE REGISTRATION RENEWED" : "MOTORCYCLE REGISTERED SUCCESSFULLY"}</h2>
        {plate && <p className="mono m-0 rounded-md bg-[#ffd21a] px-5 py-2 text-[32px] font-bold tracking-[.08em]">{plate}</p>}
      </div>
      <dl className="mx-auto grid max-w-3xl grid-cols-1 gap-x-8 gap-y-3 border-t border-[#edeff3] px-6 py-6 text-[14px] sm:grid-cols-2">
        {[
          ["Registration Number", <span key="r" className="mono">{a.registrationNumber}</span>],
          ["Plate Number", <span key="p" className="mono">{plate ?? "—"}</span>],
          ["Owner", fullName(detail.owner)],
          ["Motorcycle", `${motorcycleLabel(detail.motorcycle)} · ${detail.motorcycle?.color ?? ""}`],
          ["Registration Date", formatDateLong(a.registrationDate)],
          ["Expiry Date", <strong key="e">{formatDateLong(a.expiryDate)}</strong>],
          ["Certificate Number", <span key="c" className="mono">{a.certificateNumber}</span>],
          ["Label Number", <span key="l" className="mono">{a.labelNumber}</span>],
        ].map(([k, v]) => (
          <div key={String(k)} className="flex justify-between gap-4 border-b border-[#f1f2f5] pb-2">
            <dt className="mut">{k}</dt><dd className="m-0 text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap justify-center gap-2.5 border-t border-[#edeff3] bg-[#f7f8fa] px-6 py-5">
        <RegistrationDocButtons detail={detail} autoOpen={autoPrint} />
        {detail.payment && <ReceiptButtons paymentId={detail.payment.id} applicationId={a.id} />}
        <Link href={`/registrations/${a.id}`} className="btn btn-s">View Registration</Link>
        {detail.motorcycle && <Link href={`/registry/${detail.motorcycle.id}`} className="btn btn-g">Motorcycle profile</Link>}
        {can("registration.create") && <Link href="/registrations/new" className="btn btn-g"><Plus size={16} aria-hidden="true" />Start New Registration</Link>}
      </div>
    </div>
  );
}
