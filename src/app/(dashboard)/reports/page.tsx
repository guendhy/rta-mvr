"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileText, Printer, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useServiceQuery } from "@/hooks/use-service";
import { REPORT_CATALOG } from "@/data/mock/reports";
import { downloadText, formatDateTime, formatMoney, toCsv } from "@/lib/formatting";
import { printElement } from "@/lib/print";
import { reportService } from "@/services/report.service";
import { settingsService } from "@/services/settings.service";
import { userService } from "@/services/user.service";
import { PageHeader, Section } from "@/components/ui/layout-bits";
import { Field } from "@/components/ui/form";
import { ErrorState, PageSkeleton, Skeleton, TableSkeleton } from "@/components/ui/feedback";
import { DataTable, MobileCard, type ColumnDef } from "@/components/ui/data-table";
import { Donut, GenericBar } from "@/components/dashboard/charts";
import { EMPTY_FILTERS, ReportFilterForm, activeFilters, describeFilters } from "@/components/reports/report-filters";
import type { ReportColumn, ReportFilters, ReportKey, ReportResult } from "@/types";

const PRINT_ID = "report-print-area";
const MONEY_KEYS = new Set(["amount", "tendered", "change"]);
const GROUPS = [...new Set(REPORT_CATALOG.map((r) => r.group))];

type Row = Record<string, string | number>;

function cellText(col: ReportColumn, v: string | number | undefined) {
  if (v === undefined || v === "") return "—";
  if (typeof v === "number" && MONEY_KEYS.has(col.key)) return formatMoney(v);
  return String(v);
}

function ReportsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("report");
  const [key, setKey] = useState<ReportKey>(REPORT_CATALOG.some((r) => r.key === initial) ? (initial as ReportKey) : REPORT_CATALOG[0].key);
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());
  const active = useMemo(() => activeFilters(filters), [filters]);
  const filterKey = JSON.stringify(active);
  const dateInvalid = !!(filters.from && filters.to && filters.from > filters.to);

  const lookups = useServiceQuery(async () => {
    const [offices, users] = await Promise.all([settingsService.listOffices(), userService.list()]);
    return { offices, users: [...users].sort((a, b) => a.firstName.localeCompare(b.firstName)) };
  }, []);

  const report = useServiceQuery<ReportResult | null>(async () => {
    if (dateInvalid) return null;
    const r = await reportService.run(key, active);
    setGeneratedAt(new Date());
    return r;
  }, [key, filterKey, dateInvalid]);

  const statusOptions = report.data?.key === key ? report.data.statusOptions : [];

  const selectReport = (k: ReportKey) => {
    setKey(k);
    setFilters((f) => ({ ...f, status: "" }));
    router.replace(`/reports?report=${k}`, { scroll: false });
  };

  if (lookups.error) return <ErrorState message={lookups.error} onRetry={() => lookups.reload()} />;
  if (!lookups.data) return <PageSkeleton />;
  const { offices, users } = lookups.data;
  const meta = REPORT_CATALOG.find((r) => r.key === key)!;
  const result = report.data && report.data.key === key ? report.data : null;
  const filterLines = describeFilters(active, offices, users);
  const filtersOn = filterLines.length > 0;
  const stamp = format(new Date(), "yyyyMMdd");
  const fileBase = `rta-${key.replace(/_/g, "-")}-${stamp}`;

  const exportCsv = (ext = "csv") => {
    if (!result) return;
    downloadText(`${fileBase}.${ext}`, toCsv(result.columns, result.rows));
  };
  const onCsv = () => { exportCsv(); toast.success("CSV exported", { description: `${fileBase}.csv · ${result?.rows.length ?? 0} rows` }); };
  const onExcel = () => { exportCsv(); toast.info("Excel export is simulated in Phase 1 — CSV downloaded instead", { description: `${fileBase}.csv opens in Excel.` }); };
  const onPrint = () => { printElement(PRINT_ID, "A4-landscape").catch((e: Error) => toast.error(e.message)); };
  const onPdf = () => { toast.info("PDF export is simulated in Phase 1", { description: "Choose \"Save as PDF\" in the print dialog." }); onPrint(); };

  const columns: ColumnDef<Row, unknown>[] = (result?.columns ?? []).map((c) => ({
    id: c.key,
    header: c.label,
    accessorFn: (r: Row) => r[c.key] ?? "",
    meta: { align: c.align },
    cell: ({ row }) => <span className={c.mono ? "mono" : ""}>{cellText(c, row.original[c.key])}</span>,
  }));

  const filterForm = (prefix: string) => (
    <ReportFilterForm idPrefix={prefix} value={filters} onChange={setFilters} offices={offices} users={users} statusOptions={statusOptions} />
  );
  const resetBtn = filtersOn ? <button type="button" className="btn btn-g btn-sm min-h-[44px]" onClick={() => setFilters(EMPTY_FILTERS)}><RotateCcw size={15} aria-hidden="true" />Reset filters</button> : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Reports"
        title="Reports"
        description="Interactive operational and revenue reports. Filters re-run the report instantly."
        actions={
          <>
            <button type="button" className="btn btn-s" onClick={onPrint} disabled={!result}><Printer size={16} aria-hidden="true" />Print</button>
            <button type="button" className="btn btn-s" onClick={onCsv} disabled={!result || !result.rows.length}><Download size={16} aria-hidden="true" />Export CSV</button>
            <button type="button" className="btn btn-s" onClick={onExcel} disabled={!result || !result.rows.length}><FileSpreadsheet size={16} aria-hidden="true" />Export Excel</button>
            <button type="button" className="btn btn-s" onClick={onPdf} disabled={!result}><FileText size={16} aria-hidden="true" />Export PDF</button>
          </>
        }
      />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Report catalogue" className="no-print min-w-0">
          <div className="lg:hidden">
            <Field label="Report" htmlFor="report-select">
              <select id="report-select" className="inp" value={key} onChange={(e) => selectReport(e.target.value as ReportKey)}>
                {GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {REPORT_CATALOG.filter((r) => r.group === g).map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
          <div className="card hidden flex-col gap-4 p-3 lg:flex">
            {GROUPS.map((g) => (
              <div key={g}>
                <p className="eb mb-1.5 px-2">{g}</p>
                <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                  {REPORT_CATALOG.filter((r) => r.group === g).map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        aria-pressed={r.key === key}
                        onClick={() => selectReport(r.key)}
                        className={`flex min-h-[44px] w-full flex-col items-start justify-center rounded-lg px-2.5 py-1.5 text-left font-[inherit] ${r.key === key ? "bg-[#e6e6fd] text-[#1010a8]" : "bg-transparent text-[#0b0b0f] hover:bg-[#f4f5f8]"}`}
                      >
                        <span className="text-[13.5px] font-semibold">{r.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-5">
          <details className="card no-print md:hidden">
            <summary className="flex min-h-[48px] cursor-pointer items-center gap-2 px-4 text-[14px] font-semibold">
              <SlidersHorizontal size={16} aria-hidden="true" />Filters{filtersOn ? ` (${filterLines.length} active)` : ""}
            </summary>
            <div className="flex flex-col gap-3 border-t border-[#edeff3] p-4">
              {filterForm("rf-m")}
              {resetBtn}
            </div>
          </details>
          <Section className="no-print hidden md:flex" title="Filters" actions={resetBtn}>
            {filterForm("rf-d")}
          </Section>

          {report.error ? (
            <ErrorState message={report.error} onRetry={() => report.reload()} />
          ) : dateInvalid ? (
            <ErrorState title="Check the date range" message="The start date must be on or before the end date." />
          ) : (
            <div id={PRINT_ID} className="flex min-w-0 flex-col gap-5 print:bg-white" aria-busy={report.loading}>
              <div className="hidden items-center gap-4 border-b-2 border-[#0b0b0f] pb-3 print:flex">
                <Image src="/brand/rta-logo.png" alt="Road Traffic Authority" width={56} height={56} />
                <div className="flex-1">
                  <p className="m-0 text-[11px] font-bold tracking-[.08em] uppercase">Road Traffic Authority · Papua New Guinea</p>
                  <p className="m-0 text-[20px] font-extrabold">{meta.title}</p>
                  <p className="m-0 text-[11px]">{filterLines.length ? filterLines.join(" · ") : "No filters applied"}</p>
                </div>
                <p className="m-0 text-right text-[11px]">Generated<br />{formatDateTime(generatedAt)}</p>
              </div>

              <div>
                <h2 className="h2">{meta.title}</h2>
                <p className="mut m-0 mt-1 text-[13.5px]">{result?.description ?? meta.description}</p>
                <p className="mut m-0 mt-1 text-[12px] print:hidden">{filtersOn ? filterLines.join(" · ") : "All records"} · generated {formatDateTime(generatedAt)}</p>
              </div>

              {!result ? (
                <>
                  <div className="g4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
                  <TableSkeleton />
                </>
              ) : (
                <>
                  {result.summary.length > 0 && (
                    <div className="g4">
                      {result.summary.map((s) => (
                        <div key={s.label} className="card tile">
                          <p className="eb">{s.label}</p>
                          <p className="kpi text-[24px]">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.chart && result.chart.data.length > 0 && (
                    <Section title={result.chart.valueFormat === "money" ? "Amount breakdown" : "Count breakdown"}>
                      {result.chart.type === "pie"
                        ? <Donut data={result.chart.data} money={result.chart.valueFormat === "money"} />
                        : <GenericBar data={result.chart.data} money={result.chart.valueFormat === "money"} />}
                    </Section>
                  )}

                  <div className="print:hidden">
                    <DataTable
                      key={key}
                      storageKey={`report-${key}`}
                      data={result.rows}
                      loading={report.loading}
                      columns={columns}
                      mobileCard={(r) => {
                        const [first, ...rest] = result.columns;
                        const amountCol = result.columns.find((c) => MONEY_KEYS.has(c.key) && c.key === "amount");
                        return (
                          <MobileCard
                            title={first ? cellText(first, r[first.key]) : ""}
                            lines={rest.filter((c) => c !== amountCol).slice(0, 4).map((c) => <span key={c.key}><span className="mut">{c.label}: </span><span className={c.mono ? "mono" : ""}>{cellText(c, r[c.key])}</span></span>)}
                            footer={amountCol ? <><span className="mut text-[12px]">{amountCol.label}</span><span className="font-extrabold">{cellText(amountCol, r[amountCol.key])}</span></> : undefined}
                          />
                        );
                      }}
                      empty={{ title: "No results", message: filtersOn ? "No records match the selected filters. Adjust or reset the filters." : "There is no data for this report yet." }}
                    />
                  </div>

                  <table className="tbl hidden text-[10.5px] print:table">
                    <thead>
                      <tr>{result.columns.map((c) => <th key={c.key} className={c.align === "right" ? "num" : ""}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {result.rows.map((r, i) => (
                        <tr key={i}>{result.columns.map((c) => <td key={c.key} className={`${c.align === "right" ? "num" : ""} ${c.mono ? "mono" : ""}`}>{cellText(c, r[c.key])}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="hidden text-[10px] print:block">{result.rows.length} rows · Printed from the RTA Motorcycle Registration &amp; Payment System (UAT prototype).</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsInner />
    </Suspense>
  );
}
