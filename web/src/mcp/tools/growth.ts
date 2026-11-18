import * as z from "zod/v4";
import { defineTool, type ToolDef } from "../types";
import { unitEconomics, inr, pct } from "@/lib/economics";
import { compositeScore } from "@/lib/products-demo";
import { computeLanded, outreachTemplate, parseQuoteText, scoreQuote } from "@/lib/suppliers-demo";
import { adMetrics, decide, fallbackPlan } from "@/lib/ads";
import { rid } from "@/lib/team-store";
import type { SharedWorkspace } from "@/lib/merge";
import type { AdSetRow, Creative, EconomicsSettings, Product, ProductStatus, Quote, Supplier } from "@/lib/types";

// ---------------------------------------------------------------- helpers

const ESTIMATED_TAG = "landed-cost-estimated";
const STATUSES = ["idea", "shortlisted", "sourcing", "live", "dropped"] as const satisfies readonly ProductStatus[];

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
const findSupplier = (ws: SharedWorkspace, ref: string) => findIn(ws.suppliers, ref, "supplier");
const findAdset = (ws: SharedWorkspace, ref: string) => findIn(ws.adsets, ref, "ad set");

const econOf = (p: Product, s: EconomicsSettings) =>
  unitEconomics({ sellingPrice: p.sellingPrice, productCost: p.sourcingCost, shippingFwd: p.shippingCost }, s);

/** Profit per order placed is linear in price: solve for the price where it hits `target`. */
function priceFor(p: Product, s: EconomicsSettings, target = 0): number | null {
  const at = (price: number) => econOf({ ...p, sellingPrice: price }, s).profitPerOrder;
  const a = at(0);
  const b = at(1000);
  const slope = (b - a) / 1000;
  if (slope <= 0) return null;
  return Math.ceil((target - a) / slope);
}

function verdictFor(p: Product, s: EconomicsSettings) {
  const r = econOf(p, s);
  const estimated = p.tags?.includes(ESTIMATED_TAG);
  const cushion = Math.max(50, p.sellingPrice * 0.08);
  let verdict: "GO" | "FIX PRICING" | "DROP";
  let reason: string;
  if (r.profitBeforeAds <= 0) {
    verdict = "DROP";
    reason = `Loses ${inr(-r.profitBeforeAds)}/order even before ads once RTO is counted.`;
  } else if (r.profitPerOrder < 0) {
    const need = priceFor(p, s, cushion);
    verdict = "FIX PRICING";
    reason = `Loses ${inr(-r.profitPerOrder)}/order at ${inr(s.cpa)} CPA${need ? `; price ≥ ${inr(need)} for a ${inr(cushion)} cushion` : ""}.`;
  } else if (r.profitPerOrder < cushion) {
    const need = priceFor(p, s, cushion);
    verdict = "FIX PRICING";
    reason = `Thin: ${inr(r.profitPerOrder)}/order; a small RTO or CPA spike wipes it${need ? `. Try ${inr(need)}+` : ""}.`;
  } else {
    verdict = "GO";
    reason = `${inr(r.profitPerOrder)}/order after RTO + ads; survives COD RTO up to ${r.maxRtoCod == null ? "—" : pct(r.maxRtoCod)}.`;
  }
  if (estimated) reason += " (Landed cost is an estimate: get a supplier quote.)";
  return { r, verdict, reason, estimated };
}

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
const padL = (s: string, n: number) => s.padStart(n);

function economicsRow(p: Product, s: EconomicsSettings) {
  const { r, verdict, reason, estimated } = verdictFor(p, s);
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    sellingPrice: p.sellingPrice,
    landedCost: p.sourcingCost,
    landedCostEstimated: Boolean(estimated),
    shipping: p.shippingCost,
    naiveMarginPct: Math.round(r.naiveMarginPct * 100),
    realProfitPerOrderPlaced: Math.round(r.profitPerOrder),
    breakEvenCpa: Math.round(r.profitBeforeAds),
    maxCodRtoPct: r.maxRtoCod == null ? null : Math.round(r.maxRtoCod * 100),
    breakEvenRoas: Number.isFinite(r.roasBreakEven) ? r.roasBreakEven : null,
    score: compositeScore(p.scores),
    verdict,
    reason,
  };
}

const ProductRef = z.string().min(1).describe("Product id or name (case-insensitive)");
const SupplierRef = z.string().min(1).describe("Supplier id or name (case-insensitive)");

// ---------------------------------------------------------------- tools

export const growthTools: ToolDef[] = [
  defineTool({
    name: "add_products",
    title: "Add the team's candidate products",
    description:
      "Add 1-10 products the team is considering (skip duplicates by name). Give selling price and landed cost (supplier price incl. GST) if known; otherwise cost is estimated at 30% of price and flagged. Returns naive margin vs real profit per order placed (after COD RTO, reverse shipping, COD fees and ad CPA) and break-even CPA for each.",
    schema: z.object({
      products: z
        .array(
          z.object({
            name: z.string().min(2),
            sellingPrice: z.number().positive().describe("Store price in INR"),
            landedCost: z.number().positive().optional().describe("Supplier price incl. GST, INR per unit"),
            shippingCost: z.number().min(0).default(65).describe("Forward shipping per order, INR"),
            category: z.string().optional(),
            description: z.string().optional(),
            targetAudience: z.string().optional(),
            whyItSells: z.string().optional(),
            imageUrl: z.string().url().optional(),
            compareAtPrice: z.number().positive().optional().describe("MRP shown struck-through"),
            variants: z.array(z.string()).optional(),
          }),
        )
        .min(1)
        .max(10),
    }),
    async run(ctx, { products }) {
      const { added, skipped, econ } = await ctx.update((ws) => {
        const added: Product[] = [];
        const skipped: string[] = [];
        for (const p of products) {
          if (ws.products.some((x) => norm(x.name) === norm(p.name)) || added.some((x) => norm(x.name) === norm(p.name))) {
            skipped.push(p.name);
            continue;
          }
          const estimated = p.landedCost == null;
          added.push({
            id: rid("prd"),
            name: p.name.trim(),
            category: p.category?.trim() || "General",
            why: p.whyItSells ?? "",
            targetAudience: p.targetAudience ?? "",
            description: p.description,
            sourcingCost: p.landedCost ?? Math.round(p.sellingPrice * 0.3),
            sellingPrice: p.sellingPrice,
            shippingCost: p.shippingCost,
            compareAtPrice: p.compareAtPrice,
            images: p.imageUrl ? [p.imageUrl] : [],
            variants: p.variants ?? [],
            tags: estimated ? [ESTIMATED_TAG] : [],
            scores: { demand: 5, margin: 5, rtoRisk: 5, competition: 5, wow: 5 },
            risks: [],
            indiamartQuery: p.name.trim().toLowerCase(),
            status: "idea",
            createdAt: Date.now(),
          });
        }
        ws.products.push(...added);
        return { added, skipped, econ: ws.economics };
      });
      const rows = added.map((p) => economicsRow(p, econ));
      const lines = rows.map(
        (r) =>
          `• ${r.name}: ${inr(r.sellingPrice)} price, ${inr(r.landedCost)}${r.landedCostEstimated ? " (est.)" : ""} cost → naive ${r.naiveMarginPct}% margin, real ${inr(r.realProfitPerOrderPlaced)}/order placed, break-even CPA ${inr(r.breakEvenCpa)} [${r.verdict}]`,
      );
      return {
        text: [`Added ${added.length} product(s)${skipped.length ? `, skipped duplicates: ${skipped.join(", ")}` : ""}.`, ...lines].join("\n"),
        data: { added: rows, skipped },
      };
    },
  }),

  defineTool({
    name: "update_product",
    title: "Update a product",
    description: "Edit any product field (price, landed cost, shipping, status, scores, copy fields, images, variants). Returns the product's new unit economics.",
    schema: z.object({
      product: ProductRef,
      name: z.string().min(2).optional(),
      sellingPrice: z.number().positive().optional(),
      landedCost: z.number().positive().optional().describe("Supplier price incl. GST; clears the 'estimated' flag"),
      shippingCost: z.number().min(0).optional(),
      compareAtPrice: z.number().positive().optional(),
      status: z.enum(STATUSES).optional(),
      category: z.string().optional(),
      description: z.string().optional(),
      targetAudience: z.string().optional(),
      whyItSells: z.string().optional(),
      imageUrls: z.array(z.string().url()).optional(),
      variants: z.array(z.string()).optional(),
      risks: z.array(z.string()).optional(),
      indiamartQuery: z.string().optional(),
      scores: z
        .object({
          demand: z.number().min(0).max(10).optional(),
          margin: z.number().min(0).max(10).optional(),
          rtoRisk: z.number().min(0).max(10).optional().describe("Higher = riskier"),
          competition: z.number().min(0).max(10).optional().describe("Higher = more saturated"),
          wow: z.number().min(0).max(10).optional(),
        })
        .optional(),
    }),
    async run(ctx, a) {
      const { p, econ } = await ctx.update((ws) => {
        const p = findProduct(ws, a.product);
        if (a.name) p.name = a.name.trim();
        if (a.sellingPrice != null) p.sellingPrice = a.sellingPrice;
        if (a.landedCost != null) {
          p.sourcingCost = a.landedCost;
          p.tags = (p.tags ?? []).filter((t) => t !== ESTIMATED_TAG);
        }
        if (a.shippingCost != null) p.shippingCost = a.shippingCost;
        if (a.compareAtPrice != null) p.compareAtPrice = a.compareAtPrice;
        if (a.status) p.status = a.status;
        if (a.category) p.category = a.category;
        if (a.description != null) p.description = a.description;
        if (a.targetAudience != null) p.targetAudience = a.targetAudience;
        if (a.whyItSells != null) p.why = a.whyItSells;
        if (a.imageUrls) p.images = a.imageUrls;
        if (a.variants) p.variants = a.variants;
        if (a.risks) p.risks = a.risks;
        if (a.indiamartQuery) p.indiamartQuery = a.indiamartQuery;
        if (a.scores) p.scores = { ...p.scores, ...Object.fromEntries(Object.entries(a.scores).filter(([, v]) => v != null)) };
        return { p: structuredClone(p), econ: ws.economics };
      });
      const row = economicsRow(p, econ);
      return {
        text: `Updated ${p.name}: ${inr(p.sellingPrice)} price, ${inr(p.sourcingCost)} landed → real ${inr(row.realProfitPerOrderPlaced)}/order placed, break-even CPA ${inr(row.breakEvenCpa)} [${row.verdict}].`,
        data: row,
      };
    },
  }),

  defineTool({
    name: "remove_product",
    title: "Remove a product",
    description: "Delete a product the team has dropped. (To keep it for the record, use update_product with status 'dropped' instead.)",
    schema: z.object({ product: ProductRef }),
    async run(ctx, { product }) {
      const name = await ctx.update((ws) => {
        const p = findProduct(ws, product);
        ws.products = ws.products.filter((x) => x.id !== p.id);
        return p.name;
      });
      return { text: `Removed ${name}.` };
    },
  }),

  defineTool({
    name: "analyze_products",
    title: "Rank products by real RTO-adjusted profit",
    description:
      "The core product decision. For each product: naive margin (what beginners compute) vs real profit per order PLACED after COD RTO, reverse shipping, COD/gateway fees, packaging and ad CPA; break-even CPA; the COD RTO rate at which it starts losing money; break-even ROAS; and a verdict GO / FIX PRICING / DROP with the reason and the price needed. Ranked best first.",
    readOnly: true,
    schema: z.object({ products: z.array(z.string()).optional().describe("Product ids or names; default = all") }),
    async run(ctx, { products }) {
      const ws = (await ctx.read()).workspace;
      if (!ws.products.length) throw new Error("The team has no products yet. Use add_products first.");
      const list = products?.length ? products.map((r) => findProduct(ws, r)) : ws.products;
      const rows = list.map((p) => economicsRow(p, ws.economics)).sort((a, b) => b.realProfitPerOrderPlaced - a.realProfitPerOrderPlaced || b.score - a.score);
      const s = ws.economics;
      const head = `${pad("Product", 26)} ${padL("Price", 7)} ${padL("Cost", 7)} ${padL("Naive", 6)} ${padL("Real/ord", 9)} ${padL("BE-CPA", 7)} ${padL("MaxRTO", 7)}  Verdict`;
      const lines = rows.map(
        (r) =>
          `${pad(r.name, 26)} ${padL(inr(r.sellingPrice), 7)} ${padL(inr(r.landedCost) + (r.landedCostEstimated ? "*" : ""), 7)} ${padL(r.naiveMarginPct + "%", 6)} ${padL(inr(r.realProfitPerOrderPlaced), 9)} ${padL(inr(r.breakEvenCpa), 7)} ${padL(r.maxCodRtoPct == null ? "—" : r.maxCodRtoPct + "%", 7)}  ${r.verdict}`,
      );
      const reasons = rows.map((r) => `• ${r.name}: ${r.verdict}. ${r.reason}`);
      return {
        text: [
          `Assumptions: ${pct(s.codShare)} COD, ${pct(s.rtoCod)} COD RTO, ${pct(s.rtoPrepaid)} prepaid RTO, CPA ${inr(s.cpa)}, reverse ship ${inr(s.rtoShipping)} (change with set_economics_assumptions).`,
          "```",
          head,
          ...lines,
          "```",
          rows.some((r) => r.landedCostEstimated) ? "* landed cost estimated at 30% of price: confirm with a supplier quote." : "",
          ...reasons,
        ]
          .filter(Boolean)
          .join("\n"),
        data: { assumptions: s, ranking: rows },
      };
    },
  }),

  defineTool({
    name: "set_economics_assumptions",
    title: "Set COD / RTO / CPA assumptions",
    description:
      "Update the team's unit-economics assumptions (shares and rates as fractions 0-1, money in INR). Returns before/after values and how profit per order changed for every product.",
    schema: z.object({
      codShare: z.number().min(0).max(1).optional().describe("Fraction of orders paid by COD, e.g. 0.7"),
      rtoCod: z.number().min(0).max(1).optional().describe("Fraction of COD orders returned, e.g. 0.3"),
      rtoPrepaid: z.number().min(0).max(1).optional().describe("Fraction of prepaid orders returned, e.g. 0.04"),
      cpa: z.number().min(0).optional().describe("Meta ad spend per order placed, INR"),
      codFeePct: z.number().min(0).max(20).optional().describe("Courier COD fee, % of order value"),
      gatewayPct: z.number().min(0).max(20).optional().describe("Payment gateway fee on prepaid, %"),
      rtoShipping: z.number().min(0).optional().describe("Reverse shipping per RTO, INR"),
      rtoProductLossPct: z.number().min(0).max(1).optional().describe("Fraction of RTO units damaged/unsellable"),
      packaging: z.number().min(0).optional().describe("Packaging per order, INR"),
    }),
    async run(ctx, patch) {
      const { before, after, products } = await ctx.update((ws) => {
        const before = { ...ws.economics };
        ws.economics = { ...ws.economics, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)) };
        return { before, after: { ...ws.economics }, products: structuredClone(ws.products) };
      });
      const changes = products.map((p) => {
        const b = econOf(p, before).profitPerOrder;
        const a = econOf(p, after).profitPerOrder;
        return { name: p.name, before: Math.round(b), after: Math.round(a), delta: Math.round(a - b) };
      });
      const changedKeys = (Object.keys(after) as (keyof EconomicsSettings)[]).filter((k) => before[k] !== after[k]);
      return {
        text: [
          changedKeys.length ? `Changed: ${changedKeys.map((k) => `${k} ${before[k]} → ${after[k]}`).join(", ")}.` : "No change.",
          ...changes.map((c) => `• ${c.name}: ${inr(c.before)} → ${inr(c.after)} per order placed (${c.delta >= 0 ? "+" : ""}${inr(c.delta)})`),
        ].join("\n"),
        data: { before, after, products: changes },
      };
    },
  }),

  defineTool({
    name: "record_supplier",
    title: "Save a supplier lead",
    description:
      "Save a supplier the team found (IndiaMART, Meesho supplier, local wholesaler) against a product, at stage 'found'. Updates the existing entry if the same supplier is already saved for that product.",
    schema: z.object({
      product: ProductRef,
      name: z.string().min(2).describe("Supplier / company name"),
      city: z.string().optional(),
      url: z.string().url().optional().describe("IndiaMART listing or website"),
      phone: z.string().optional().describe("WhatsApp number if known"),
      priceRange: z.string().optional().describe('e.g. "₹120-160 / piece"'),
      moq: z.string().optional().describe('e.g. "10 pieces"'),
      gstVerified: z.boolean().optional(),
      trustSeal: z.boolean().optional().describe("IndiaMART TrustSEAL"),
      yearsInBusiness: z.number().int().min(0).optional(),
      rating: z.number().min(0).max(5).optional(),
      notes: z.string().optional(),
    }),
    async run(ctx, a) {
      const { s, created, productName } = await ctx.update((ws) => {
        const p = findProduct(ws, a.product);
        let s = ws.suppliers.find((x) => x.productId === p.id && norm(x.name) === norm(a.name));
        const created = !s;
        if (!s) {
          s = { id: rid("sup"), productId: p.id, name: a.name.trim(), city: a.city ?? "", source: "indiamart-live", stage: "found" } as Supplier;
          ws.suppliers.push(s);
        }
        Object.assign(s, {
          ...(a.city != null && { city: a.city }),
          ...(a.url != null && { url: a.url }),
          ...(a.phone != null && { phone: a.phone }),
          ...(a.priceRange != null && { priceRange: a.priceRange }),
          ...(a.moq != null && { moq: a.moq }),
          ...(a.gstVerified != null && { gstVerified: a.gstVerified }),
          ...(a.trustSeal != null && { trustSeal: a.trustSeal }),
          ...(a.yearsInBusiness != null && { yearsInBusiness: a.yearsInBusiness }),
          ...(a.rating != null && { rating: a.rating }),
          ...(a.notes != null && { notes: a.notes }),
        });
        return { s: structuredClone(s), created, productName: p.name };
      });
      return {
        text: `${created ? "Saved" : "Updated"} supplier ${s.name}${s.city ? ` (${s.city})` : ""} for ${productName} at stage "${s.stage}". Next: supplier_outreach_message to ask for dropship/COD/blind-shipping rates.`,
        data: s,
      };
    },
  }),

  defineTool({
    name: "supplier_outreach_message",
    title: "First message to a supplier",
    description:
      "Ready-to-send first message to a supplier (WhatsApp in Hinglish, or English email / IndiaMART enquiry) asking per-unit rates at 10/50/100 pcs, GST, direct dropship to customers, blind packing, COD, dispatch time, samples and RTO/damage policy. Returns a wa.me link when the supplier's number is saved, and moves the supplier to 'contacted'. You can tailor the text before the team sends it.",
    schema: z.object({
      supplier: SupplierRef,
      channel: z.enum(["whatsapp", "email", "indiamart"]).default("whatsapp"),
    }),
    async run(ctx, { supplier, channel }) {
      const out = await ctx.update((ws) => {
        const s = findSupplier(ws, supplier);
        const p = ws.products.find((x) => x.id === s.productId);
        if (!p) throw new Error(`Supplier ${s.name} is not linked to an existing product.`);
        const message = outreachTemplate({ product: p, supplier: s, channel, teamName: ws.teamName });
        s.outreach = { channel, message, sentAt: Date.now() };
        if (s.stage === "found") s.stage = "contacted";
        const digits = (s.phone ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
        const waLink = channel === "whatsapp" && /^\d{10}$/.test(digits) ? `https://wa.me/91${digits}?text=${encodeURIComponent(message)}` : undefined;
        return { name: s.name, stage: s.stage, message, waLink };
      });
      return {
        text: `${channel === "whatsapp" ? "WhatsApp" : channel === "email" ? "Email" : "IndiaMART enquiry"} for ${out.name} (now "${out.stage}"):\n\n${out.message}${out.waLink ? `\n\nSend: ${out.waLink}` : ""}`,
        data: out,
      };
    },
  }),

  defineTool({
    name: "record_quote",
    title: "Log a supplier's quote (paste their reply)",
    description:
      "Paste the supplier's raw WhatsApp/email reply (Hinglish fine, e.g. 'rate 180 + 18% gst, moq 20 pcs, dispatch 2 din me, cod nahi, shipping 60 extra, blind ship kar denge'). It is parsed into unit price, GST, MOQ, shipping, dispatch days, dropship/COD/blind-shipping, sample price; explicit fields override the parse. Computes landed cost, moves the supplier to 'quoted', and lists what the supplier did NOT answer so you can follow up.",
    schema: z.object({
      supplier: SupplierRef,
      rawReply: z.string().optional().describe("The supplier's reply, pasted as-is"),
      unitPrice: z.number().positive().optional().describe("INR per unit, excl. GST"),
      moq: z.number().int().positive().optional(),
      gstPercent: z.number().min(0).max(28).optional(),
      shippingPerUnit: z.number().min(0).optional().describe("INR the supplier charges to ship to the customer"),
      dispatchDays: z.number().min(0).optional(),
      dropshipSupported: z.boolean().optional(),
      codSupported: z.boolean().optional(),
      blindShipping: z.boolean().optional(),
      samplePrice: z.number().min(0).optional(),
      returnPolicy: z.string().optional(),
    }),
    async run(ctx, a) {
      if (!a.rawReply && a.unitPrice == null) throw new Error("Give the supplier's rawReply or at least unitPrice.");
      const raw = a.rawReply ?? "";
      const t = raw.toLowerCase();
      const parsed: Quote = raw
        ? parseQuoteText(raw)
        : {
            unitPrice: 0,
            moq: 1,
            gstPercent: 0,
            shippingPerUnit: 0,
            dispatchDays: 3,
            dropshipSupported: false,
            codSupported: false,
            blindShipping: false,
            returnPolicy: "Not mentioned — ask before finalising",
            notes: "Entered manually.",
            landedCost: 0,
          };
      const overrides = Object.fromEntries(
        (["unitPrice", "moq", "gstPercent", "shippingPerUnit", "dispatchDays", "dropshipSupported", "codSupported", "blindShipping", "samplePrice", "returnPolicy"] as const)
          .filter((k) => a[k] != null)
          .map((k) => [k, a[k]]),
      );
      // The shared parser misses phrasings like "gst extra 12%" / "12% tax"; catch them here.
      if (raw && a.gstPercent == null) {
        const g = t.match(/gst[^\d%\n]{0,15}(\d{1,2}(?:\.\d)?)\s*%/) ?? t.match(/(\d{1,2}(?:\.\d)?)\s*%\s*(?:gst|tax)/);
        if (g) parsed.gstPercent = Number(g[1]);
      }
      const q: Quote = { ...parsed, ...overrides };
      q.landedCost = computeLanded(q);

      const missing: string[] = [];
      const has = (k: string) => k in overrides;
      if (!q.unitPrice) missing.push("unit price");
      if (!has("gstPercent") && !/gst/.test(t)) missing.push("GST (extra or included? GST bill?)");
      if (!has("moq") && !/moq|minimum|min\s*order/.test(t)) missing.push("MOQ");
      if (!has("dispatchDays") && !/dispatch|ship|bhej|din|days/.test(t)) missing.push("dispatch time (assumed 3 days)");
      if (!has("dropshipSupported") && !/drop\s*-?\s*ship|direct|customer|blind/.test(t)) missing.push("whether they dropship directly to customers");
      if (!has("codSupported") && !/\bcod\b|cash on delivery/.test(t)) missing.push("COD support");
      if (!has("blindShipping") && !/blind|white\s*-?\s*label|unbranded|bina naam/.test(t)) missing.push("blind / white-label packing");
      if (!has("shippingPerUnit") && !/shipping|delivery|courier|freight/.test(t)) missing.push("shipping charge per parcel");
      if (!has("returnPolicy") && !/return|damage|replace/.test(t)) missing.push("damage / RTO return policy");

      const out = await ctx.update((ws) => {
        const s = findSupplier(ws, a.supplier);
        s.quote = q;
        if (raw) s.rawReply = raw;
        if (s.stage === "found" || s.stage === "contacted") s.stage = "quoted";
        return { name: s.name, stage: s.stage };
      });
      const yn = (b: boolean) => (b ? "yes" : "no");
      return {
        text: [
          `Quote saved for ${out.name} (stage "${out.stage}"): ${inr(q.unitPrice)}/unit + ${q.gstPercent}% GST + ${q.shippingPerUnit ? `${inr(q.shippingPerUnit)} shipping` : "shipping not quoted"} = ${inr(q.landedCost)} landed · MOQ ${q.moq} · dispatch ${q.dispatchDays}d · dropship ${yn(q.dropshipSupported)} · COD ${yn(q.codSupported)} · blind ${yn(q.blindShipping)}${q.samplePrice ? ` · sample ${inr(q.samplePrice)}` : ""}.`,
          missing.length ? `Not answered yet (ask the supplier): ${missing.join("; ")}.` : "All key questions answered.",
          "Next: compare_quotes for this product.",
        ].join("\n"),
        data: { quote: q, notAnswered: missing },
      };
    },
  }),

  defineTool({
    name: "compare_quotes",
    title: "Compare supplier quotes",
    description:
      "Rank every quoted supplier for a product by real profit per order placed (using their landed cost and the team's RTO/CPA assumptions), penalising no direct dropship, no COD, no blind packing, slow dispatch and high MOQ. Returns the best pick with reasons and warnings.",
    readOnly: true,
    schema: z.object({ product: ProductRef }),
    async run(ctx, { product }) {
      const ws = (await ctx.read()).workspace;
      const p = findProduct(ws, product);
      const quoted = ws.suppliers.filter((s) => s.productId === p.id && s.quote);
      if (!quoted.length) throw new Error(`No quotes for ${p.name} yet. Use record_quote with a supplier's reply first.`);
      const rows = quoted
        .map((s) => {
          const q = s.quote!;
          const unitInclGst = Math.round(q.unitPrice * (1 + (q.gstPercent || 0) / 100) * 100) / 100;
          const ship = q.shippingPerUnit > 0 ? q.shippingPerUnit : p.shippingCost;
          const r = unitEconomics({ sellingPrice: p.sellingPrice, productCost: unitInclGst, shippingFwd: ship }, ws.economics);
          const sc = scoreQuote(q, r.profitPerOrder);
          return {
            supplierId: s.id,
            supplier: s.name,
            city: s.city,
            stage: s.stage,
            unitPrice: q.unitPrice,
            gstPercent: q.gstPercent,
            shipping: ship,
            landedCost: Math.round(unitInclGst + ship),
            moq: q.moq,
            dispatchDays: q.dispatchDays,
            dropship: q.dropshipSupported,
            cod: q.codSupported,
            blind: q.blindShipping,
            realProfitPerOrderPlaced: Math.round(r.profitPerOrder),
            breakEvenCpa: Math.round(r.profitBeforeAds),
            score: Math.round(sc.score),
            reasons: sc.reasons,
            warnings: sc.warnings,
          };
        })
        .sort((a, b) => b.score - a.score);
      const best = rows[0];
      const tick = (b: boolean) => (b ? "✓" : "✗");
      return {
        text: [
          `${p.name} sells at ${inr(p.sellingPrice)}. ${rows.length} quote(s):`,
          ...rows.map(
            (r, i) =>
              `${i + 1}. ${r.supplier}${r.city ? ` (${r.city})` : ""}: landed ${inr(r.landedCost)} · real ${inr(r.realProfitPerOrderPlaced)}/order · MOQ ${r.moq} · ${r.dispatchDays}d · dropship ${tick(r.dropship)} COD ${tick(r.cod)} blind ${tick(r.blind)}${r.warnings.length ? ` · ⚠ ${r.warnings.join("; ")}` : ""}`,
          ),
          `Best pick: ${best.supplier} (${best.reasons.join(", ") || "highest profit"}). Lock it in with finalize_supplier.`,
        ].join("\n"),
        data: { product: p.name, sellingPrice: p.sellingPrice, ranking: rows, bestPick: best.supplierId },
      };
    },
  }),

  defineTool({
    name: "finalize_supplier",
    title: "Finalize a supplier",
    description:
      "Lock in a quoted supplier as the product's fulfilment partner: stage 'finalized', product landed cost = their unit price incl. GST, product shipping = their shipping charge (if any), product status 'sourcing'. Returns the product's updated economics.",
    schema: z.object({ supplier: SupplierRef }),
    async run(ctx, { supplier }) {
      const { s, p, econ } = await ctx.update((ws) => {
        const s = findSupplier(ws, supplier);
        if (!s.quote) throw new Error(`${s.name} has no quote yet. Log it with record_quote first.`);
        const p = ws.products.find((x) => x.id === s.productId);
        if (!p) throw new Error(`Supplier ${s.name} is not linked to an existing product.`);
        s.stage = "finalized";
        p.sourcingCost = Math.round(s.quote.unitPrice * (1 + (s.quote.gstPercent || 0) / 100) * 100) / 100;
        if (s.quote.shippingPerUnit > 0) p.shippingCost = s.quote.shippingPerUnit;
        p.tags = (p.tags ?? []).filter((t) => t !== ESTIMATED_TAG);
        if (p.status === "idea" || p.status === "shortlisted") p.status = "sourcing";
        return { s: structuredClone(s), p: structuredClone(p), econ: ws.economics };
      });
      const row = economicsRow(p, econ);
      return {
        text: `${s.name} finalized for ${p.name}. Landed ${inr(p.sourcingCost)} + ${inr(p.shippingCost)} shipping → real ${inr(row.realProfitPerOrderPlaced)}/order placed, break-even CPA ${inr(row.breakEvenCpa)} [${row.verdict}].`,
        data: { supplier: s, product: row },
      };
    },
  }),

  defineTool({
    name: "save_creatives",
    title: "Save ad creatives",
    description:
      "Store ad creatives you wrote for a product (angle, hook, primary text, headline, CTA, Reel shot list, visual idea, language) so the whole team can use them and plan_meta_campaign can test them. Write 3-4 distinct angles (problem→solution, price anchor, gift, UGC unboxing...). Don't invent reviews, sales counts or medical claims.",
    schema: z.object({
      product: ProductRef,
      creatives: z
        .array(
          z.object({
            angle: z.string().min(2),
            hook: z.string().min(2).describe("First line / first 3 seconds"),
            primaryText: z.string().min(2),
            headline: z.string().min(2),
            cta: z.string().default("Shop now"),
            reelScript: z.array(z.string()).default([]).describe("Shot list"),
            visualIdea: z.string().default(""),
            language: z.enum(["English", "Hinglish", "Hindi"]).default("Hinglish"),
          }),
        )
        .min(1)
        .max(10),
    }),
    async run(ctx, { product, creatives }) {
      const out = await ctx.update((ws) => {
        const p = findProduct(ws, product);
        const now = Date.now();
        const saved: Creative[] = creatives.map((c) => ({ ...c, id: rid("cr"), productId: p.id, createdAt: now }));
        ws.creatives.push(...saved);
        return { name: p.name, saved, total: ws.creatives.filter((c) => c.productId === p.id).length };
      });
      return {
        text: `Saved ${out.saved.length} creative(s) for ${out.name} (${out.total} total): ${out.saved.map((c) => `"${c.angle}"`).join(", ")}. Next: plan_meta_campaign.`,
        data: out.saved.map((c) => ({ id: c.id, angle: c.angle, hook: c.hook })),
      };
    },
  }),

  defineTool({
    name: "list_creatives",
    title: "List saved creatives",
    description: "Creatives the team has saved, optionally for one product.",
    readOnly: true,
    schema: z.object({ product: ProductRef.optional() }),
    async run(ctx, { product }) {
      const ws = (await ctx.read()).workspace;
      const p = product ? findProduct(ws, product) : undefined;
      const list = ws.creatives.filter((c) => !p || c.productId === p.id);
      const pname = (id: string) => ws.products.find((x) => x.id === id)?.name ?? "?";
      return {
        text: list.length ? list.map((c) => `• [${pname(c.productId)}] ${c.angle} (${c.language}): "${c.hook}"`).join("\n") : "No creatives saved yet.",
        data: list,
      };
    },
  }),

  defineTool({
    name: "plan_meta_campaign",
    title: "Plan a Meta ads test campaign",
    description:
      "Build a Meta (Facebook/Instagram) ABO testing plan for a product from its RTO-adjusted break-even CPA and the saved creative angles: objective, structure, 3 ad sets with audiences and daily budgets, kill/scale rules in INR, and a pre-launch checklist. By default also creates the ad sets in the team's tracker so results can be logged with log_ad_results.",
    schema: z.object({
      product: ProductRef,
      dailyBudget: z.number().min(100).describe("Total daily test budget in INR, e.g. 1500"),
      createAdSets: z.boolean().default(true),
    }),
    async run(ctx, { product, dailyBudget, createAdSets }) {
      const out = await ctx.update((ws) => {
        const p = findProduct(ws, product);
        const be = Math.round(econOf(p, ws.economics).profitBeforeAds);
        const angles = [...new Set(ws.creatives.filter((c) => c.productId === p.id).map((c) => c.angle))];
        const plan = fallbackPlan(p, angles, dailyBudget, be);
        const created: string[] = [];
        if (createAdSets && be > 0) {
          for (const a of plan.adsets) {
            if (ws.adsets.some((x) => x.productId === p.id && x.name === a.name)) continue;
            const row: AdSetRow = {
              id: rid("as"),
              productId: p.id,
              name: a.name,
              creativeAngle: a.creativeAngle,
              audience: a.audience,
              dailyBudget: a.dailyBudget,
              spend: 0,
              impressions: 0,
              clicks: 0,
              addToCarts: 0,
              purchases: 0,
            };
            ws.adsets.push(row);
            created.push(a.name);
          }
        }
        return { name: p.name, be, plan, created, angles };
      });
      const warn = out.be <= 0 ? `⚠ ${out.name} loses money before ads (break-even CPA ${inr(out.be)}). Fix price/cost before spending on ads; no ad sets created.\n` : "";
      return {
        text: [
          warn + `Meta test plan for ${out.name} (break-even CPA ${inr(out.be)}, ${inr(dailyBudget)}/day):`,
          `Objective: ${out.plan.objective}`,
          `Structure: ${out.plan.campaignStructure}`,
          ...out.plan.adsets.map((a) => `• ${a.name}: ${inr(a.dailyBudget)}/day · ${a.audience}`),
          `Rules:\n${out.plan.rules.map((r) => `  - ${r}`).join("\n")}`,
          `Checklist:\n${out.plan.checklist.map((r) => `  - ${r}`).join("\n")}`,
          out.angles.length ? "" : "No creatives saved yet: write 3-4 angles and save_creatives so each ad set has its own hook.",
          out.created.length ? `Created ${out.created.length} ad set(s) in the tracker. Log Ads Manager numbers with log_ad_results.` : "",
        ]
          .filter(Boolean)
          .join("\n"),
        data: { breakEvenCpa: out.be, plan: out.plan, createdAdSets: out.created },
      };
    },
  }),

  defineTool({
    name: "log_ad_results",
    title: "Log Ads Manager numbers",
    description:
      "Record the CUMULATIVE totals from Meta Ads Manager for one or more ad sets (values are SET, not added: send lifetime totals each time). Unknown ad set names are created. Returns updated metrics; call ad_decisions for the verdicts.",
    schema: z.object({
      product: ProductRef.optional().describe("Needed only when creating a new ad set"),
      results: z
        .array(
          z.object({
            adset: z.string().min(1).describe("Ad set id or name"),
            spend: z.number().min(0).describe("INR"),
            impressions: z.number().int().min(0),
            clicks: z.number().int().min(0).describe("Link clicks"),
            addToCarts: z.number().int().min(0).default(0),
            purchases: z.number().int().min(0).describe("Orders attributed (COD + prepaid)"),
            dailyBudget: z.number().min(0).optional(),
          }),
        )
        .min(1),
    }),
    async run(ctx, { product, results }) {
      const out = await ctx.update((ws) => {
        const updated: string[] = [];
        for (const r of results) {
          let a: AdSetRow | undefined;
          try {
            a = findAdset(ws, r.adset);
          } catch (e) {
            if (!product) throw e;
            const p = findProduct(ws, product);
            a = { id: rid("as"), productId: p.id, name: r.adset, creativeAngle: "", audience: "", dailyBudget: r.dailyBudget ?? 0, spend: 0, impressions: 0, clicks: 0, addToCarts: 0, purchases: 0 };
            ws.adsets.push(a);
          }
          Object.assign(a, {
            spend: r.spend,
            impressions: r.impressions,
            clicks: r.clicks,
            addToCarts: r.addToCarts,
            purchases: r.purchases,
            ...(r.dailyBudget != null && { dailyBudget: r.dailyBudget }),
          });
          updated.push(a.name);
        }
        return { updated };
      });
      return { text: `Updated ${out.updated.length} ad set(s): ${out.updated.join(", ")}. Run ad_decisions for KILL/KEEP/SCALE calls.`, data: out };
    },
  }),

  defineTool({
    name: "ad_decisions",
    title: "KILL / WAIT / KEEP / SCALE each ad set",
    description:
      "Media-buyer verdict for every ad set, judged against the product's RTO-adjusted break-even CPA (not Meta's reported ROAS): CTR, CPC, CPM, cost per ATC, CPA, ROAS and RTO-adjusted ROAS, profit after RTO, reasons, and new budgets. Set applyBudgetChanges to raise SCALE budgets by 20% and zero KILLed ad sets in the tracker.",
    schema: z.object({
      product: ProductRef.optional().describe("Default: all products"),
      applyBudgetChanges: z.boolean().default(false),
    }),
    async run(ctx, { product, applyBudgetChanges }) {
      const run = (ws: SharedWorkspace) => {
        const p = product ? findProduct(ws, product) : undefined;
        const sets = ws.adsets.filter((a) => !p || a.productId === p.id);
        if (!sets.length) throw new Error("No ad sets yet. Use plan_meta_campaign (or log_ad_results with a product) first.");
        const rows = sets.map((a) => {
          const prod = ws.products.find((x) => x.id === a.productId);
          if (!prod) return null;
          const r = econOf(prod, ws.economics);
          const m = adMetrics(a, prod.sellingPrice, r.deliveredRate, r.profitBeforeAds);
          const d = decide(a, m, r.profitBeforeAds);
          if (applyBudgetChanges) {
            if (d.verdict === "SCALE" && d.newBudget) a.dailyBudget = d.newBudget;
            if (d.verdict === "KILL") a.dailyBudget = 0;
          }
          return {
            id: a.id,
            adset: a.name,
            product: prod.name,
            verdict: d.verdict,
            reasons: d.reasons,
            newDailyBudget: d.verdict === "KILL" ? 0 : (d.newBudget ?? a.dailyBudget),
            spend: a.spend,
            purchases: a.purchases,
            ctrPct: Math.round(m.ctr * 10000) / 100,
            cpc: Math.round(m.cpc),
            cpm: Math.round(m.cpm),
            costPerAtc: Math.round(m.costPerAtc),
            cpa: Math.round(m.cpa),
            breakEvenCpa: Math.round(r.profitBeforeAds),
            roas: Math.round(m.roas * 100) / 100,
            rtoAdjustedRoas: Math.round(m.rtoRoas * 100) / 100,
            profitAfterRto: Math.round(m.profit),
          };
        });
        return rows.filter((x): x is NonNullable<typeof x> => x !== null);
      };
      const rows = applyBudgetChanges ? await ctx.update(run) : run((await ctx.read()).workspace);
      const spend = rows.reduce((s, r) => s + r.spend, 0);
      const purchases = rows.reduce((s, r) => s + r.purchases, 0);
      const profit = rows.reduce((s, r) => s + r.profitAfterRto, 0);
      const budget = rows.reduce((s, r) => s + r.newDailyBudget, 0);
      return {
        text: [
          ...rows.map(
            (r) =>
              `${r.verdict.padEnd(5)} ${r.adset} [${r.product}]: spend ${inr(r.spend)}, ${r.purchases} orders, CTR ${r.ctrPct}%, CPA ${r.purchases ? inr(r.cpa) : "—"} vs BE ${inr(r.breakEvenCpa)}, RTO-adj ROAS ${r.rtoAdjustedRoas}× → ${r.reasons.join(" ")}`,
          ),
          `Total: ${inr(spend)} spent, ${purchases} orders, blended CPA ${purchases ? inr(spend / purchases) : "—"}, profit after RTO ${inr(profit)}. Recommended daily budget ${inr(budget)}${applyBudgetChanges ? " (applied)" : " (not applied; pass applyBudgetChanges: true)"}.`,
        ].join("\n"),
        data: { adsets: rows, totals: { spend, purchases, blendedCpa: purchases ? Math.round(spend / purchases) : null, profitAfterRto: profit, recommendedDailyBudget: budget } },
      };
    },
  }),
];
