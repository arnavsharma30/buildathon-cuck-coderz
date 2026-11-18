"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CheckCircle2, Circle, Factory, Globe, Megaphone, PackageCheck, Palette, Search, Sparkles } from "lucide-react";
import { useWorkspace } from "@/lib/store";
import { unitEconomics, inr, pct } from "@/lib/economics";
import { assessOrder, portfolioImpact } from "@/lib/rto";
import { demoWorkspace } from "@/lib/seed";
import { Badge, Button, Card, PageHeader, Stat, cx, inputCls } from "@/components/ui";

export default function CommandCenter() {
  const { ws, update, activeProduct, reset, mode } = useWorkspace();
  const pid = activeProduct?.id;

  const sup = ws.suppliers.filter((s) => s.productId === pid);
  const creatives = ws.creatives.filter((c) => c.productId === pid);
  const adsets = ws.adsets.filter((a) => a.productId === pid);
  const site = ws.websites.find((w) => w.productId === pid);
  const siteOrders = ws.orders.filter((o) => o.source === "website").length;
  const econ = activeProduct
    ? unitEconomics({ sellingPrice: activeProduct.sellingPrice, productCost: activeProduct.sourcingCost, shippingFwd: activeProduct.shippingCost }, ws.economics)
    : null;

  const spend = adsets.reduce((a, s) => a + s.spend, 0);
  const purchases = adsets.reduce((a, s) => a + s.purchases, 0);
  const cpa = purchases ? spend / purchases : 0;

  const orderStats = useMemo(() => {
    const pending = ws.orders.filter((o) => o.status === "new");
    const items = pending.map((order) => ({ order, risk: assessOrder(order, { orders: ws.orders }) }));
    const impact = portfolioImpact(items, ws.economics, activeProduct?.shippingCost ?? 65, activeProduct?.sourcingCost ?? 250);
    return { pending: pending.length, risky: items.filter((i) => i.risk.band === "high" || i.risk.band === "critical").length, impact };
  }, [ws.orders, ws.economics, activeProduct]);

  const finalized = sup.find((s) => s.stage === "finalized");
  const quoted = sup.filter((s) => s.quote).length;

  const steps = [
    {
      href: "/products",
      icon: Search,
      title: "Product research",
      done: ws.products.length > 0,
      metric: `${ws.products.length} shortlisted`,
      detail: activeProduct ? `Active: ${activeProduct.name}` : "Find a product that survives COD & RTO",
    },
    {
      href: "/suppliers",
      icon: Factory,
      title: "Suppliers & quotes",
      done: Boolean(finalized),
      metric: `${sup.length} found · ${sup.filter((s) => s.stage !== "found").length} contacted · ${quoted} quoted`,
      detail: finalized ? `Finalized: ${finalized.name}` : "Get dropship + COD + blind-shipping quotes",
    },
    {
      href: "/website",
      icon: Globe,
      title: "Website",
      done: Boolean(site?.publishedAt),
      metric: site?.publishedAt ? `Live at /s/${site.slug}` : site ? "Draft saved" : "No store page yet",
      detail: site?.publishedAt ? `${siteOrders} website orders synced` : "AI-built store page with COD checkout",
    },
    {
      href: "/creatives",
      icon: Palette,
      title: "Ad creatives",
      done: creatives.length > 0,
      metric: `${creatives.length} creatives`,
      detail: creatives.length ? `Angles: ${[...new Set(creatives.map((c) => c.angle))].slice(0, 3).join(", ")}` : "Hooks, copy & Reel scripts",
    },
    {
      href: "/ads",
      icon: Megaphone,
      title: "Meta ads",
      done: purchases > 0,
      metric: `${adsets.length} ad sets · ${inr(spend)} spent`,
      detail: purchases ? `${purchases} purchases · CPA ${inr(cpa)}${econ ? ` vs break-even ${inr(econ.profitBeforeAds)}` : ""}` : "Test structure, kill/scale rules",
    },
    {
      href: "/orders",
      icon: PackageCheck,
      title: "Orders & RTO",
      done: ws.orders.length > 0 && orderStats.risky === 0,
      metric: `${orderStats.pending} awaiting dispatch`,
      detail: orderStats.pending ? `${orderStats.risky} high-risk COD orders to verify` : "Score every COD order before shipping",
    },
  ];

  const nextActions = buildNextActions({
    hasProduct: !!activeProduct,
    econLoss: econ ? econ.profitPerOrder < 0 : false,
    suppliers: sup.length,
    contacted: sup.filter((s) => s.stage !== "found").length,
    quoted,
    finalized: !!finalized,
    creatives: creatives.length,
    adsets: adsets.length,
    sitePublished: Boolean(site?.publishedAt),
    cpaOver: econ && purchases ? cpa > econ.profitBeforeAds : false,
    risky: orderStats.risky,
  });

  return (
    <div>
      <PageHeader
        title="Command center"
        subtitle="Your whole Dropship Challenge pipeline in one place: from picking a product to shipping COD orders that actually get delivered."
        actions={
          <>
            <Button variant="ghost" onClick={() => confirm("Clear the whole workspace?") && reset()}>
              Reset
            </Button>
            <Button
              onClick={() => {
                if (
                  mode === "team" &&
                  !confirm("Load the demo data into your TEAM workspace? This replaces your team's products, suppliers, orders and more for every teammate.")
                )
                  return;
                update(() => demoWorkspace(ws.teamName));
              }}
            >
              <Sparkles className="h-4 w-4" /> Load demo workspace
            </Button>
          </>
        }
      />

      <div className="mb-5 flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-500">Store / team name</span>
        <input className={cx(inputCls, "max-w-xs py-1.5")} value={ws.teamName} onChange={(e) => update((w) => ({ ...w, teamName: e.target.value }))} />
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href} className="group rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-zinc-100 text-[10px]">{i + 1}</span>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-zinc-300" />}
              </div>
              <div className="mt-3 text-sm font-semibold text-zinc-900">{s.title}</div>
              <div className="mt-1 text-xs text-zinc-700">{s.metric}</div>
              <div className="mt-1 line-clamp-2 text-xs text-zinc-500">{s.detail}</div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-zinc-400 group-hover:text-zinc-900">
                Open <ArrowRight className="h-3 w-3" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Next best actions" className="lg:col-span-2">
          <ol className="space-y-2.5">
            {nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-3">
                <Badge tone={a.tone}>{a.tag}</Badge>
                <div className="flex-1 text-sm text-zinc-700">{a.text}</div>
                <Link href={a.href} className="shrink-0 text-xs font-medium text-zinc-900 hover:underline">
                  Go →
                </Link>
              </li>
            ))}
          </ol>
        </Card>

        <Card title={activeProduct ? `Unit economics · ${activeProduct.name}` : "Unit economics"}>
          {econ ? (
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Naive margin" value={pct(econ.naiveMarginPct)} hint="price − cost − shipping" />
              <Stat
                label="Real profit / order placed"
                value={inr(econ.profitPerOrder)}
                tone={econ.profitPerOrder > 0 ? "good" : "bad"}
                hint={`after ${pct(econ.blendedRto)} RTO & ads`}
              />
              <Stat label="Break-even CPA" value={inr(econ.profitBeforeAds)} />
              <Stat
                label="RTO saved (pending batch)"
                value={inr(orderStats.impact.saved)}
                tone="good"
                hint={`${pct(orderStats.impact.rtoRateBlind)} → ${pct(orderStats.impact.rtoRateWithActions)} RTO`}
              />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Shortlist a product to see what you really make per order.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

type Tone = "green" | "amber" | "red" | "blue" | "violet";
function buildNextActions(s: {
  hasProduct: boolean;
  econLoss: boolean;
  suppliers: number;
  contacted: number;
  quoted: number;
  finalized: boolean;
  creatives: number;
  adsets: number;
  sitePublished: boolean;
  cpaOver: boolean;
  risky: number;
}): { tag: string; tone: Tone; text: string; href: string }[] {
  const out: { tag: string; tone: Tone; text: string; href: string }[] = [];
  if (!s.hasProduct) {
    out.push({ tag: "Start", tone: "blue", text: "Find 5 product ideas and shortlist one that still makes money after COD RTO.", href: "/products" });
    return out;
  }
  if (s.econLoss) out.push({ tag: "Fix", tone: "red", text: "Your active product loses money per order once RTO and ad cost are counted. Raise the price, cut landed cost, or push prepaid.", href: "/products" });
  if (s.risky) out.push({ tag: "Urgent", tone: "red", text: `${s.risky} COD orders are high-risk. Confirm them on WhatsApp or take a ₹99 advance before booking the courier.`, href: "/orders" });
  if (s.cpaOver) out.push({ tag: "Ads", tone: "amber", text: "Blended CPA is above break-even. Kill the losing ad sets before spending more.", href: "/ads" });
  if (s.suppliers === 0) out.push({ tag: "Source", tone: "blue", text: "Search IndiaMART for suppliers of your active product.", href: "/suppliers" });
  else if (s.contacted < 3) out.push({ tag: "Source", tone: "blue", text: `Message at least 3 suppliers (you've contacted ${s.contacted}). Ask for dropship, COD and blind shipping.`, href: "/suppliers" });
  else if (!s.finalized) out.push({ tag: "Source", tone: "amber", text: `${s.quoted} quotes in. Compare landed cost and finalize the best one.`, href: "/suppliers" });
  if (!s.sitePublished) out.push({ tag: "Store", tone: "violet", text: "Generate and publish your store page so ads have somewhere to send people.", href: "/website" });
  if (s.creatives < 3) out.push({ tag: "Create", tone: "violet", text: `Make at least 3 creative angles to test (you have ${s.creatives}).`, href: "/creatives" });
  if (s.adsets === 0) out.push({ tag: "Ads", tone: "blue", text: "Generate a Meta testing campaign: 3 ABO ad sets × your best angles.", href: "/ads" });
  if (!out.length) out.push({ tag: "On track", tone: "green", text: "Everything is moving. Scale winning ad sets by 20%/day and keep confirming COD orders.", href: "/ads" });
  return out;
}
