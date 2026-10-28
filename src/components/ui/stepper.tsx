"use client";

import { Check } from "lucide-react";
import { WIZARD_STEPS } from "@/lib/constants";

/** Registration stepper. Desktop shows all 8 steps; small screens show "Step n of 8". */
export function Stepper({ current, maxReachable, completedThrough, onSelect }: { current: number; maxReachable: number; completedThrough: number; onSelect?: (n: number) => void }) {
  const step = WIZARD_STEPS[current - 1];
  return (
    <nav aria-label="Registration progress" className="no-print">
      <div className="card flex items-center justify-between gap-3 px-4 py-3 md:hidden">
        <div>
          <p className="eb">Step {current} of {WIZARD_STEPS.length}</p>
          <p className="m-0 mt-0.5 text-[16px] font-bold text-[#1515e8]">{step.label}</p>
        </div>
        <div className="flex gap-1" aria-hidden="true">
          {WIZARD_STEPS.map((s) => (
            <span key={s.n} className="h-2 w-4 rounded-full" style={{ background: s.n === current ? "#1515e8" : s.n <= completedThrough ? "#137a3b" : "#e1e4ea" }} />
          ))}
        </div>
      </div>
      <div className="card hidden overflow-x-auto px-[18px] py-4 md:block">
        <ol className="m-0 grid min-w-[760px] list-none grid-cols-8 p-0">
          {WIZARD_STEPS.map((s) => {
            const done = s.n <= completedThrough && s.n !== current;
            const isCurrent = s.n === current;
            const reachable = s.n <= maxReachable;
            const bg = done ? "#137a3b" : isCurrent ? "#1515e8" : "#fff";
            const bd = done ? "#137a3b" : isCurrent ? "#1515e8" : "#c9ced8";
            return (
              <li key={s.n} className="relative flex flex-col gap-2">
                <div className="flex items-center">
                  <button
                    type="button"
                    disabled={!reachable || !onSelect}
                    onClick={() => onSelect?.(s.n)}
                    aria-current={isCurrent ? "step" : undefined}
                    aria-label={`Step ${s.n} ${s.label}${done ? ", completed" : isCurrent ? ", current" : ""}`}
                    className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 text-[14px] font-bold disabled:cursor-not-allowed"
                    style={{ background: bg, borderColor: bd, color: done || isCurrent ? "#fff" : "#5a606c", boxShadow: isCurrent ? "0 0 0 4px #dcdcfc" : undefined }}
                  >
                    {done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : s.n}
                  </button>
                  <div className="mx-2 h-0.5 flex-1" style={{ background: s.n === 8 ? "transparent" : done ? "#137a3b" : "#e1e4ea" }} />
                </div>
                <div className="pr-2">
                  <p className="m-0 text-[11px] font-bold uppercase tracking-[.06em] text-[#5a606c]">Step {s.n}</p>
                  <p className="m-0 mt-0.5 text-[14px]" style={{ fontWeight: isCurrent ? 700 : 600, color: isCurrent ? "#1515e8" : done ? "#0b0b0f" : "#5a606c" }}>{s.label}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
