"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const inr = (n: number) => (n < 0 ? "-₹" : "₹") + Math.abs(n).toLocaleString("en-IN");

/* ---------- COD returns: shipped blindly vs with DropOS RTO checks ---------- */

const DAYS = ["Nov 5", "Nov 6", "Nov 7", "Nov 8", "Nov 9", "Nov 10", "Nov 11", "Nov 12", "Nov 13", "Nov 14", "Nov 15", "Nov 16", "Nov 17", "Nov 18"];
const BLIND = [26, 29, 25, 28, 31, 27, 24, 28, 30, 26, 27, 29, 25, 27];
const DROPOS = [6, 5, 4, 6, 5, 5, 4, 6, 5, 4, 5, 6, 4, 5];
const RTO_DATA = DAYS.map((day, i) => ({ day, blind: BLIND[i], dropos: DROPOS[i] }));

const rtoConfig = {
  blind: { label: "Shipped blindly", color: "#f87171" },
  dropos: { label: "With DropOS checks", color: "#10b981" },
} satisfies ChartConfig;

export function RtoAreaChart() {
  const [range, setRange] = useState<7 | 14>(14);
  const data = RTO_DATA.slice(-range);
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">COD orders returned (RTO %)</div>
          <div className="text-xs text-zinc-500">Same orders, shipped blindly vs. checked first</div>
        </div>
        <div className="flex rounded-lg border border-zinc-200 p-0.5 text-xs">
          {([7, 14] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={r === range ? "rounded-md bg-zinc-900 px-2.5 py-1 font-medium text-white" : "rounded-md px-2.5 py-1 text-zinc-600 hover:text-zinc-900"}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>
      <ChartContainer config={rtoConfig} className="mt-4 aspect-auto h-[220px] w-full">
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <defs>
            <linearGradient id="fillBlind" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-blind)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="var(--color-blind)" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="fillDropos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-dropos)" stopOpacity={0.55} />
              <stop offset="95%" stopColor="var(--color-dropos)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}%`} domain={[0, 35]} ticks={[0, 10, 20, 30]} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" formatter={(v, name) => `${rtoConfig[name as keyof typeof rtoConfig]?.label}: ${v}%`} />} />
          <Area dataKey="blind" type="natural" fill="url(#fillBlind)" stroke="var(--color-blind)" strokeWidth={2} />
          <Area dataKey="dropos" type="natural" fill="url(#fillDropos)" stroke="var(--color-dropos)" strokeWidth={2} />
        </AreaChart>
      </ChartContainer>
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-red-400" /> Blind ~27%
          </span>
          <span className="flex items-center gap-1.5 text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> DropOS ~5%
          </span>
        </div>
        <span className="text-zinc-400">Illustrative · our engine on a sample batch</span>
      </div>
    </div>
  );
}

/* ---------- Looks like vs actually makes, per order ---------- */

const MARGIN_DATA = [
  { product: "Blender", naive: 879, real: 342 },
  { product: "Posture belt", naive: 540, real: 90 },
  { product: "Water bottle", naive: 259, real: -125 },
];

const marginConfig = {
  naive: { label: "Looks like (price − cost − shipping)", color: "#d4d4d8" },
  real: { label: "Actually makes (after COD returns + ads)", color: "#10b981" },
} satisfies ChartConfig;

export function MarginBarChart() {
  return (
    <div>
      <div className="text-sm font-semibold text-zinc-900">Profit per order: looks like vs. actually</div>
      <div className="text-xs text-zinc-500">After COD returns, reverse shipping and ₹220 ad cost</div>
      <ChartContainer config={marginConfig} className="mt-4 aspect-auto h-[220px] w-full">
        <BarChart data={MARGIN_DATA} margin={{ left: 4, right: 8, top: 8 }} barGap={4}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="product" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => inr(Number(v))} />
          <ReferenceLine y={0} stroke="#a1a1aa" />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" formatter={(v, name) => `${name === "naive" ? "Looks like" : "Actually"}: ${inr(Number(v))}`} />} />
          <Bar dataKey="naive" fill="var(--color-naive)" radius={[6, 6, 0, 0]} />
          <Bar dataKey="real" radius={6}>
            {MARGIN_DATA.map((d) => (
              <Cell key={d.product} fill={d.real < 0 ? "#ef4444" : "var(--color-real)"} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="mt-3 flex items-center justify-between text-xs">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-zinc-300" /> Looks like
          </span>
          <span className="flex items-center gap-1.5 text-zinc-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Actually
          </span>
        </div>
        <span className="text-zinc-400">Illustrative · DropOS model, default assumptions</span>
      </div>
    </div>
  );
}

/* ---------- Shipments by stage (dark card) ---------- */

const SHIP_DATA = [
  { stage: "delivered", count: 18, fill: "var(--color-delivered)" },
  { stage: "transit", count: 7, fill: "var(--color-transit)" },
  { stage: "ofd", count: 4, fill: "var(--color-ofd)" },
  { stage: "failed", count: 1, fill: "var(--color-failed)" },
];

const shipConfig = {
  count: { label: "Parcels" },
  delivered: { label: "Delivered", color: "#10b981" },
  transit: { label: "In transit", color: "#38bdf8" },
  ofd: { label: "Out for delivery", color: "#fbbf24" },
  failed: { label: "Failed attempt", color: "#f87171" },
} satisfies ChartConfig;

export function ShipmentsDonut() {
  const total = SHIP_DATA.reduce((a, d) => a + d.count, 0);
  return (
    <div className="flex items-center gap-4">
      <ChartContainer config={shipConfig} className="aspect-square h-[132px] shrink-0">
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="stage" />} />
          <Pie data={SHIP_DATA} dataKey="count" nameKey="stage" innerRadius={42} outerRadius={60} strokeWidth={3} stroke="#18181b">
            <Label
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox && "cy" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-white text-xl font-semibold">
                      {total}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 18} className="fill-zinc-400 text-[10px]">
                      parcels
                    </tspan>
                  </text>
                ) : null
              }
            />
          </Pie>
        </PieChart>
      </ChartContainer>
      <ul className="space-y-1.5 text-xs">
        {SHIP_DATA.map((d) => {
          const c = shipConfig[d.stage as keyof typeof shipConfig] as { label: string; color: string };
          return (
            <li key={d.stage} className="flex items-center gap-2 text-zinc-300">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.label} <span className="text-zinc-500">{d.count}</span>
            </li>
          );
        })}
        <li className="pt-1 text-[10px] text-zinc-500">Illustrative</li>
      </ul>
    </div>
  );
}
