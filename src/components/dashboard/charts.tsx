"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/formatting";

export const CHART_COLORS = ["#1515e8", "#e0b400", "#137a3b", "#c4141b", "#8c8cf5", "#c25a00", "#474d59", "#0b0b0f", "#59b27a", "#e58a8f"];

export function TrendBars({ data, height = 240, highlightLast = true }: { data: { label: string; value: number }[]; height?: number; highlightLast?: boolean }) {
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="#edeff3" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e1e4ea" }} tick={{ fontSize: 12, fill: "#5a606c" }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5a606c" }} />
          <Tooltip cursor={{ fill: "#f4f5f8" }} contentStyle={{ borderRadius: 8, borderColor: "#e1e4ea", fontSize: 13 }} />
          <Bar dataKey="value" name="Registrations" radius={[6, 6, 0, 0]} maxBarSize={56} label={{ position: "top", fontSize: 12, fontWeight: 600, fill: "#0b0b0f" }}>
            {data.map((_, i) => <Cell key={i} fill={highlightLast && i === data.length - 1 ? "#1515e8" : "#c9c9fa"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GenericBar({ data, money, height = 260 }: { data: { name: string; value: number }[]; money?: boolean; height?: number }) {
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart: ${data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: money ? 10 : -18 }}>
          <CartesianGrid vertical={false} stroke="#edeff3" />
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "#e1e4ea" }} tick={{ fontSize: 11.5, fill: "#5a606c" }} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 60 : 30} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#5a606c" }} tickFormatter={(v) => (money ? `K${v}` : String(v))} />
          <Tooltip cursor={{ fill: "#f4f5f8" }} formatter={(v) => (money ? formatMoney(Number(v)) : String(v))} contentStyle={{ borderRadius: 8, borderColor: "#e1e4ea", fontSize: 13 }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, money, height = 220 }: { data: { name: string; value: number }[]; money?: boolean; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div style={{ width: 200, height }} role="img" aria-label={`Pie chart: ${data.map((d) => `${d.name} ${money ? formatMoney(d.value) : d.value}`).join(", ")}`}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} paddingAngle={1.5} stroke="#fff">
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => (money ? formatMoney(Number(v)) : String(v))} contentStyle={{ borderRadius: 8, borderColor: "#e1e4ea", fontSize: 13 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <dl className="m-0 flex min-w-[180px] flex-1 flex-col gap-2 text-[13.5px]">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2.5">
            <span className="h-3 w-3 flex-none rounded-[3px]" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} aria-hidden="true" />
            <dt className="flex-1">{d.name}</dt>
            <dd className="num m-0 font-bold">{money ? formatMoney(d.value) : d.value}{total > 0 && <span className="mut ml-1.5 text-[12px] font-medium">{Math.round((d.value / total) * 100)}%</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
