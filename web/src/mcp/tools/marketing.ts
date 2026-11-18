import * as z from "zod/v4";
import { defineTool, type McpCtx, type ToolDef } from "../types";
import type { SharedWorkspace } from "@/lib/merge";
import type { AdSetRow, Creative, EconomicsSettings, Product, Supplier } from "@/lib/types";
import { inr, unitEconomics } from "@/lib/economics";
import { outreachTemplate } from "@/lib/suppliers-demo";
import { adMetrics, decide, simulate } from "@/lib/ads";
import { rid } from "@/lib/team-store";
import { getIntegrations } from "@/lib/shipping-store";
import { isIndianMobile, normalizeIndianMobile } from "@/lib/auth";
import { adsetInsights, createAd, createAdCreative, createAdSet, createCampaign, sendWhatsApp, updateAdSet, type MetaCreds } from "@/lib/meta";
import {
  getMarketing,
  mutateMarketing,
  sendResendEmail,
  type Contact,
  type MetaLaunch,
  type MetaLaunchAdset,
  type OutboundCampaign,
  type OutboundRecipient,
} from "@/lib/outbound";

// ---------------------------------------------------------------- helpers

const norm = (s: string) => s.trim().toLowerCase();

function findIn<T extends { id: string; name: string }>(items: T[], ref: string, what: string): T {
  const r = norm(ref);
  const hit =
    items.find((x) => x.id === ref.trim()) ??
    items.find((x) => norm(x.name) === r) ??
    items.find((x) => norm(x.name).includes(r) || r.includes(norm(x.name)));
  if (!hit) {
    const names = items.map((x) => `"${x.name}" (${x.id})`).join(", ");
    throw new Error(`No ${what} matches "${ref}". ${items.length ? `Valid ${what}s: ${names}` : `The team has no ${what}s yet.`}`);
  }
  return hit;
}
const findProduct = (ws: SharedWorkspace, ref: string) => findIn(ws.products, ref, "product");
const ProductRef = z.string().min(1).describe("Product id or name");

const econOf = (p: Product, s: EconomicsSettings) =>
  unitEconomics({ sellingPrice: p.sellingPrice, productCost: p.sourcingCost, shippingFwd: p.shippingCost }, s);

/** Profit per order placed is linear in landed cost: the highest landed cost that still leaves `target` profit. */
function maxLandedCost(p: Product, s: EconomicsSettings, target: number): number | null {
  const at = (c: number) => econOf({ ...p, sourcingCost: c }, s).profitPerOrder;
  const a = at(0);
  const b = at(100);
  const slope = (b - a) / 100;
  if (slope >= 0 || a < target) return a >= target ? null : 0;
  return Math.floor((target - a) / slope);
}

const enc = encodeURIComponent;
const waLink = (phone10: string | undefined, text: string) =>
  phone10 && isIndianMobile(phone10) ? `https://wa.me/91${phone10}?text=${enc(text)}` : `https://wa.me/?text=${enc(text)}`;
const mailto = (to: string, subject: string, body: string) => `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`;

async function metaCreds(ctx: McpCtx): Promise<MetaCreds | null> {
  const i = await getIntegrations(ctx.teamId);
  return i.meta ?? null;
}

const DEMO_NOTE = "DEMO mode: nothing was sent to Meta. Connect the team's ad account with connect_integration provider \"meta\" to launch for real.";
const demoId = (prefix: string) => `demo_${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const firstName = (n: string) => n.trim().split(/\s+/)[0] || "there";
const render = (tpl: string, c: Pick<Contact, "name">, store: string) => tpl.replace(/\{\{\s*name\s*\}\}/gi, firstName(c.name)).replace(/\{\{\s*store\s*\}\}/gi, store);

function withOptOutLine(channel: "whatsapp" | "email", msg: string) {
  if (/stop|unsubscribe/i.test(msg)) return msg;
  return channel === "whatsapp" ? `${msg}\n\nReply STOP to opt out.` : `${msg}\n\nReply "unsubscribe" to stop these emails.`;
}

function withoutMessage(r: OutboundRecipient) {
  const copy: Partial<OutboundRecipient> = { ...r };
  delete copy.message;
  return copy;
}

function audienceOf(contacts: Contact[], channel: "whatsapp" | "email", audience: OutboundCampaign["audience"]) {
  return contacts.filter((c) => {
    if (!c.optedIn || c.optedOut) return false;
    if (channel === "whatsapp" ? !c.phone : !c.email) return false;
    const isCustomer = c.tags.includes("customer");
    if (audience.segment === "leads" && isCustomer) return false;
    if (audience.segment === "customers" && !isCustomer) return false;
    if (audience.tags?.length && !audience.tags.some((t) => c.tags.map(norm).includes(norm(t)))) return false;
    return true;
  });
}

// ---------------------------------------------------------------- tools

export const marketingTools: ToolDef[] = [
  // ---------------- Sourcing
  defineTool({
    name: "find_suppliers",
    title: "Find suppliers (sourcing playbook)",
    description:
      "Sourcing playbook for one product: ready-made IndiaMART / TradeIndia / Alibaba search links, the target landed cost that keeps the product profitable after RTO, and the checklist to vet suppliers (GST, TrustSEAL, dropship + COD + blind shipping, samples). Use your own web search to open these links, then call record_supplier for every real supplier you find.",
    readOnly: true,
    schema: z.object({ product: ProductRef }),
    async run(ctx, { product }) {
      const t = await ctx.read();
      const ws = t.workspace;
      const p = findProduct(ws, product);
      const q = (p.indiamartQuery || p.name).trim();
      const cushion = Math.max(50, p.sellingPrice * 0.08);
      const target = maxLandedCost(p, ws.economics, cushion);
      const existing = ws.suppliers.filter((s) => s.productId === p.id);
      const links = {
        indiamart: `https://dir.indiamart.com/search.mp?ss=${enc(q)}`,
        tradeindia: `https://www.tradeindia.com/search.html?keyword=${enc(q)}`,
        alibaba: `https://www.alibaba.com/trade/search?SearchText=${enc(q)}`,
        google: `https://www.google.com/search?q=${enc(`${q} wholesale supplier dropshipping India`)}`,
      };
      const checklist = [
        "GST-verified seller (GST bill needed for your accounts)",
        "IndiaMART TrustSEAL / verified exporter, 3+ years in business, rating ≥ 4",
        "Will dropship directly to your customer (no bulk inventory)",
        "Supports COD orders, or at least ships COD parcels booked by you",
        "Blind / white-label packing (no supplier name or invoice in the parcel)",
        "Dispatch within 24-48h; clear damage / RTO return policy",
        "Order a sample before running ads",
      ];
      return {
        text: [
          `Sourcing ${p.name} (search: "${q}")`,
          target != null
            ? `Target: landed cost ≤ ${inr(target)} per unit incl. GST to keep ≥ ${inr(cushion)}/order after RTO + ads at ₹${p.sellingPrice} (current estimate ${inr(p.sourcingCost)}).`
            : `At ₹${p.sellingPrice} this product can't reach a ${inr(cushion)} cushion at any landed cost: reprice first (analyze_products).`,
          `Search: IndiaMART ${links.indiamart} · TradeIndia ${links.tradeindia} · Alibaba ${links.alibaba}`,
          `Vet each supplier for: ${checklist.join("; ")}.`,
          existing.length ? `Already tracked: ${existing.map((s) => `${s.name} (${s.stage})`).join(", ")}.` : "No suppliers tracked yet for this product.",
          "Next: open the links with web search, call record_supplier for each real supplier (name, city, url, phone), then supplier_outreach_campaign to message them all.",
        ].join("\n"),
        data: { product: { id: p.id, name: p.name }, searchQuery: q, links, targetLandedCost: target, checklist, trackedSuppliers: existing.map((s) => ({ id: s.id, name: s.name, stage: s.stage })) },
      };
    },
  }),

  defineTool({
    name: "supplier_outreach_campaign",
    title: "Message many suppliers at once",
    description:
      "Personalised first message (Hinglish WhatsApp, email, or IndiaMART enquiry) to many suppliers of one product in one go, asking for rates at 10/50/100 pcs, GST, dropship, blind packing, COD, dispatch time, samples and damage policy. Returns one-click wa.me links per supplier and marks them 'contacted'. Default recipients: every supplier of the product still at stage 'found'.",
    schema: z.object({
      product: ProductRef,
      suppliers: z.array(z.string()).optional().describe("Supplier ids or names (default: all at stage 'found')"),
      channel: z.enum(["whatsapp", "email", "indiamart"]).default("whatsapp"),
    }),
    async run(ctx, { product, suppliers, channel }) {
      const batch = await ctx.update((ws) => {
        const p = findProduct(ws, product);
        const pool = ws.suppliers.filter((s) => s.productId === p.id);
        const chosen: Supplier[] = suppliers?.length ? suppliers.map((ref) => findIn(pool, ref, `supplier of ${p.name}`)) : pool.filter((s) => s.stage === "found");
        if (!chosen.length) throw new Error(`No suppliers to message for ${p.name}. Use find_suppliers + record_supplier first, or pass supplier names.`);
        const now = Date.now();
        return chosen.map((s) => {
          const message = outreachTemplate({ product: p, supplier: s, channel, teamName: ws.teamName });
          s.outreach = { channel, message, sentAt: now };
          if (s.stage === "found") s.stage = "contacted";
          const phone = normalizeIndianMobile(s.phone ?? "");
          return {
            supplierId: s.id,
            supplier: s.name,
            city: s.city,
            stage: s.stage,
            message,
            link: channel === "whatsapp" ? waLink(isIndianMobile(phone) ? phone : undefined, message) : channel === "email" ? mailto("", `Dropshipping enquiry: ${p.name}`, message) : s.url,
          };
        });
      });
      return {
        text: [
          `Prepared ${batch.length} ${channel} message(s); suppliers marked "contacted":`,
          ...batch.map((b) => `• ${b.supplier}${b.city ? ` (${b.city})` : ""}: ${channel === "indiamart" ? "paste the message into their IndiaMART enquiry" : "one-click send link in data"}`),
          "When they reply, paste each reply into record_quote.",
        ].join("\n"),
        data: { channel, messages: batch },
      };
    },
  }),

  // ---------------- Meta Marketing API
  defineTool({
    name: "meta_launch_campaign",
    title: "Launch ads on Meta (campaign, ad sets, ads)",
    description:
      "Creates a Meta campaign with one ad set per audience and one ad per ad set in the team's own ad account through the Meta Marketing API, using the product's saved creatives and its published DropOS store page as the landing page. Everything is created PAUSED unless activate is true: ALWAYS confirm budget and activation with the user before passing activate: true (it spends real money). Without a connected Meta account it runs in DEMO mode (simulated ids). Also creates matching ad sets in the tracker so meta_sync_results / ad_decisions work.",
    schema: z.object({
      product: ProductRef,
      dailyBudget: z.number().min(100).describe("Total daily budget in INR across all ad sets"),
      adsets: z
        .array(
          z.object({
            name: z.string().min(1),
            audience: z.string().default("India, broad").describe("Human description, e.g. 'Students 18-24, metros'"),
            ageMin: z.number().int().min(18).max(65).default(18),
            ageMax: z.number().int().min(18).max(65).default(44),
            gender: z.enum(["male", "female"]).optional(),
            dailyBudget: z.number().min(50).optional().describe("INR; default = equal split"),
            creativeAngle: z.string().optional().describe("Which saved creative angle to use"),
          }),
        )
        .max(6)
        .optional()
        .describe("Default: the product's planned ad sets (plan_meta_campaign), else a 3-way ABO test"),
      landingUrl: z.string().url().optional().describe("Default: the product's published DropOS store page"),
      activate: z.boolean().default(false).describe("true = go live immediately (spends money). Default PAUSED."),
    }),
    async run(ctx, { product, dailyBudget, adsets, landingUrl, activate }) {
      const t = await ctx.read();
      const ws = t.workspace;
      const p = findProduct(ws, product);
      const creatives = ws.creatives.filter((c) => c.productId === p.id);
      if (!creatives.length) throw new Error(`No saved creatives for ${p.name}. Write 2-4 ad angles and save them with save_creatives first.`);
      const site = ws.websites.find((w) => w.productId === p.id && w.publishedAt);
      const link = landingUrl ?? (site ? `${ctx.origin}/s/${site.slug}` : undefined);
      if (!link) throw new Error(`No landing page: publish the store page with publish_store_page first, or pass landingUrl.`);

      const planned = ws.adsets.filter((a) => a.productId === p.id);
      const specs =
        adsets?.length
          ? adsets
          : planned.length
            ? planned.slice(0, 6).map((a) => ({ name: a.name, audience: a.audience, ageMin: 18, ageMax: 44, gender: undefined, dailyBudget: a.dailyBudget || undefined, creativeAngle: a.creativeAngle }))
            : [
                { name: `${p.name} · 18-24 · ${creatives[0].angle}`, audience: "18-24, India", ageMin: 18, ageMax: 24, gender: undefined, dailyBudget: undefined, creativeAngle: creatives[0].angle },
                { name: `${p.name} · 25-34 · ${creatives[1 % creatives.length].angle}`, audience: "25-34, India", ageMin: 25, ageMax: 34, gender: undefined, dailyBudget: undefined, creativeAngle: creatives[1 % creatives.length].angle },
                { name: `${p.name} · Broad 18-44 · ${creatives[2 % creatives.length].angle}`, audience: "18-44, India, broad", ageMin: 18, ageMax: 44, gender: undefined, dailyBudget: undefined, creativeAngle: creatives[2 % creatives.length].angle },
              ];
      const each = Math.max(50, Math.round(dailyBudget / specs.length));
      const status = activate ? "ACTIVE" : "PAUSED";
      const creds = await metaCreds(ctx);
      const mode: MetaLaunch["mode"] = creds ? "live" : "demo";
      const objective = creds?.pixelId ? "OUTCOME_SALES" : "OUTCOME_TRAFFIC";
      const campaignName = `DropOS · ${p.name} · ${new Date().toISOString().slice(0, 10)}`;
      const pickCreative = (angle: string | undefined, i: number): Creative =>
        creatives.find((c) => angle && norm(c.angle) === norm(angle)) ?? creatives[i % creatives.length];

      let campaignId: string;
      const launched: MetaLaunchAdset[] = [];
      const errors: string[] = [];
      if (creds) {
        campaignId = (await createCampaign(creds, { name: campaignName, objective, status })).id;
      } else campaignId = demoId("cmp");

      for (const [i, s] of specs.entries()) {
        const budget = s.dailyBudget ?? each;
        const cr = pickCreative(s.creativeAngle, i);
        const row: MetaLaunchAdset = { adsetRowId: "", name: s.name, metaAdsetId: "", dailyBudget: budget, status };
        try {
          if (creds) {
            row.metaAdsetId = (await createAdSet(creds, { campaignId, name: s.name, dailyBudgetInr: budget, ageMin: s.ageMin, ageMax: s.ageMax, gender: s.gender, status })).id;
            row.metaCreativeId = (
              await createAdCreative(creds, { name: `${s.name} · ${cr.angle}`, link, message: cr.primaryText, headline: cr.headline, imageUrl: p.images?.[0] })
            ).id;
            row.metaAdId = (await createAd(creds, { name: `${s.name} · ad`, adsetId: row.metaAdsetId, creativeId: row.metaCreativeId, status })).id;
          } else {
            row.metaAdsetId = demoId("adset");
            row.metaCreativeId = demoId("creative");
            row.metaAdId = demoId("ad");
          }
        } catch (e) {
          row.error = e instanceof Error ? e.message : String(e);
          errors.push(`${s.name}: ${row.error}`);
        }
        launched.push(row);
      }

      // Mirror into the ad set tracker so ad_decisions works on the same rows.
      await ctx.update((w) => {
        for (const [i, l] of launched.entries()) {
          const s = specs[i];
          let a: AdSetRow | undefined = w.adsets.find((x) => x.productId === p.id && norm(x.name) === norm(l.name));
          if (!a) {
            a = { id: rid("as"), productId: p.id, name: l.name, creativeAngle: pickCreative(s.creativeAngle, i).angle, audience: s.audience, dailyBudget: l.dailyBudget, spend: 0, impressions: 0, clicks: 0, addToCarts: 0, purchases: 0 };
            w.adsets.push(a);
          } else a.dailyBudget = l.dailyBudget;
          l.adsetRowId = a.id;
        }
        if (p.status === "idea" || p.status === "shortlisted" || p.status === "sourcing") {
          const prod = w.products.find((x) => x.id === p.id);
          if (prod && activate) prod.status = "live";
        }
      });

      const launch: MetaLaunch = {
        id: rid("ml"),
        productId: p.id,
        mode,
        campaignId,
        campaignName,
        objective,
        landingUrl: link,
        createdAt: Date.now(),
        createdBy: ctx.memberName,
        adsets: launched,
      };
      await mutateMarketing(ctx.teamId, (m) => {
        m.metaLaunches.unshift(launch);
      });
      await ctx.log(`${mode === "live" ? "launched" : "simulated"} Meta campaign "${campaignName}" (${launched.length} ad sets, ${inr(launched.reduce((s, a) => s + a.dailyBudget, 0))}/day, ${status})`, "adsets");

      return {
        text: [
          mode === "demo" ? DEMO_NOTE : `Created in Meta ad account ${creds?.adAccountId} (${objective}).`,
          `Campaign ${campaignName} · ${status} · landing page ${link}`,
          ...launched.map((l) => `• ${l.name}: ${inr(l.dailyBudget)}/day${l.error ? ` FAILED: ${l.error}` : ` · ad set ${l.metaAdsetId}`}`),
          status === "PAUSED" ? "Everything is PAUSED. Review in Ads Manager and confirm with the team before activating (call again with activate: true, or switch on in Ads Manager)." : "LIVE: spending has started.",
          "After 2-3 days: meta_sync_results → ad_decisions / meta_apply_decisions.",
        ].join("\n"),
        data: { launch, errors },
      };
    },
  }),

  defineTool({
    name: "meta_sync_results",
    title: "Pull ad results from Meta",
    description:
      "Pulls lifetime spend, impressions, link clicks, add-to-carts and purchases for every ad set DropOS launched (Meta Insights API) into the team's ad set tracker. In DEMO mode it generates plausible Indian results calibrated to the product's break-even CPA. Run ad_decisions or meta_apply_decisions next.",
    schema: z.object({ product: ProductRef.optional().describe("Default: every launched product") }),
    async run(ctx, { product }) {
      const ws = (await ctx.read()).workspace;
      const p = product ? findProduct(ws, product) : undefined;
      const m = await getMarketing(ctx.teamId);
      const launches = m.metaLaunches.filter((l) => !p || l.productId === p.id);
      if (!launches.length) throw new Error("Nothing launched yet. Use meta_launch_campaign first.");
      const creds = await metaCreds(ctx);
      const results: { rowId: string; name: string; mode: string; numbers?: Omit<AdSetRow, "id" | "productId" | "name" | "creativeAngle" | "audience" | "dailyBudget">; error?: string }[] = [];
      for (const l of launches) {
        const prod = ws.products.find((x) => x.id === l.productId);
        const be = prod ? econOf(prod, ws.economics).profitBeforeAds : undefined;
        for (const [i, a] of l.adsets.entries()) {
          if (!a.adsetRowId || a.error) continue;
          try {
            if (l.mode === "live") {
              if (!creds) throw new Error("Meta is no longer connected");
              const ins = await adsetInsights(creds, a.metaAdsetId);
              results.push({ rowId: a.adsetRowId, name: a.name, mode: "live", numbers: ins });
            } else {
              const row = ws.adsets.find((x) => x.id === a.adsetRowId);
              if (!row) continue;
              const sim = simulate({ ...row, dailyBudget: a.dailyBudget }, prod?.sellingPrice ?? 699, i, be);
              results.push({ rowId: a.adsetRowId, name: a.name, mode: "demo", numbers: { spend: sim.spend, impressions: sim.impressions, clicks: sim.clicks, addToCarts: sim.addToCarts, purchases: sim.purchases } });
            }
          } catch (e) {
            results.push({ rowId: a.adsetRowId, name: a.name, mode: l.mode, error: e instanceof Error ? e.message : String(e) });
          }
        }
      }
      await ctx.update((w) => {
        for (const r of results) {
          const row = w.adsets.find((x) => x.id === r.rowId);
          if (row && r.numbers) Object.assign(row, r.numbers);
        }
      });
      const demo = results.some((r) => r.mode === "demo");
      return {
        text: [
          ...(demo ? ["DEMO results (simulated, not from Meta)."] : []),
          ...results.map((r) =>
            r.numbers
              ? `• ${r.name}: ${inr(r.numbers.spend)} spent · ${r.numbers.impressions.toLocaleString("en-IN")} impr · ${r.numbers.clicks} clicks · ${r.numbers.addToCarts} ATC · ${r.numbers.purchases} orders`
              : `• ${r.name}: could not sync: ${r.error}`,
          ),
          "Next: ad_decisions (or meta_apply_decisions to pause losers and scale winners in Meta).",
        ].join("\n"),
        data: { results },
      };
    },
  }),

  defineTool({
    name: "meta_apply_decisions",
    title: "Pause losers, scale winners in Meta",
    description:
      "Runs the KILL / WAIT / KEEP / SCALE engine (against the product's RTO-adjusted break-even CPA) on launched ad sets and, only with confirm: true, applies it in Meta: pauses KILL ad sets and raises SCALE budgets by 20%. Without confirm it returns the plan only. Always show the plan to the user and get a yes before confirming (it changes real spend).",
    schema: z.object({
      product: ProductRef.optional(),
      confirm: z.boolean().default(false).describe("true = actually pause/scale in Meta"),
    }),
    async run(ctx, { product, confirm }) {
      const ws = (await ctx.read()).workspace;
      const p = product ? findProduct(ws, product) : undefined;
      const m = await getMarketing(ctx.teamId);
      const launches = m.metaLaunches.filter((l) => !p || l.productId === p.id);
      if (!launches.length) throw new Error("Nothing launched yet. Use meta_launch_campaign first.");
      const creds = await metaCreds(ctx);

      type Plan = { launchId: string; metaAdsetId: string; rowId: string; name: string; mode: string; verdict: string; reasons: string[]; from: number; to: number; action: "pause" | "scale" | "none" };
      const plan: Plan[] = [];
      for (const l of launches) {
        const prod = ws.products.find((x) => x.id === l.productId);
        if (!prod) continue;
        const r = econOf(prod, ws.economics);
        for (const a of l.adsets) {
          const row = ws.adsets.find((x) => x.id === a.adsetRowId);
          if (!row || a.error) continue;
          const d = decide(row, adMetrics(row, prod.sellingPrice, r.deliveredRate, r.profitBeforeAds), r.profitBeforeAds);
          const action: Plan["action"] = d.verdict === "KILL" ? "pause" : d.verdict === "SCALE" && d.newBudget ? "scale" : "none";
          const to = action === "scale" ? (d.newBudget ?? a.dailyBudget) : action === "pause" ? 0 : a.dailyBudget;
          plan.push({ launchId: l.id, metaAdsetId: a.metaAdsetId, rowId: row.id, name: a.name, mode: l.mode, verdict: d.verdict, reasons: d.reasons, from: a.dailyBudget, to, action });
        }
      }

      const applied: string[] = [];
      const failed: string[] = [];
      if (confirm) {
        for (const x of plan) {
          if (x.action === "none") continue;
          try {
            if (x.mode === "live") {
              if (!creds) throw new Error("Meta is no longer connected");
              if (x.action === "pause") await updateAdSet(creds, x.metaAdsetId, { status: "PAUSED" });
              else await updateAdSet(creds, x.metaAdsetId, { dailyBudgetInr: x.to });
            }
            applied.push(x.name);
          } catch (e) {
            failed.push(`${x.name}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
        const ok = new Set(applied);
        await mutateMarketing(ctx.teamId, (mm) => {
          for (const l of mm.metaLaunches)
            for (const a of l.adsets) {
              const x = plan.find((y) => y.metaAdsetId === a.metaAdsetId);
              if (!x || !ok.has(x.name)) continue;
              a.lastDecision = x.verdict;
              if (x.action === "pause") a.status = "PAUSED";
              if (x.action === "scale") a.dailyBudget = x.to;
            }
        });
        await ctx.update((w) => {
          for (const x of plan) {
            if (!ok.has(x.name)) continue;
            const row = w.adsets.find((y) => y.id === x.rowId);
            if (row) row.dailyBudget = x.to;
          }
        });
        if (applied.length) await ctx.log(`applied Meta ad decisions: ${plan.filter((x) => ok.has(x.name)).map((x) => `${x.verdict} ${x.name}`).join(", ")}`, "adsets");
      }

      const demo = plan.some((x) => x.mode === "demo");
      return {
        text: [
          ...(demo ? ["DEMO mode: changes are simulated, not sent to Meta."] : []),
          ...plan.map((x) => `${x.verdict.padEnd(5)} ${x.name}: ${x.action === "pause" ? "pause ad set" : x.action === "scale" ? `budget ${inr(x.from)} → ${inr(x.to)}/day` : "no change"} · ${x.reasons.join(" ")}`),
          confirm
            ? `Applied ${applied.length} change(s)${failed.length ? `; failed: ${failed.join("; ")}` : ""}.`
            : "Plan only. Show this to the user; call again with confirm: true to apply it in Meta.",
        ].join("\n"),
        data: { plan, applied, failed, confirmed: confirm },
      };
    },
  }),

  defineTool({
    name: "meta_status",
    title: "Meta ads status",
    description: "Whether the team's Meta ad account is connected, and every campaign/ad set DropOS launched with status, daily budget and results so far.",
    readOnly: true,
    schema: z.object({}),
    async run(ctx) {
      const [ws, m, i] = await Promise.all([ctx.read().then((t) => t.workspace), getMarketing(ctx.teamId), getIntegrations(ctx.teamId)]);
      const launches = m.metaLaunches.map((l) => ({
        campaign: l.campaignName,
        mode: l.mode,
        product: ws.products.find((p) => p.id === l.productId)?.name ?? "?",
        landingUrl: l.landingUrl,
        launchedBy: l.createdBy,
        adsets: l.adsets.map((a) => {
          const row = ws.adsets.find((x) => x.id === a.adsetRowId);
          return { name: a.name, status: a.lastDecision === "KILL" ? "PAUSED (killed)" : a.status, dailyBudget: a.dailyBudget, spend: row?.spend ?? 0, purchases: row?.purchases ?? 0, error: a.error };
        }),
      }));
      return {
        text: [
          i.meta ? `Meta connected: ${i.meta.accountName ?? "ad account"} (${i.meta.currency ?? "INR"})${i.meta.pixelId ? ", pixel set" : ", no pixel (traffic objective)"}.` : "Meta not connected (launches run in DEMO mode). Connect with connect_integration provider \"meta\".",
          launches.length ? "" : "No campaigns launched yet.",
          ...launches.map(
            (l) =>
              `${l.campaign} [${l.mode}] · ${l.product} · by ${l.launchedBy}\n${l.adsets.map((a) => `  • ${a.name}: ${a.status} · ${inr(a.dailyBudget)}/day · ${inr(a.spend)} spent · ${a.purchases} orders${a.error ? ` · error: ${a.error}` : ""}`).join("\n")}`,
          ),
        ]
          .filter(Boolean)
          .join("\n"),
        data: { connected: Boolean(i.meta), launches },
      };
    },
  }),

  // ---------------- Outbound to customers & leads
  defineTool({
    name: "add_contacts",
    title: "Add leads / customers to outreach list",
    description:
      "Save potential customers (Instagram DMs, college fairs, store visitors...) to the team's outreach list. Only contacts with optedIn: true (they agreed to hear from you) ever receive marketing messages; opted-out contacts are never messaged. Dedupes by phone/email.",
    schema: z.object({
      contacts: z
        .array(
          z.object({
            name: z.string().min(1),
            phone: z.string().optional(),
            email: z.string().email().optional(),
            city: z.string().optional(),
            source: z.string().optional().describe("e.g. instagram-dm, college-fair, store-visitor"),
            optedIn: z.boolean().describe("true only if this person agreed to receive messages from the store"),
            tags: z.array(z.string()).optional(),
          }),
        )
        .min(1)
        .max(500),
    }),
    async run(ctx, { contacts }) {
      const res = await mutateMarketing(ctx.teamId, (m) => {
        let added = 0;
        let updated = 0;
        const invalid: string[] = [];
        for (const c of contacts) {
          const phone = c.phone ? normalizeIndianMobile(c.phone) : undefined;
          if (c.phone && !isIndianMobile(phone!)) invalid.push(`${c.name} (${c.phone})`);
          const validPhone = phone && isIndianMobile(phone) ? phone : undefined;
          const email = c.email?.trim().toLowerCase();
          if (!validPhone && !email) continue;
          const ex = m.contacts.find((x) => (validPhone && x.phone === validPhone) || (email && x.email === email));
          if (ex) {
            ex.tags = [...new Set([...ex.tags, ...(c.tags ?? [])])];
            ex.optedIn = ex.optedOut ? false : ex.optedIn || c.optedIn;
            ex.phone ??= validPhone;
            ex.email ??= email;
            updated++;
          } else {
            m.contacts.push({ id: rid("ct"), name: c.name.trim(), phone: validPhone, email, city: c.city, source: c.source, tags: c.tags ?? [], optedIn: c.optedIn, createdAt: Date.now() });
            added++;
          }
        }
        return { added, updated, invalid, total: m.contacts.length, optedIn: m.contacts.filter((x) => x.optedIn && !x.optedOut).length };
      });
      await ctx.log(`added ${res.added} contact(s) to the outreach list`, "team");
      return {
        text: `Added ${res.added}, updated ${res.updated}. List: ${res.total} contacts, ${res.optedIn} opted in.${res.invalid.length ? ` Skipped invalid phones: ${res.invalid.join(", ")}.` : ""}`,
        data: res,
      };
    },
  }),

  defineTool({
    name: "import_customers_as_contacts",
    title: "Turn customers into an outreach list",
    description:
      "Adds the team's customers (from orders) to the outreach list tagged 'customer' for repeat-purchase or referral campaigns. They are NOT opted in by default; pass optedIn: true only if customers agreed at checkout to receive offers.",
    schema: z.object({
      onlyDelivered: z.boolean().default(true).describe("Only customers whose order was delivered"),
      optedIn: z.boolean().default(false),
    }),
    async run(ctx, { onlyDelivered, optedIn }) {
      const ws = (await ctx.read()).workspace;
      const orders = ws.orders.filter((o) => (onlyDelivered ? o.status === "delivered" : o.status !== "cancelled"));
      const res = await mutateMarketing(ctx.teamId, (m) => {
        let added = 0;
        for (const o of orders) {
          const phone = normalizeIndianMobile(o.phone);
          if (!isIndianMobile(phone)) continue;
          const tags = ["customer", ...(o.id.startsWith("#D") ? ["demo"] : [])];
          const ex = m.contacts.find((x) => x.phone === phone);
          if (ex) {
            ex.tags = [...new Set([...ex.tags, ...tags])];
            if (optedIn && !ex.optedOut) ex.optedIn = true;
            continue;
          }
          m.contacts.push({ id: rid("ct"), name: o.customerName, phone, email: o.email, city: o.city, source: `order ${o.id}`, tags, optedIn, createdAt: Date.now() });
          added++;
        }
        return { added, total: m.contacts.length };
      });
      await ctx.log(`imported ${res.added} customer(s) into the outreach list`, "team");
      return {
        text: `Imported ${res.added} customer(s) from ${orders.length} ${onlyDelivered ? "delivered " : ""}orders (opted in: ${optedIn ? "yes" : "no"}). Outreach list now has ${res.total} contacts.${optedIn ? "" : " They won't receive campaigns until opted in."}`,
        data: res,
      };
    },
  }),

  defineTool({
    name: "create_outbound_campaign",
    title: "Draft a WhatsApp / email campaign",
    description:
      "Drafts an outbound campaign to the team's opted-in leads and/or customers. You write the message; use {{name}} and {{store}} placeholders. An opt-out line is added automatically. For WhatsApp, business-initiated marketing needs a Meta-approved template (whatsappTemplateName); free text only reaches people who messaged you in the last 24h. Returns a preview and recipient count; nothing is sent until send_outbound_campaign with confirm: true.",
    schema: z.object({
      name: z.string().min(1),
      channel: z.enum(["whatsapp", "email"]),
      audience: z
        .object({ segment: z.enum(["leads", "customers", "all"]).default("all"), tags: z.array(z.string()).optional() })
        .default({ segment: "all" }),
      message: z.string().min(5).describe("Message body with {{name}} / {{store}} placeholders"),
      subject: z.string().optional().describe("Email subject"),
      whatsappTemplateName: z.string().optional().describe("Meta-approved template name for business-initiated WhatsApp"),
    }),
    async run(ctx, { name, channel, audience, message, subject, whatsappTemplateName }) {
      const t = await ctx.read();
      const store = t.team.storeName || t.workspace.teamName;
      const res = await mutateMarketing(ctx.teamId, (m) => {
        const recipients = audienceOf(m.contacts, channel, audience);
        const camp: OutboundCampaign = {
          id: rid("oc"),
          name,
          channel,
          audience,
          message: withOptOutLine(channel, message),
          subject: channel === "email" ? (subject ?? `${store}: ${name}`) : undefined,
          whatsappTemplateName,
          status: "draft",
          createdAt: Date.now(),
          createdBy: ctx.memberName,
          recipients: [],
        };
        m.campaigns.unshift(camp);
        const excluded = m.contacts.length - recipients.length;
        return { camp, count: recipients.length, preview: recipients.slice(0, 3).map((c) => ({ to: c.name, text: render(camp.message, c, store) })), excluded };
      });
      return {
        text: [
          `Draft "${name}" (${channel}) · ${res.count} recipient(s) · id ${res.camp.id}${res.excluded ? ` · ${res.excluded} contact(s) excluded (not opted in, opted out, or no ${channel === "whatsapp" ? "phone" : "email"})` : ""}`,
          ...res.preview.map((p) => `— to ${p.to}:\n${p.text}`),
          res.count ? "Confirm with the user, then send_outbound_campaign with confirm: true." : "No eligible recipients yet: add opted-in contacts with add_contacts.",
        ].join("\n"),
        data: { campaignId: res.camp.id, recipients: res.count, preview: res.preview },
      };
    },
  }),

  defineTool({
    name: "send_outbound_campaign",
    title: "Send a WhatsApp / email campaign",
    description:
      "Sends a drafted campaign to its opted-in audience via the team's WhatsApp Cloud API (template if set) or Resend email. Requires confirm: true (get the user's explicit go-ahead first). Without connected credentials each message is queued with a one-click wa.me / mailto link. Contacts tagged demo are never messaged for real.",
    schema: z.object({ campaignId: z.string().min(1), confirm: z.boolean().default(false) }),
    async run(ctx, { campaignId, confirm }) {
      if (!confirm) throw new Error("Not sent. Show the draft to the user and call again with confirm: true once they approve.");
      const t = await ctx.read();
      const store = t.team.storeName || t.workspace.teamName;
      const integ = await getIntegrations(ctx.teamId);
      const m0 = await getMarketing(ctx.teamId);
      const camp = m0.campaigns.find((c) => c.id === campaignId);
      if (!camp) throw new Error(`No campaign ${campaignId}. Campaigns: ${m0.campaigns.map((c) => `${c.name} (${c.id})`).join(", ") || "none"}`);
      if (camp.status === "sent") throw new Error(`Campaign "${camp.name}" was already sent. Draft a new one to send again.`);
      const recipients = audienceOf(m0.contacts, camp.channel, camp.audience);
      const out: OutboundRecipient[] = [];
      for (const c of recipients) {
        const text = render(camp.message, c, store);
        const demo = c.tags.includes("demo");
        const at = Date.now();
        if (camp.channel === "whatsapp") {
          const to = `91${c.phone}`;
          if (!integ.whatsapp || demo) {
            out.push({ contactId: c.id, name: c.name, to, status: "queued", message: text, link: waLink(demo ? undefined : c.phone, text), at });
            continue;
          }
          try {
            await sendWhatsApp(integ.whatsapp, to, camp.whatsappTemplateName ? { template: camp.whatsappTemplateName, bodyParams: [firstName(c.name)] } : { text });
            out.push({ contactId: c.id, name: c.name, to, status: "sent", message: text, at });
          } catch (e) {
            out.push({ contactId: c.id, name: c.name, to, status: "failed", message: text, error: e instanceof Error ? e.message : String(e), at });
          }
        } else {
          const to = c.email!;
          const subject = camp.subject ?? camp.name;
          if (!integ.email || demo) {
            out.push({ contactId: c.id, name: c.name, to, status: "queued", message: text, link: mailto(to, subject, text), at });
            continue;
          }
          try {
            await sendResendEmail(integ.email, to, subject, text);
            out.push({ contactId: c.id, name: c.name, to, status: "sent", message: text, at });
          } catch (e) {
            out.push({ contactId: c.id, name: c.name, to, status: "failed", message: text, error: e instanceof Error ? e.message : String(e), at });
          }
        }
      }
      await mutateMarketing(ctx.teamId, (m) => {
        const c = m.campaigns.find((x) => x.id === campaignId);
        if (c) Object.assign(c, { status: "sent", sentAt: Date.now(), recipients: out });
      });
      const count = (s: OutboundRecipient["status"]) => out.filter((r) => r.status === s).length;
      await ctx.log(`sent campaign "${camp.name}" to ${out.length} contact(s) (${count("sent")} sent, ${count("queued")} queued)`, "team");
      return {
        text: [
          `"${camp.name}" (${camp.channel}): ${count("sent")} sent, ${count("queued")} queued, ${count("failed")} failed.`,
          count("queued") ? `Queued because ${camp.channel === "whatsapp" ? "WhatsApp Cloud API" : "email (Resend)"} isn't connected (or demo contacts): one-click links are in data.` : "",
          ...out.filter((r) => r.status === "failed").map((r) => `failed ${r.name}: ${r.error}`),
        ]
          .filter(Boolean)
          .join("\n"),
        data: { campaignId, recipients: out.map(withoutMessage) },
      };
    },
  }),

  defineTool({
    name: "outbound_report",
    title: "Outbound campaign report",
    description: "Sent / queued / failed counts per outbound campaign, plus the size of the outreach list (opted in vs opted out). Pass campaignId for per-recipient detail.",
    readOnly: true,
    schema: z.object({ campaignId: z.string().optional() }),
    async run(ctx, { campaignId }) {
      const m = await getMarketing(ctx.teamId);
      const list = m.campaigns.filter((c) => !campaignId || c.id === campaignId);
      const rows = list.map((c) => ({
        id: c.id,
        name: c.name,
        channel: c.channel,
        status: c.status,
        by: c.createdBy,
        sent: c.recipients.filter((r) => r.status === "sent").length,
        queued: c.recipients.filter((r) => r.status === "queued").length,
        failed: c.recipients.filter((r) => r.status === "failed").length,
      }));
      const optedIn = m.contacts.filter((c) => c.optedIn && !c.optedOut).length;
      const optedOut = m.contacts.filter((c) => c.optedOut).length;
      return {
        text: [
          `Outreach list: ${m.contacts.length} contacts · ${optedIn} opted in · ${optedOut} opted out.`,
          rows.length ? "" : "No campaigns yet.",
          ...rows.map((r) => `• ${r.name} [${r.channel}, ${r.status}, by ${r.by}]: ${r.sent} sent · ${r.queued} queued · ${r.failed} failed (${r.id})`),
        ]
          .filter(Boolean)
          .join("\n"),
        data: { contacts: { total: m.contacts.length, optedIn, optedOut }, campaigns: rows, detail: campaignId ? list[0]?.recipients.map(withoutMessage) : undefined },
      };
    },
  }),

  defineTool({
    name: "opt_out_contact",
    title: "Opt a contact out",
    description: "Use when someone replies STOP / unsubscribe: they will never receive another campaign from this team.",
    schema: z.object({ phoneOrEmail: z.string().min(3) }),
    async run(ctx, { phoneOrEmail }) {
      const key = phoneOrEmail.includes("@") ? phoneOrEmail.trim().toLowerCase() : normalizeIndianMobile(phoneOrEmail);
      const name = await mutateMarketing(ctx.teamId, (m) => {
        const c = m.contacts.find((x) => x.phone === key || x.email === key);
        if (!c) throw new Error(`No contact with ${phoneOrEmail}`);
        c.optedOut = true;
        c.optedIn = false;
        return c.name;
      });
      await ctx.log(`opted out ${name} from marketing messages`, "team");
      return { text: `${name} is opted out and won't receive any more campaigns.` };
    },
  }),
];
