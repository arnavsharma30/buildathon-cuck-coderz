"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, LabelList, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const inr = (n: number) => (n < 0 ? "-₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");

export function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-zinc-200 px-6 text-center text-xs text-zinc-500">
      {children}
    </div>
  );
}

// 1. Orders per day, COD vs Prepaid (stacked gradient area, shadcn "area" style)
const ordersConfig = {
  cod: { label: "COD", color: "#f59e0b" },
  prepaid: { label: "Prepaid", color: "#10b981" },
} satisfies ChartConfig;

export function OrdersAreaChart({ data }: { data: { day: string; cod: number; prepaid: number }[] }) {
  return (
    <ChartContainer config={ordersConfig} className="aspect-auto h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 12 }}>
        <defs>
          <linearGradient id="fillCod" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-cod)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-cod)" stopOpacity={0.08} />
          </linearGradient>
          <linearGradient id="fillPrepaid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-prepaid)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-prepaid)" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Area dataKey="prepaid" type="monotone" fill="url(#fillPrepaid)" stroke="var(--color-prepaid)" stackId="a" />
        <Area dataKey="cod" type="monotone" fill="url(#fillCod)" stroke="var(--color-cod)" stackId="a" />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  );
}

// 2. Naive margin vs real profit per order placed
const productConfig = {
  naive: { label: "Looks like (naive margin)", color: "#a1a1aa" },
  real: { label: "Actually makes / order", color: "#10b981" },
} satisfies ChartConfig;

export function ProductEconomicsChart({ data }: { data: { name: string; naive: number; real: number }[] }) {
  return (
    <ChartContainer config={productConfig} className="aspect-auto h-[260px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={60} tickFormatter={(v: number) => inr(v)} />
        <ReferenceLine y={0} stroke="#71717a" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v, n) => `${productConfig[n as "naive" | "real"]?.label ?? n}: ${inr(Number(v))}`} />} />
        <Bar dataKey="naive" fill="var(--color-naive)" radius={4} />
        <Bar dataKey="real" fill="var(--color-real)" radius={4}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.real < 0 ? "#ef4444" : "var(--color-real)"} />
          ))}
          <LabelList dataKey="real" position="top" className="fill-zinc-700" fontSize={11} formatter={(v) => inr(Number(v))} />
        </Bar>
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  );
}

// 3. RTO risk mix of pending orders (donut)
const riskConfig = {
  count: { label: "Orders" },
  low: { label: "Low", color: "#10b981" },
  medium: { label: "Medium", color: "#f59e0b" },
  high: { label: "High", color: "#ef4444" },
  critical: { label: "Critical", color: "#7c3aed" },
} satisfies ChartConfig;

export function RiskDonut({ data, predictedRto }: { data: { band: "low" | "medium" | "high" | "critical"; count: number }[]; predictedRto: number }) {
  const total = data.reduce((a, d) => a + d.count, 0);
  const rows = data.filter((d) => d.count > 0).map((d) => ({ ...d, fill: `var(--color-${d.band})` }));
  return (
    <ChartContainer config={riskConfig} className="mx-auto aspect-square h-[240px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="band" />} />
        <Pie data={rows} dataKey="count" nameKey="band" innerRadius={62} strokeWidth={4}>
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-zinc-900 text-2xl font-semibold">
                      {total}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-zinc-500 text-xs">
                      {`~${Math.round(predictedRto * 100)}% RTO`}
                    </tspan>
                  </text>
                );
              }
              return null;
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="band" />} />
      </PieChart>
    </ChartContainer>
  );
}

// 4. Ad sets: CPA vs break-even, coloured by decision
const VERDICT_COLOR: Record<string, string> = { SCALE: "#10b981", KEEP: "#0ea5e9", WAIT: "#a1a1aa", KILL: "#ef4444" };
const adsetConfig = { cpa: { label: "CPA", color: "#0ea5e9" } } satisfies ChartConfig;

export function AdsetChart({ data, breakEven }: { data: { name: string; cpa: number; spend: number; orders: number; verdict: string }[]; breakEven: number }) {
  // Ad sets with no orders have no CPA: plot what they spent so the loser is visible.
  const rows = data.map((d) => ({ ...d, value: d.orders ? d.cpa : d.spend, tag: d.orders ? d.verdict : `${d.verdict} · 0 orders` }));
  const max = Math.max(breakEven * 1.15, ...rows.map((r) => r.value)) || 1;
  return (
    <ChartContainer config={adsetConfig} className="aspect-auto h-[240px] w-full">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 84, top: 20 }}>
        <CartesianGrid horizontal={false} />
        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
        <XAxis type="number" domain={[0, Math.ceil(max)]} tickLine={false} axisLine={false} tickFormatter={(v: number) => inr(v)} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(_v, _n, item) =>
                item.payload.orders
                  ? `CPA ${inr(item.payload.cpa)} · ${item.payload.orders} orders · spent ${inr(item.payload.spend)} · ${item.payload.verdict}`
                  : `Spent ${inr(item.payload.spend)} with 0 orders · ${item.payload.verdict}`
              }
            />
          }
        />
        {breakEven > 0 && (
          <ReferenceLine x={breakEven} stroke="#18181b" strokeDasharray="4 4" label={{ value: `break-even ${inr(breakEven)}`, position: "top", fontSize: 10, fill: "#52525b" }} />
        )}
        <Bar dataKey="value" radius={4} barSize={28}>
          {rows.map((d) => (
            <Cell key={d.name} fill={VERDICT_COLOR[d.verdict] ?? "#0ea5e9"} />
          ))}
          <LabelList dataKey="tag" position="right" fontSize={10} className="fill-zinc-700" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// 5. Shipments by status
const shipConfig = { count: { label: "Shipments", color: "#0ea5e9" } } satisfies ChartConfig;
const SHIP_COLOR: Record<string, string> = {
  Booked: "#a1a1aa",
  "Picked up": "#93c5fd",
  "In transit": "#38bdf8",
  "Out for delivery": "#f59e0b",
  Delivered: "#10b981",
  "Failed attempt": "#ef4444",
  RTO: "#7c3aed",
};

export function ShipmentsChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ChartContainer config={shipConfig} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 16 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 10 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="count" radius={4}>
          {data.map((d) => (
            <Cell key={d.status} fill={SHIP_COLOR[d.status] ?? "#0ea5e9"} />
          ))}
          <LabelList dataKey="count" position="top" fontSize={11} className="fill-zinc-700" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// 6. Actions per teammate
const teamConfig = { actions: { label: "Actions", color: "#10b981" } } satisfies ChartConfig;

export function TeamChart({ data }: { data: { name: string; actions: number }[] }) {
  return (
    <ChartContainer config={teamConfig} className="aspect-auto h-[180px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32 }}>
        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={90} tick={{ fontSize: 11 }} />
        <XAxis type="number" hide allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
        <Bar dataKey="actions" fill="var(--color-actions)" radius={4} barSize={22}>
          <LabelList dataKey="actions" position="right" fontSize={11} className="fill-zinc-700" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
