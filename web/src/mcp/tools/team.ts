import * as z from "zod/v4";
import { defineTool, type ToolDef } from "../types";
import { unitEconomics, inr, pct } from "@/lib/economics";
import { assessOrder } from "@/lib/rto";

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export const teamTools: ToolDef[] = [
  defineTool({
    name: "get_team_overview",
    title: "Team overview & next steps",
    description:
      "Start here. Returns the caller's team, members, products with RTO-adjusted profit per order, supplier/website/ads/orders/shipping status, and a prioritised list of next actions for the dropshipping pipeline.",
    readOnly: true,
    schema: z.object({}),
    async run(ctx) {
      const t = await ctx.read();
      const ws = t.workspace;
      const products = ws.products.map((p) => {
        const r = unitEconomics({ sellingPrice: p.sellingPrice, productCost: p.sourcingCost, shippingFwd: p.shippingCost }, ws.economics);
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          sellingPrice: p.sellingPrice,
          landedCost: p.sourcingCost,
          naiveMarginPct: Math.round(r.naiveMarginPct * 100),
          realProfitPerOrderPlaced: r.profitPerOrder,
          breakEvenCpa: r.profitBeforeAds,
        };
      });
      const pending = ws.orders.filter((o) => o.status === "new");
      const risky = pending.filter((o) => {
        const b = assessOrder(o, { orders: ws.orders }).band;
        return b === "high" || b === "critical";
      }).length;
      const finalized = ws.suppliers.filter((s) => s.stage === "finalized").length;
      const quoted = ws.suppliers.filter((s) => s.quote).length;
      const live = ws.websites.filter((w) => w.publishedAt);

      const next: string[] = [];
      if (!ws.products.length) next.push("Add the team's 5-10 candidate products with add_products (name + selling price + landed cost if known).");
      else if (!ws.products.some((p) => p.status === "shortlisted" || p.status === "sourcing" || p.status === "live"))
        next.push("Run analyze_products and shortlist the products that still make money after COD RTO.");
      if (products.some((p) => p.realProfitPerOrderPlaced < 0)) next.push("Some products lose money per order after RTO and ads: reprice, cut landed cost or drop them.");
      if (ws.products.length && !finalized) next.push(quoted ? `Compare the ${quoted} supplier quotes with compare_quotes and finalize one.` : "Find IndiaMART suppliers, message them, and log replies with record_quote.");
      if (ws.products.length && !live.length) next.push("Write and publish the store page with publish_store_page.");
      if (ws.products.length && ws.creatives.length < 3) next.push("Save at least 3 ad angles with save_creatives.");
      if (risky) next.push(`${risky} pending COD orders are high-risk: run rto_check before shipping.`);
      if (!next.length) next.push("Pipeline is moving: keep logging ad results (ad_decisions) and run track_shipments daily.");

      const summary = [
        `${t.team.name} (store: ${t.team.storeName}) · ${t.members.length} members · you are ${ctx.memberName}`,
        `Products: ${ws.products.length} · suppliers: ${ws.suppliers.length} (${quoted} quoted, ${finalized} finalized) · store pages live: ${live.length} · creatives: ${ws.creatives.length} · ad sets: ${ws.adsets.length}`,
        `Orders: ${ws.orders.length} (${pending.length} awaiting dispatch, ${risky} high-risk) · assumptions: ${pct(ws.economics.codShare)} COD, ${pct(ws.economics.rtoCod)} COD RTO, CPA ${inr(ws.economics.cpa)}`,
        `Next: ${next.join(" | ")}`,
        `Analytics dashboard (charts): ${ctx.dashboardUrl}`,
      ].join("\n");

      return {
        text: summary,
        data: {
          team: t.team,
          members: t.members.map((m) => ({ name: m.name, role: m.role, lastActive: m.lastActiveAt ? ago(m.lastActiveAt) : "never" })),
          products,
          storePages: live.map((w) => ({ productId: w.productId, url: `${ctx.origin}/s/${w.slug}` })),
          economicsAssumptions: ws.economics,
          nextActions: next,
          dashboardUrl: ctx.dashboardUrl,
        },
      };
    },
  }),

  defineTool({
    name: "get_dashboard_link",
    title: "Open my analytics dashboard",
    description:
      "Returns the caller's personal link to the DropOS analytics dashboard (charts for orders, RTO risk, product profit, Meta ad sets, shipments and team activity). Use when the user asks for charts, analytics, a dashboard, or where to see their data.",
    readOnly: true,
    schema: z.object({}),
    async run(ctx) {
      return {
        text: `Your DropOS analytics dashboard: ${ctx.dashboardUrl}\nIt's personal to you (same key as your Claude connector), so don't share it publicly.`,
        data: { dashboardUrl: ctx.dashboardUrl },
      };
    },
  }),

  defineTool({
    name: "team_activity",
    title: "What my teammates did",
    description: "Latest actions by everyone on the team (who added which product, logged which quote, shipped which order...). Optionally filter by member name.",
    readOnly: true,
    schema: z.object({
      member: z.string().optional().describe("Only show this teammate's actions (name, case-insensitive)"),
      limit: z.number().int().min(1).max(100).default(25),
    }),
    async run(ctx, { member, limit }) {
      const t = await ctx.read();
      const items = t.activity
        .filter((a) => !member || a.memberName.toLowerCase().includes(member.toLowerCase()))
        .slice(0, limit);
      const perMember = t.members.map((m) => ({ name: m.name, role: m.role, actions: t.activity.filter((a) => a.memberId === m.id).length }));
      return {
        text: items.length ? items.map((a) => `${ago(a.at)} · ${a.memberName} ${a.text}`).join("\n") : "No activity yet.",
        data: { perMember, activity: items },
      };
    },
  }),
];
