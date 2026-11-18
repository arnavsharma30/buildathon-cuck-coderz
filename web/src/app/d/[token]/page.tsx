import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveToken } from "@/mcp/context";
import { getTeam } from "@/lib/team-store";
import { listShipmentsForTeam } from "@/lib/shipping-store";
import { unitEconomics, inr, pct } from "@/lib/economics";
import { assessOrder, portfolioImpact, type RiskBand } from "@/lib/rto";
import { adMetrics, decide } from "@/lib/ads";
import type { ShipmentStatus } from "@/lib/couriers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdsetChart, EmptyChart, OrdersAreaChart, ProductEconomicsChart, RiskDonut, ShipmentsChart, TeamChart } from "@/components/dashboard/Charts";
import { RememberKey } from "@/components/dashboard/RememberKey";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "DropOS · Team analytics", robots: { index: false } };

const IST = 5.5 * 3600e3;
const dayKey = (iso: string | number) => new Date(new Date(iso).getTime() + IST).toISOString().slice(0, 10);
const dayLabel = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const short = (s: string, n = 18) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const initials = (s: string) =>
  s
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

const SHIP_BUCKET: Record<ShipmentStatus, string> = {
  booked: "Booked",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  ndr: "Failed attempt",
  rto_initiated: "RTO",
  rto_delivered: "RTO",
};

export default async function Dashboard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const who = await resolveToken(token);
  const t = who ? await getTeam(who.teamId) : null;
  if (!who || !t) notFound();

  const ws = t.workspace;
  const econ = ws.economics;
  const productEcon = new Map(
    ws.products.map((p) => [p.id, unitEconomics({ sellingPrice: p.sellingPrice, productCost: p.sourcingCost, shippingFwd: p.shippingCost }, econ)]),
  );

  // Orders per day (IST), filled, last 30 days of activity.
  const byDay = new Map<string, { cod: number; prepaid: number }>();
  for (const o of ws.orders) {
    const k = dayKey(o.createdAt);
    const row = byDay.get(k) ?? { cod: 0, prepaid: 0 };
    if (o.payment === "COD") row.cod += 1;
    else row.prepaid += 1;
    byDay.set(k, row);
  }
  const keys = [...byDay.keys()].sort();
  const ordersSeries: { day: string; cod: number; prepaid: number }[] = [];
  if (keys.length) {
    const end = new Date(`${keys[keys.length - 1]}T00:00:00Z`).getTime();
    const start = Math.max(new Date(`${keys[0]}T00:00:00Z`).getTime(), end - 29 * 86400e3);
    // Always show at least a week so a single day of data still reads as a chart.
    for (let d = Math.min(start, end - 6 * 86400e3); d <= end; d += 86400e3) {
      const k = new Date(d).toISOString().slice(0, 10);
      ordersSeries.push({ day: dayLabel(k), ...(byDay.get(k) ?? { cod: 0, prepaid: 0 }) });
    }
  }

  // RTO: actual (closed orders) and predicted (pending).
  const delivered = ws.orders.filter((o) => o.status === "delivered").length;
  const returned = ws.orders.filter((o) => o.status === "rto").length;
  const pending = ws.orders.filter((o) => o.status === "new");
  const assessed = pending.map((order) => ({ order, risk: assessOrder(order, { orders: ws.orders }) }));
  const mainProduct = ws.products[0];
  const impact = portfolioImpact(assessed, econ, mainProduct?.shippingCost ?? 65, mainProduct?.sourcingCost ?? 250);
  const riskMix: { band: RiskBand; count: number }[] = (["low", "medium", "high", "critical"] as RiskBand[]).map((band) => ({
    band,
    count: assessed.filter((a) => a.risk.band === band).length,
  }));

  // Ads: per ad set CPA vs its product's break-even, with the decision engine's verdict.
  const adRows = ws.adsets.map((a) => {
    const p = ws.products.find((x) => x.id === a.productId);
    const r = p ? productEcon.get(p.id) : undefined;
    const be = r?.profitBeforeAds ?? 0;
    const m = adMetrics(a, p?.sellingPrice ?? 0, r?.deliveredRate ?? 0.75, be);
    return { a, be, m, verdict: decide(a, m, be).verdict };
  });
  const sum = (f: (x: (typeof adRows)[number]) => number) => adRows.reduce((acc, x) => acc + f(x), 0);
  const spend = sum((x) => x.a.spend);
  const purchases = sum((x) => x.a.purchases);
  const profitAfterRto = sum((x) => x.m.profit);
  const beWeighted = sum((x) => x.be * x.a.spend);
  const adsets = adRows.map(({ a, m, verdict }) => ({
    name: short(a.name.replace(/^.*?·\s*/, ""), 20),
    cpa: Math.round(m.cpa),
    spend: a.spend,
    orders: a.purchases,
    verdict,
  }));
  const blendedCpa = purchases ? spend / purchases : 0;
  const breakEven = spend ? beWeighted / spend : mainProduct ? (productEcon.get(mainProduct.id)?.profitBeforeAds ?? 0) : 0;

  // Shipments.
  const shipments = await listShipmentsForTeam(t.team.id);
  const shipOrder = ["Booked", "Picked up", "In transit", "Out for delivery", "Delivered", "Failed attempt", "RTO"];
  const shipCounts = shipOrder.map((status) => ({ status, count: shipments.filter((s) => SHIP_BUCKET[s.status] === status).length }));

  // Team.
  const perMember = t.members.map((m) => ({ name: m.name.split(" ")[0], actions: t.activity.filter((a) => a.memberId === m.id).length }));
  const lastActivity = t.activity[0];

  const kpis = [
    { label: "Orders", value: String(ws.orders.length), hint: ws.orders.length ? `${pct(ws.orders.filter((o) => o.payment === "COD").length / ws.orders.length)} COD` : "none yet" },
    { label: "Delivered", value: String(delivered), hint: `${shipments.length} shipments tracked` },
    {
      label: "RTO",
      value: delivered + returned ? pct(returned / (delivered + returned)) : pending.length ? `~${pct(impact.rtoRateBlind)}` : "—",
      hint: delivered + returned ? "actual, closed orders" : pending.length ? "predicted for pending" : "no orders yet",
      tone: (delivered + returned ? returned / (delivered + returned) : impact.rtoRateBlind) > 0.2 ? "bad" : undefined,
    },
    { label: "Ad spend", value: inr(spend), hint: `${purchases} purchases` },
    {
      label: "Blended CPA",
      value: purchases ? inr(blendedCpa) : "—",
      hint: breakEven ? `break-even ${inr(breakEven)}` : "no ads yet",
      tone: purchases && breakEven ? (blendedCpa <= breakEven ? "good" : "bad") : undefined,
    },
    {
      label: "Profit after RTO",
      value: spend ? inr(profitAfterRto) : "—",
      hint: "est. from ad orders",
      tone: spend ? (profitAfterRto >= 0 ? "good" : "bad") : undefined,
    },
  ] as { label: string; value: string; hint: string; tone?: "good" | "bad" }[];

  return (
    <main className="min-h-screen bg-zinc-50">
      <RememberKey token={token} />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-bold text-zinc-950">D</div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{t.team.storeName}</h1>
              <p className="text-xs text-zinc-500">
                {t.team.name} · analytics{lastActivity ? ` · last activity ${ago(lastActivity.at)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {t.members.map((m) => (
              <div key={m.id} className="relative" title={`${m.name} · ${m.role}${m.mcpConnectedAt ? " · Claude connected" : " · not connected yet"}`}>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">{initials(m.name)}</div>
                <span
                  className={
                    m.mcpConnectedAt
                      ? "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-zinc-50"
                      : "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-zinc-300 ring-2 ring-zinc-50"
                  }
                />
              </div>
            ))}
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k) => (
            <Card key={k.label} size="sm">
              <CardContent>
                <div className="text-xs text-zinc-500">{k.label}</div>
                <div
                  className={
                    k.tone === "good"
                      ? "mt-1 text-2xl font-semibold tabular-nums text-emerald-600"
                      : k.tone === "bad"
                        ? "mt-1 text-2xl font-semibold tabular-nums text-red-600"
                        : "mt-1 text-2xl font-semibold tabular-nums text-zinc-900"
                  }
                >
                  {k.value}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-400">{k.hint}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>Per day, COD vs prepaid</CardDescription>
            </CardHeader>
            <CardContent>
              {ordersSeries.length ? <OrdersAreaChart data={ordersSeries} /> : <EmptyChart>No orders yet. Ask Claude: “import our Shopify orders”.</EmptyChart>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>RTO risk</CardTitle>
              <CardDescription>
                {pending.length ? `${pending.length} waiting · ~${pct(impact.rtoRateBlind)} RTO if shipped blind · ${inr(impact.saved)} saved by acting` : "Pending COD orders"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length ? <RiskDonut data={riskMix} predictedRto={impact.rtoRateBlind} /> : <EmptyChart>Nothing waiting to ship.</EmptyChart>}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Looks profitable vs actually profitable</CardTitle>
              <CardDescription>Per order placed, after {pct(econ.rtoCod)} COD returns and {inr(econ.cpa)} ads</CardDescription>
            </CardHeader>
            <CardContent>
              {ws.products.length ? (
                <ProductEconomicsChart
                  data={ws.products.map((p) => {
                    const r = productEcon.get(p.id)!;
                    return { name: short(p.name, 16), naive: Math.round(r.naiveMargin), real: Math.round(r.profitPerOrder) };
                  })}
                />
              ) : (
                <EmptyChart>No products yet. Tell Claude your 5-10 product ideas.</EmptyChart>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Meta ad sets</CardTitle>
              <CardDescription>CPA vs break-even, with DropOS&apos;s call</CardDescription>
            </CardHeader>
            <CardContent>
              {adsets.length ? <AdsetChart data={adsets} breakEven={Math.round(breakEven)} /> : <EmptyChart>No ad sets yet. Ask Claude: “launch our Meta test campaign”.</EmptyChart>}
            </CardContent>
          </Card>
        </section>

        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Shipments</CardTitle>
              <CardDescription>Live from Shiprocket / Delhivery</CardDescription>
            </CardHeader>
            <CardContent>
              {shipments.length ? <ShipmentsChart data={shipCounts} /> : <EmptyChart>No shipments yet. Ask Claude: “ship the confirmed orders”.</EmptyChart>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Team</CardTitle>
              <CardDescription>Who did what</CardDescription>
            </CardHeader>
            <CardContent>
              <TeamChart data={perMember} />
              <ul className="mt-3 space-y-1.5 text-xs text-zinc-600">
                {t.activity.slice(0, 5).map((a) => (
                  <li key={a.id} className="truncate">
                    <span className="font-medium text-zinc-900">{a.memberName}</span> {a.text} <span className="text-zinc-400">· {ago(a.at)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <footer className="mt-8 text-center text-xs text-zinc-400">Everything here is managed by talking to Claude.</footer>
      </div>
    </main>
  );
}
