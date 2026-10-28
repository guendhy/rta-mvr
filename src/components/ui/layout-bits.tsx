import Link from "next/link";
import { Fragment } from "react";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumb no-print">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span aria-hidden="true">/</span>}
          {it.href ? <Link href={it.href}>{it.label}</Link> : <span className="font-semibold text-[#0b0b0f]" aria-current="page">{it.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}

export function PageHeader({ title, eyebrow, description, actions, badge }: { title: string; eyebrow?: string; description?: React.ReactNode; actions?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="ph">
      <div className="min-w-0">
        {eyebrow && <p className="eb mb-1.5">{eyebrow}</p>}
        <div className="row gap-2.5">
          <h1 className="h1">{title}</h1>
          {badge}
        </div>
        {description && <div className="mut mt-1.5 text-[14px]">{description}</div>}
      </div>
      {actions && <div className="row no-print">{actions}</div>}
    </div>
  );
}

export function KpiCard({ label, value, href, footer, dark, tone }: { label: string; value: React.ReactNode; href?: string; footer?: React.ReactNode; dark?: boolean; tone?: "danger" }) {
  const body = (
    <>
      <p className="eb" style={dark ? { color: "#c4c7d0" } : undefined}>{label}</p>
      <p className="kpi" style={dark ? { color: "#ffd21a" } : tone === "danger" ? { color: "#a3111a" } : undefined}>{value}</p>
      {footer && <div className="text-[12.5px]" style={{ color: dark ? "#c4c7d0" : "#5a606c" }}>{footer}</div>}
    </>
  );
  const cls = `card tile no-underline ${dark ? "!border-[#0b0b0f] !bg-[#0b0b0f] text-white" : "text-inherit"} transition-shadow hover:shadow-md`;
  return href ? <Link href={href} className={cls} style={{ color: dark ? "#fff" : "inherit" }}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function Section({ title, description, actions, children, className = "", id }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`card sec ${className}`}>
      {(title || actions) && (
        <div className="sechd">
          <div className="min-w-0">
            {title && <h2 className="h3">{title}</h2>}
            {description && <p className="mut m-0 mt-0.5 text-[13px]">{description}</p>}
          </div>
          {actions && <div className="row gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label = "Sections" }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="tabs no-print" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? "tab-on" : ""}`} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${value === t.value ? "bg-[#1515e8] text-white" : "bg-[#edeff3] text-[#474d59]"}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DescriptionList({ items, className = "" }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={`dl ${className}`}>
      {items.map(([k, v]) => (
        <Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v ?? "—"}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function Flag({ height = 4 }: { height?: number }) {
  return (
    <div className="flag" style={{ height }} aria-hidden="true">
      <span /><span /><span /><span />
    </div>
  );
}
