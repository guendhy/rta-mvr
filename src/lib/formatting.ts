import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

function toDate(value: string | Date | undefined | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? parseISO(value) : value;
  return isValid(d) ? d : null;
}

export function formatMoney(amount: number | undefined | null, opts: { symbol?: boolean } = {}): string {
  const n = Number(amount ?? 0);
  const body = n.toLocaleString("en-PG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return opts.symbol === false ? body : `K ${body}`;
}

export function formatDate(value: string | Date | undefined | null, pattern = "dd MMM yyyy"): string {
  const d = toDate(value);
  return d ? format(d, pattern) : "—";
}

export function formatDateLong(value: string | Date | undefined | null): string {
  return formatDate(value, "d MMMM yyyy");
}

export function formatDateTime(value: string | Date | undefined | null): string {
  return formatDate(value, "dd/MM/yyyy HH:mm");
}

export function formatTime(value: string | Date | undefined | null): string {
  return formatDate(value, "HH:mm:ss");
}

export function formatRelative(value: string | Date | undefined | null): string {
  const d = toDate(value);
  return d ? formatDistanceToNow(d, { addSuffix: true }) : "—";
}

export function fullName(p: { firstName?: string; middleName?: string; lastName?: string } | undefined | null): string {
  if (!p) return "—";
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ") || "—";
}

export function shortName(p: { firstName?: string; lastName?: string } | undefined | null): string {
  if (!p?.firstName) return "—";
  return `${p.firstName.charAt(0)}. ${p.lastName ?? ""}`.trim();
}

export function initials(p: { firstName?: string; lastName?: string } | undefined | null): string {
  if (!p) return "?";
  return `${p.firstName?.charAt(0) ?? ""}${p.lastName?.charAt(0) ?? ""}`.toUpperCase() || "?";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function motorcycleLabel(m: { make?: string; model?: string; year?: number } | undefined | null): string {
  if (!m?.make) return "—";
  return [m.make, m.model, m.year].filter(Boolean).join(" ");
}

export function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.label)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
