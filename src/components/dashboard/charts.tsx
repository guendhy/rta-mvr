"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/formatting";

export const CHART_COLORS = ["#1515e8", "#e0b400", "#137a3b", "#c4141b", "#8c8cf5", "#c25a00", "#474d59", "#0b0b0f", "#59b27a", "#e58a8f"];

/** Registry status colours — always shown next to a text badge, never on their own. */
export const STATE_COLORS: Record<string, string> = {
  active: "#137a3b",
  expiring_soon: "#e0b400",
  expired: "#c4141b",
  suspended: "#5c0a0f",
  cancelled: "#474d59",
  unregistered: "#1515e8",
  deregistered: "#aeb3bd",
};

export interface ChartDatum {
  name: string;
  value: number;
}

const TOOLTIP_STYLE = { borderRadius: 8, borderColor: "#e1e4ea", fontSize: 13 };
const fmt = (v: number, money?: boolean) => (money ? formatMoney(v) : v.toLocaleString("en-PG"));
const summary = (data: ChartDatum[], money?: boolean) => data.map((d) => `${d.name} ${fmt(d.value, money)}`).join(", ");

/** Visually hidden data table — the text alternative for every chart. */
export function ChartDataTable({ caption, data, money, valueLabel = money ? "Amount" : "Count" }: { caption: string; data: ChartDatum[]; money?: boolean; valueLabel?: string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr><th scope="col">Category</th><th scope="col">{valueLabel}</th></tr>
      </thead>
      <tbody>
        {data.map((d) => <tr key={d.name}><th scope="row">{d.name}</th><td>{fmt(d.value, money)}</td></tr>)}
      </tbody>
    </table>
  );
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function TrendBars({ data, height = 240, highlightLast = true, caption = "Applications started" }: { data: { label: string; value: number }[]; height?: number; highlightLast?: boolean; caption?: string }) {
  return (
    <div style={{ width: "100%", height }}>
      <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart, ${caption}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke="#edeff3" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e1e4ea" }} tick={{ fontSize: 12, fill: "#5a606c" }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5a606c" }} />
            <Tooltip cursor={{ fill: "#f4f5f8" }} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" name="Transactions" radius={[6, 6, 0, 0]} maxBarSize={56} label={{ position: "top", fontSize: 12, fontWeight: 600, fill: "#0b0b0f" }}>
              {data.map((_, i) => <Cell key={i} fill={highlightLast && i === data.length - 1 ? "#1515e8" : "#c9c9fa"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable caption={caption} data={data.map((d) => ({ name: d.label, value: d.value }))} />
    </div>
  );
}

export function GenericBar({ data, money, height = 260, caption = "Breakdown" }: { data: ChartDatum[]; money?: boolean; height?: number; caption?: string }) {
  return (
    <div>
      <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart, ${caption}: ${summary(data, money)}`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: money ? 10 : -18 }}>
            <CartesianGrid vertical={false} stroke="#edeff3" />
            <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "#e1e4ea" }} tick={{ fontSize: 11.5, fill: "#5a606c" }} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 60 : 30} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5a606c" }} tickFormatter={(v) => (money ? `K${v}` : String(v))} />
            <Tooltip cursor={{ fill: "#f4f5f8" }} formatter={(v) => fmt(Number(v), money)} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable caption={caption} data={data} money={money} />
    </div>
  );
}

/** Horizontal bars with the category name on the left — long labels stay readable on phones. */
export function HorizontalBars({ data, money, caption, color = "#1515e8" }: { data: ChartDatum[]; money?: boolean; caption: string; color?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const labelWidth = Math.max(96, Math.min(190, Math.round(width * 0.38)));
  const height = Math.max(120, data.length * 34 + 12);
  return (
    <div ref={ref} className="min-w-0">
      <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart, ${caption}: ${summary(data, money)}`}>
        {width > 0 && (
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={8}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={labelWidth} tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 12.5, fill: "#1f2229" }} />
              <Tooltip cursor={{ fill: "#f4f5f8" }} formatter={(v) => fmt(Number(v), money)} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="value" name={money ? "Amount" : "Vehicles"} fill={color} radius={[0, 4, 4, 0]} background={{ fill: "#edeff3", radius: 4 }} maxBarSize={18}>
                <LabelList dataKey="value" position="right" formatter={(v: unknown) => fmt(Number(v), money)} style={{ fontSize: 12.5, fontWeight: 700, fill: "#0b0b0f" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <ChartDataTable caption={caption} data={data} money={money} />
    </div>
  );
}

/** Vertical bars in one colour with value labels (e.g. transactions by type). */
export function ColumnBars({ data, caption, height = 190, color = "#1515e8" }: { data: ChartDatum[]; caption: string; height?: number; color?: string }) {
  return (
    <div>
      <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart, ${caption}: ${summary(data)}`}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 20, right: 4, bottom: 0, left: 4 }}>
            <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "#e1e4ea" }} interval={0} tick={{ fontSize: 11.5, fill: "#5a606c" }} />
            <YAxis hide allowDecimals={false} />
            <Tooltip cursor={{ fill: "#f4f5f8" }} contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" name="Transactions" fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} label={{ position: "top", fontSize: 12, fontWeight: 700, fill: "#0b0b0f" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable caption={caption} data={data} />
    </div>
  );
}

/** Single stacked bar showing shares of a whole; pair it with a labelled legend. */
export function ProportionBar({ data, caption, money }: { data: (ChartDatum & { color: string })[]; caption: string; money?: boolean }) {
  const rows = data.filter((d) => d.value > 0);
  const total = rows.reduce((s, d) => s + d.value, 0);
  const point = Object.fromEntries(rows.map((d) => [d.name, d.value]));
  return (
    <div>
      <div style={{ width: "100%", height: 22 }} role="img" aria-label={`Stacked bar, ${caption}: ${rows.map((d) => `${d.name} ${fmt(d.value, money)} (${total ? Math.round((d.value / total) * 100) : 0}%)`).join(", ")}`}>
        {total > 0 ? (
          <ResponsiveContainer>
            <BarChart data={[point]} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={0}>
              <XAxis type="number" hide domain={[0, total]} />
              <YAxis type="category" hide />
              <Tooltip cursor={false} formatter={(v) => fmt(Number(v), money)} contentStyle={TOOLTIP_STYLE} />
              {rows.map((d, i) => (
                <Bar key={d.name} dataKey={d.name} stackId="all" fill={d.color} stroke="#fff" strokeWidth={1} radius={i === 0 && i === rows.length - 1 ? 5 : i === 0 ? [5, 0, 0, 5] : i === rows.length - 1 ? [0, 5, 5, 0] : 0} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full rounded-[5px] bg-[#edeff3]" />
        )}
      </div>
      <ChartDataTable caption={caption} data={data} money={money} />
    </div>
  );
}

export function Donut({ data, money, height = 220, caption = "Breakdown" }: { data: ChartDatum[]; money?: boolean; height?: number; caption?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div style={{ width: 200, height }} role="img" aria-label={`Pie chart, ${caption}: ${summary(data, money)}`}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={1.5} stroke="#fff">
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmt(Number(v), money)} contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <dl className="m-0 flex min-w-[180px] flex-1 flex-col gap-2 text-[13.5px]">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2.5">
            <span className="h-3 w-3 flex-none rounded-[3px]" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
            <dt className="flex-1">{d.name}</dt>
            <dd className="num m-0 font-bold">{fmt(d.value, money)}{total > 0 && <span className="mut ml-1.5 text-[12px] font-medium">{Math.round((d.value / total) * 100)}%</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
