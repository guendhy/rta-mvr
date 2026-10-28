"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES } from "@/lib/constants";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { EmptyState, TableSkeleton } from "./feedback";

export type { ColumnDef } from "@tanstack/react-table";

export function Pagination({ page, pageCount, total, pageSize, onPage, onPageSize }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void }) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const pages = Array.from({ length: pageCount }, (_, i) => i).filter((i) => i === 0 || i === pageCount - 1 || Math.abs(i - page) <= 1);
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-[#edeff3] px-4 py-3">
      <div className="row gap-3 text-[13px]">
        <span className="mut">Showing {from}–{to} of {total}</span>
        <label className="row gap-2">
          <span className="mut">Rows</span>
          <select className="inp !h-9 !w-auto !py-0 text-[13px]" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      {pageCount > 1 && (
        <nav aria-label="Pagination" className="flex gap-1.5">
          <button type="button" className="btn btn-s btn-icon" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
          {pages.map((p, i) => (
            <span key={p} className="contents">
              {i > 0 && p - pages[i - 1] > 1 && <span className="mut self-center px-1">…</span>}
              <button type="button" className={`btn btn-icon ${p === page ? "btn-p" : "btn-s"}`} aria-current={p === page ? "page" : undefined} onClick={() => onPage(p)}>{p + 1}</button>
            </span>
          ))}
          <button type="button" className="btn btn-s btn-icon" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
        </nav>
      )}
    </div>
  );
}

/**
 * Desktop: sortable table. Mobile (< md): rows become cards via `mobileCard`.
 * Paginates at 25 rows by default (25 / 50 / 100).
 */
export function DataTable<T>({
  data,
  columns,
  loading,
  mobileCard,
  empty,
  onRowClick,
  storageKey = "table",
  initialSort,
}: {
  data: T[] | undefined;
  columns: ColumnDef<T, unknown>[];
  loading?: boolean;
  mobileCard?: (row: T) => React.ReactNode;
  empty?: { title: string; message: string; action?: { label: string; href?: string; onClick?: () => void } };
  onRowClick?: (row: T) => void;
  storageKey?: string;
  initialSort?: SortingState;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort ?? []);
  const [pageSize, setPageSize] = useLocalStorage<number>(`page-size:${storageKey}`, 25);
  const [pageIndex, setPageIndex] = useState(0);
  const rows = useMemo(() => data ?? [], [data]);

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, pagination: { pageIndex, pageSize } },
    onSortingChange: setSorting,
    onPaginationChange: (u) => {
      const next = typeof u === "function" ? u({ pageIndex, pageSize }) : u;
      setPageIndex(next.pageIndex);
      if (next.pageSize !== pageSize) setPageSize(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
  });

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  if (pageIndex > pageCount - 1 && pageIndex !== 0) setPageIndex(0);

  if (loading && !data) return <TableSkeleton />;
  if (!rows.length) return <EmptyState title={empty?.title ?? "No records"} message={empty?.message ?? "No records match the current filters."} action={empty?.action} />;

  const pageRows = table.getRowModel().rows;
  return (
    <div className="card overflow-hidden">
      <div className={`overflow-x-auto ${mobileCard ? "hidden md:block" : ""}`}>
        <table className="tbl">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort();
                  const dir = h.column.getIsSorted();
                  const align = (h.column.columnDef.meta as { align?: string } | undefined)?.align;
                  return (
                    <th key={h.id} className={align === "right" ? "num" : ""} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
                      {sortable ? (
                        <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : dir === "desc" ? <ArrowDown size={12} aria-hidden="true" /> : null}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className={onRowClick ? "cursor-pointer" : ""} onClick={onRowClick ? (e) => { if (!(e.target as HTMLElement).closest("a,button")) onRowClick(r.original); } : undefined}>
                {r.getVisibleCells().map((c) => {
                  const align = (c.column.columnDef.meta as { align?: string } | undefined)?.align;
                  return <td key={c.id} className={align === "right" ? "num" : ""}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {mobileCard && (
        <ul className="flex flex-col gap-2.5 bg-[#f4f5f8] p-2.5 md:hidden">
          {pageRows.map((r) => <li key={r.id}>{mobileCard(r.original)}</li>)}
        </ul>
      )}
      <Pagination page={pageIndex} pageCount={pageCount} total={rows.length} pageSize={pageSize} onPage={setPageIndex} onPageSize={(s) => { setPageSize(s); setPageIndex(0); }} />
    </div>
  );
}

export function MobileCard({ title, badge, lines, footer, href }: { title: React.ReactNode; badge?: React.ReactNode; lines: React.ReactNode[]; footer?: React.ReactNode; href?: string }) {
  const body = (
    <div className="card flex flex-col gap-2 p-3.5 text-inherit">
      <div className="flex items-center justify-between gap-2">
        <span className="mono min-w-0 truncate text-[12.5px] font-semibold">{title}</span>
        {badge}
      </div>
      {lines.map((l, i) => <div key={i} className={i === 0 ? "text-[15px] font-bold" : "mut text-[13px]"}>{l}</div>)}
      {footer && <div className="flex items-center justify-between gap-2 border-t border-[#edeff3] pt-2.5">{footer}</div>}
    </div>
  );
  return href ? <Link href={href} className="block no-underline" style={{ color: "inherit" }}>{body}</Link> : body;
}
