"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { formatDateTime } from "@/lib/formatting";
import { Flag } from "@/components/ui/layout-bits";
import { Skeleton } from "@/components/ui/feedback";

/** Shared chrome for the public QR verification pages (no login, no app shell). */
export function VerifyFrame({ title, children }: { title: string; children: React.ReactNode }) {
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  useEffect(() => setCheckedAt(formatDateTime(new Date())), []);
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f8]">
      <header className="bg-[#0b0b0f] text-white">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 px-4 py-4">
          <Image src="/brand/rta-logo.png" alt="Road Traffic Authority Papua New Guinea seal" width={52} height={52} priority className="h-[52px] w-[52px] flex-none" />
          <div className="min-w-0">
            <p className="m-0 text-[13px] font-extrabold tracking-[.1em]">ROAD TRAFFIC AUTHORITY</p>
            <p className="m-0 text-[12.5px] text-[#c4c7d0]">Papua New Guinea · {title}</p>
          </div>
        </div>
        <Flag height={5} />
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-4 px-4 py-6">{children}</main>
      <footer className="mx-auto w-full max-w-[560px] px-4 pb-6 text-center text-[12px] text-[#5a606c]">
        Official RTA verification service{checkedAt && <> · Checked {checkedAt}</>}
        <br />
        <span className="font-semibold">Demo Prototype — data is simulated.</span>
      </footer>
    </div>
  );
}

export function VerdictBanner({ tone, title, message, icon }: { tone: "ok" | "bad" | "warn"; title: string; message: string; icon: React.ReactNode }) {
  const style = { ok: "bg-[#137a3b] text-white", bad: "bg-[#c4141b] text-white", warn: "bg-[#ffd21a] text-[#0b0b0f]" }[tone];
  return (
    <section className={`flex flex-col items-center gap-2 rounded-xl px-5 py-7 text-center ${style}`} role="status" aria-live="polite">
      <span aria-hidden="true">{icon}</span>
      <h1 className="m-0 text-[26px] leading-tight font-extrabold tracking-[.02em] break-words sm:text-[30px]">{title}</h1>
      <p className="m-0 text-[14px] opacity-90">{message}</p>
    </section>
  );
}

export function VerifySkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Checking record">
      <Skeleton className="h-[170px] rounded-xl" />
      <Skeleton className="h-[220px] rounded-xl" />
    </div>
  );
}

export function VerifyDetail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#edeff3] py-3 last:border-0">
      <dt className="text-[13.5px] text-[#5a606c]">{label}</dt>
      <dd className="m-0 min-w-0 text-right text-[15px] font-bold break-words">{children}</dd>
    </div>
  );
}
