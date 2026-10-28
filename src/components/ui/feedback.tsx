import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Info, RefreshCw, XCircle } from "lucide-react";

export function Spinner({ className = "", label }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span className={`spin ${className}`} aria-hidden="true" />
      {label ? <span>{label}</span> : <span className="sr">Loading</span>}
    </span>
  );
}

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`sk ${className}`} style={style} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="card flex flex-col gap-2.5 p-4" aria-busy="true" aria-label="Loading records">
      <Skeleton className="h-3.5 w-2/5" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9" />)}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-72" />
      <div className="g4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-64 rounded-xl" />
      <TableSkeleton />
    </div>
  );
}

export function EmptyState({ title, message, action, icon }: { title: string; message: string; action?: { label: string; href?: string; onClick?: () => void }; icon?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-8 text-center">
      <span className="text-[#5a606c]" aria-hidden="true">{icon ?? <FileText size={36} strokeWidth={1.6} />}</span>
      <p className="h3">{title}</p>
      <p className="mut m-0 max-w-md text-[13px]">{message}</p>
      {action && (action.href ? (
        <Link href={action.href} className="btn btn-p mt-1.5">{action.label}</Link>
      ) : (
        <button type="button" onClick={action.onClick} className="btn btn-p mt-1.5">{action.label}</button>
      ))}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-bad" role="alert">
      <XCircle size={20} className="mt-px flex-none" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="alert-title">{title}</p>
        <p>{message}</p>
        {onRetry && (
          <div><button type="button" className="btn btn-s btn-sm" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" />Try again</button></div>
        )}
      </div>
    </div>
  );
}

const ICONS = { info: Info, ok: CheckCircle2, warn: AlertTriangle, bad: XCircle };

export function Alert({ tone = "info", title, children, className = "", action }: { tone?: "info" | "ok" | "warn" | "bad"; title: string; children?: React.ReactNode; className?: string; action?: React.ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={`alert alert-${tone} ${className}`} role={tone === "bad" ? "alert" : "status"}>
      <Icon size={20} className="mt-px flex-none" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="alert-title">{title}</p>
        {children && <div className="mt-0.5">{children}</div>}
      </div>
      {action && <div className="flex-none self-center">{action}</div>}
    </div>
  );
}
