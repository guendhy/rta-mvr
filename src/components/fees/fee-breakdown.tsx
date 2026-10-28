import { FEE_COMPONENTS } from "@/config/fee-rules";
import { formatMoney } from "@/lib/formatting";
import { Badge } from "@/components/ui/status-badge";
import type { Assessment, AssessmentLine } from "@/types";

/** Itemised fee assessment. Sample (non-official) amounts are labelled on every line. */
export function FeeBreakdown({ assessment, showBasis = true, compact }: { assessment: Pick<Assessment, "lines" | "total" | "containsSampleAmounts">; showBasis?: boolean; compact?: boolean }) {
  const ordered = [...assessment.lines].sort((a, b) => FEE_COMPONENTS.findIndex((c) => c.key === a.component) - FEE_COMPONENTS.findIndex((c) => c.key === b.component));
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[10px] border border-[#e1e4ea]">
        <table className="tbl">
          <thead><tr><th>Fee</th>{!compact && <th className="hidden sm:table-cell">Component</th>}<th className="num">Amount (PGK)</th></tr></thead>
          <tbody>
            {ordered.map((l: AssessmentLine) => (
              <tr key={l.feeCode}>
                <td>
                  <span className="font-semibold">{l.name}</span>
                  {l.sample && <Badge tone="soon" className="ml-2 align-middle">Sample</Badge>}
                  {showBasis && l.basis && <span className="mut block text-[12px]">{l.feeCode} · {l.basis}</span>}
                </td>
                {!compact && <td className="hidden text-[13px] sm:table-cell">{FEE_COMPONENTS.find((c) => c.key === l.component)?.label ?? "Other"}</td>}
                <td className="num font-semibold">{formatMoney(l.amount)}</td>
              </tr>
            ))}
            {ordered.length === 0 && <tr><td colSpan={compact ? 2 : 3} className="mut">No fees apply to this transaction.</td></tr>}
            <tr>
              <td colSpan={compact ? 1 : 2} className="!bg-[#0b0b0f] text-[15px] font-extrabold !text-white">TOTAL DUE</td>
              <td className="num !bg-[#0b0b0f] text-[18px] font-extrabold !text-[#ffd21a]">{formatMoney(assessment.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {assessment.containsSampleAmounts && (
        <p className="help m-0">Amounts marked <strong>Sample</strong> are illustrative placeholders from the configurable fee rules — not the official PNG RTA fee schedule.</p>
      )}
    </div>
  );
}
