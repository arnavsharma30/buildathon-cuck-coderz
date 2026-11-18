import * as z from "zod/v4";
import { defineTool, type McpCtx, type ToolDef } from "../types";
import type { SharedWorkspace } from "@/lib/merge";
import type { Order, Product, SiteContent, Website } from "@/lib/types";
import { assessOrder, normalizePhone, portfolioImpact, type RtoAssessment } from "@/lib/rto";
import { demoOrders, ordersFromShopifyCSV } from "@/lib/orders-demo";
import { fallbackSiteContent, slugify } from "@/lib/site";
import { getSite, getSiteOrders, saveSite, SLUG_RE } from "@/lib/site-store";
import { inr, pct } from "@/lib/economics";
import {
  COURIER_LABEL,
  NOTIFY_ON,
  STATUS_LABEL,
  STEPS,
  TERMINAL,
  advanceDemo,
  demoAwb,
  shipmentId,
  shiprocketLogin,
  trackDelhivery,
  trackShiprocket,
  type Courier,
  type NotificationLog,
  type NotifyEvent,
  type Shipment,
  type TrackResult,
} from "@/lib/couriers";
import { notifyCustomer, trackingLink } from "@/lib/notify";
import {
  getIntegrations,
  listShipmentsForTeam,
  publicIntegrations,
  saveIntegrations,
  saveShipment,
  withShipment,
  type Integrations,
  type Provider,
  type TeamShipment,
} from "@/lib/shipping-store";

// ---------- helpers ----------

function findProduct(ws: SharedWorkspace, ref: string): Product {
  const r = ref.trim().toLowerCase();
  const p =
    ws.products.find((x) => x.id === ref) ??
    ws.products.find((x) => x.name.toLowerCase() === r) ??
    ws.products.find((x) => x.name.toLowerCase().includes(r));
  if (!p) throw new Error(`No product matching "${ref}". Products: ${ws.products.map((x) => x.name).join(", ") || "none yet (use add_products)"}`);
  return p;
}

function findOrder(ws: SharedWorkspace, ref: string): Order {
  const r = ref.trim().replace(/^#?/, "#").toLowerCase();
  const o = ws.orders.find((x) => x.id === ref) ?? ws.orders.find((x) => x.id.toLowerCase() === r);
  if (!o) throw new Error(`No order "${ref}". Use import_orders / sync_website_orders first, or check the id (e.g. #D1004).`);
  return o;
}

const isDemo = (orderId: string) => orderId.startsWith("#D");
const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";
const waLink = (orderId: string, phone: string, text: string) =>
  isDemo(orderId) || normalizePhone(phone).length !== 10
    ? `https://wa.me/?text=${encodeURIComponent(text)}`
    : `https://wa.me/91${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;

function manualLinks(s: Shipment, logs: NotificationLog[]) {
  return logs.map((l) => ({
    event: l.event,
    channel: l.channel,
    status: l.status,
    error: l.error,
    sendNow:
      l.status === "sent"
        ? undefined
        : l.channel === "whatsapp"
          ? waLink(s.orderId, s.phone, l.message)
          : `mailto:${l.to}?subject=${encodeURIComponent(l.subject ?? "")}&body=${encodeURIComponent(l.message)}`,
  }));
}

const productOf = (ws: SharedWorkspace, o: Order) => ws.products.find((p) => p.id === o.productId) ?? ws.products[0];

async function teamIntegrations(ctx: McpCtx) {
  return getIntegrations(ctx.teamId);
}

async function trackOne(s: Shipment, integrations: Integrations, teamId: string): Promise<TrackResult> {
  if (s.courier === "demo") return advanceDemo(s);
  if (s.courier === "delhivery") {
    if (!integrations.delhivery) throw new Error("Delhivery is not connected (connect_integration)");
    return trackDelhivery(s.awb, integrations.delhivery.apiToken);
  }
  const sr = integrations.shiprocket;
  if (!sr) throw new Error("Shiprocket is not connected (connect_integration)");
  if (!sr.token || !sr.tokenAt || Date.now() - sr.tokenAt > 7 * 864e5) {
    sr.token = await shiprocketLogin(sr.email, sr.password);
    sr.tokenAt = Date.now();
    await saveIntegrations(integrations, teamId);
  }
  return trackShiprocket(s.awb, sr.token);
}

const rank = (st: Shipment["status"]) => {
  const i = STEPS.indexOf(st);
  return i === -1 ? 99 : i;
};

/** Pull the latest status and message the customer once per newly reached milestone. */
async function refreshShipment(id: string, ctx: McpCtx, integrations: Integrations) {
  return withShipment(id, async (s) => {
    const sentNow: NotificationLog[] = [];
    try {
      const r = await trackOne(s, integrations, ctx.teamId);
      const before = s.status;
      const seen = new Set(s.events.map((e) => `${e.status}|${e.at}|${e.label}`));
      const fresh = r.events.filter((e) => !seen.has(`${e.status}|${e.at}|${e.label}`));
      if (s.courier === "demo") s.events = r.events;
      else s.events = [...s.events.filter((e) => e.status === "booked" && e.label.startsWith("Shipment booked")), ...r.events];
      s.status = r.status;
      if (r.trackingUrl) s.trackingUrl = r.trackingUrl;
      s.lastError = undefined;
      const already = new Set(s.notifications.map((n) => n.event));
      const reached = new Set(fresh.map((e) => e.status));
      if (before !== s.status) reached.add(s.status);
      for (const st of reached) {
        const ev = NOTIFY_ON[st];
        if (ev && !already.has(ev) && !(ev !== "ndr" && rank(st) < rank(before))) {
          const logs = await notifyCustomer(s, ev, ctx.origin, integrations);
          s.notifications.push(...logs);
          sentNow.push(...logs);
          already.add(ev);
        }
      }
    } catch (e) {
      s.lastError = e instanceof Error ? e.message : String(e);
    }
    s.updatedAt = new Date().toISOString();
    await saveShipment(s);
    return { shipment: s, sentNow };
  });
}

const ORDER_STATUSES = ["new", "confirmed", "converted-prepaid", "cancelled", "shipped", "delivered", "rto"] as const;

const OrderIn = z.object({
  id: z.string().optional().describe("Order id, e.g. #1042 (auto-assigned if missing)"),
  customerName: z.string(),
  phone: z.string(),
  email: z.string().optional(),
  address: z.string(),
  city: z.string(),
  state: z.string().default(""),
  pincode: z.string(),
  amount: z.number().nonnegative(),
  payment: z.enum(["COD", "Prepaid"]).default("COD"),
  quantity: z.number().int().positive().default(1),
  createdAt: z.string().optional().describe("ISO time; defaults to now"),
});

const SiteContentIn = z
  .object({
    brandName: z.string(),
    tagline: z.string(),
    announcement: z.string(),
    hero: z.object({ headline: z.string(), subheadline: z.string(), cta: z.string(), badge: z.string() }).partial(),
    benefits: z.array(z.object({ icon: z.string().describe("one emoji"), title: z.string(), text: z.string() })),
    howItWorks: z.array(z.object({ title: z.string(), text: z.string() })),
    specs: z.array(z.object({ label: z.string(), value: z.string() })),
    offer: z.object({ price: z.number(), compareAtPrice: z.number(), bullets: z.array(z.string()) }).partial(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })),
    guarantee: z.string(),
    reviews: z.array(z.object({ name: z.string(), city: z.string(), text: z.string(), rating: z.number().min(1).max(5) })),
    footerNote: z.string(),
  })
  .partial();

// Claims a store page must not make up.
const SOCIAL_PROOF = /\b\d[\d,.]*\s*(k|lakh|\+)?\s*\+?\s*(happy\s+)?(customers|buyers|orders|sold|reviews|ratings)\b|\b(only\s+\d+\s+left|offer ends|hurry)\b|★|\b\d(\.\d)?\s*\/\s*5\b/i;

function contentStrings(c: SiteContent): string[] {
  return [
    c.tagline,
    c.announcement,
    c.hero.headline,
    c.hero.subheadline,
    c.hero.badge ?? "",
    c.guarantee,
    c.footerNote,
    ...c.benefits.flatMap((b) => [b.title, b.text]),
    ...c.faq.flatMap((f) => [f.q, f.a]),
    ...c.offer.bullets,
  ];
}

function customerTemplate(purpose: "confirm" | "prepaid_offer" | "advance" | "fix_address" | "shipped", o: Order, store: string, product: string) {
  const head = `Hi ${first(o.customerName)}! 👋 ${store} here. Thanks for ordering ${product} (${o.id}, ₹${o.amount}).`;
  switch (purpose) {
    case "confirm":
      return `${head}\nBas ek quick confirmation chahiye before we dispatch.\nReply 1 to confirm ✅, 2 to cancel.`;
    case "prepaid_offer":
      return `${head}\nConfirm karne ke liye reply 1 karein ✅\n🎁 Abhi UPI se pay karein aur ₹50 OFF paayein (pay ₹${Math.max(0, o.amount - 50)}): [UPI_LINK]\nCOD bhi available hai.`;
    case "advance":
      return `${head}\nDispatch reserve karne ke liye sirf ₹99 advance UPI se pay karein: [UPI_LINK]\nBaaki ₹${Math.max(0, o.amount - 99)} delivery pe. Reply 1 once paid ✅`;
    case "fix_address":
      return `${head}\nDelivery partner ko address samajh nahi aa raha 🙏 Please apna full address bhejein: house/flat no., street, landmark aur pincode. Phir hum turant dispatch kar denge.`;
    case "shipped":
      return `${head}\nAapka order ship ho gaya hai 🚚 3-5 din mein deliver hoga. Please ₹${o.amount} cash/UPI ready rakhein.`;
  }
}

const PURPOSE_FOR_ACTION: Record<RtoAssessment["action"]["code"], "confirm" | "prepaid_offer" | "advance" | "fix_address" | "shipped"> = {
  ship: "confirm",
  confirm: "confirm",
  prepaid: "prepaid_offer",
  "call-advance": "advance",
  hold: "fix_address",
};

// ---------- tools ----------

export const opsTools: ToolDef[] = [
  // 1. Store pages
  defineTool({
    name: "publish_store_page",
    title: "Publish a store page",
    description:
      "Publish (or update) a live single-product store page with a Cash-on-Delivery order form at <origin>/s/<slug>. You write the copy and pass it in `content` (any fields you omit are filled with sensible defaults from the product). Never invent reviews, ratings, customer/sales counts or scarcity: reviews are dropped unless reviewsAreReal is true. Orders placed on the page arrive via sync_website_orders.",
    schema: z.object({
      product: z.string().describe("Product id or name"),
      slug: z.string().optional().describe("URL name, 3-40 chars a-z 0-9 -. Defaults to the brand name"),
      brandName: z.string().optional(),
      theme: z.enum(["fresh", "bold", "luxe", "playful"]).default("fresh"),
      language: z.enum(["English", "Hinglish", "Hindi"]).default("Hinglish"),
      imageUrl: z.string().url().optional().describe("Product photo URL"),
      content: SiteContentIn.optional().describe("Store copy you wrote (partial is fine)"),
      reviewsAreReal: z.boolean().default(false).describe("Only true if every review came from a real customer"),
    }),
    async run(ctx, args) {
      const result = await ctx.update(async (ws) => {
        const product = findProduct(ws, args.product);
        const base = fallbackSiteContent(product, { brandName: args.brandName ?? args.content?.brandName, language: args.language });
        const c = args.content ?? {};
        const content: SiteContent = {
          ...base,
          ...c,
          hero: { ...base.hero, ...c.hero },
          offer: { ...base.offer, ...c.offer, price: c.offer?.price ?? product.sellingPrice },
          reviews: args.reviewsAreReal ? (c.reviews ?? []) : [],
        } as SiteContent;
        const notes: string[] = [];
        if (!args.reviewsAreReal && c.reviews?.length) notes.push(`Dropped ${c.reviews.length} review(s): only publish reviews from real customers (set reviewsAreReal).`);
        const flagged = contentStrings(content).filter((t) => SOCIAL_PROOF.test(t));
        if (flagged.length) throw new Error(`Store copy makes claims we can't verify (sales counts, ratings or fake urgency): "${flagged[0]}". Remove them and try again.`);

        const slug = slugify(args.slug || content.brandName || product.name);
        if (!SLUG_RE.test(slug)) throw new Error("Slug must be 3-40 characters: lowercase letters, numbers and dashes");
        const existing = await getSite(slug);
        const mine = ws.websites.find((w) => w.slug === slug);
        if (existing && !mine) throw new Error(`The address /s/${slug} is taken by another store. Pick another slug.`);

        const now = Date.now();
        const website: Website = {
          id: mine?.id ?? `site_${now.toString(36)}`,
          productId: product.id,
          slug,
          theme: args.theme,
          language: args.language,
          content,
          imageUrl: args.imageUrl ?? product.images?.[0],
          publishedAt: mine?.publishedAt ?? now,
          updatedAt: now,
        };
        await saveSite({ website, product });
        ws.websites = [website, ...ws.websites.filter((w) => w.slug !== slug)];
        return { website, product, notes };
      });
      const url = `${ctx.origin}/s/${result.website.slug}`;
      const c = result.website.content;
      return {
        text: [
          `Live: ${url}`,
          `${c.brandName} · "${c.hero.headline}" · ${inr(c.offer.price)}${c.offer.compareAtPrice ? ` (MRP ${inr(c.offer.compareAtPrice)})` : ""} · theme ${result.website.theme}`,
          `Sections: hero, ${c.benefits.length} benefits, how it works, specs, offer, ${c.faq.length} FAQs, guarantee${c.reviews.length ? `, ${c.reviews.length} real reviews` : ""}, COD order form.`,
          ...result.notes,
        ].join("\n"),
        data: { url, slug: result.website.slug, productId: result.product.id, content: c },
      };
    },
  }),

  defineTool({
    name: "list_store_pages",
    title: "List store pages",
    description: "The team's published store pages with live URLs and how many orders each has received.",
    readOnly: true,
    schema: z.object({}),
    async run(ctx) {
      const ws = (await ctx.read()).workspace;
      const pages = await Promise.all(
        ws.websites.map(async (w) => ({
          slug: w.slug,
          url: `${ctx.origin}/s/${w.slug}`,
          brandName: w.content.brandName,
          product: ws.products.find((p) => p.id === w.productId)?.name,
          ordersOnSite: (await getSiteOrders(w.slug)).length,
        })),
      );
      return { text: pages.length ? pages.map((p) => `${p.url} · ${p.product} · ${p.ordersOnSite} orders`).join("\n") : "No store pages yet: use publish_store_page.", data: pages };
    },
  }),

  // 2-5. Orders & RTO
  defineTool({
    name: "sync_website_orders",
    title: "Sync orders from store pages",
    description: "Pull new COD orders placed on the team's published store pages into the team's order book (deduplicated).",
    schema: z.object({}),
    async run(ctx) {
      const r = await ctx.update(async (ws) => {
        const known = new Set(ws.orders.map((o) => o.id));
        const fresh: Order[] = [];
        for (const w of ws.websites.filter((x) => x.publishedAt)) {
          for (const o of await getSiteOrders(w.slug)) {
            if (known.has(o.id)) continue;
            known.add(o.id);
            fresh.push({ ...o, source: "website", productId: o.productId ?? w.productId });
          }
        }
        ws.orders = [...fresh, ...ws.orders];
        return { fresh, pages: ws.websites.length };
      });
      return {
        text: r.fresh.length ? `Synced ${r.fresh.length} new website order(s): ${r.fresh.map((o) => o.id).join(", ")}. Run rto_check before shipping.` : `No new orders on ${r.pages} store page(s).`,
        data: r.fresh,
      };
    },
  }),

  defineTool({
    name: "import_orders",
    title: "Import orders",
    description:
      "Add orders to the team's order book: paste a Shopify orders export CSV, pass a structured list, or set loadSampleOrders for a realistic demo batch (ids start with #D; demo orders never message real numbers).",
    schema: z.object({
      csv: z.string().optional().describe("Shopify Admin → Orders → Export, CSV text"),
      orders: z.array(OrderIn).optional(),
      loadSampleOrders: z.boolean().default(false),
      product: z.string().optional().describe("Product id or name these orders are for"),
    }),
    async run(ctx, args) {
      const r = await ctx.update((ws) => {
        const productId = args.product ? findProduct(ws, args.product).id : ws.products[0]?.id;
        let incoming: Order[] = [];
        if (args.loadSampleOrders) incoming.push(...demoOrders(productId).map((o) => ({ ...o, source: "demo" as const })));
        if (args.csv) incoming.push(...ordersFromShopifyCSV(args.csv, productId).map((o) => ({ ...o, source: "shopify" as const })));
        if (args.orders?.length) {
          const base = ws.orders.length + 1001;
          incoming.push(
            ...args.orders.map((o, i) => ({
              id: o.id ?? `#M${base + i}`,
              productId,
              createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
              customerName: o.customerName,
              phone: o.phone,
              email: o.email,
              address: o.address,
              city: o.city,
              state: o.state,
              pincode: o.pincode.replace(/\s/g, ""),
              amount: o.amount,
              payment: o.payment,
              quantity: o.quantity,
              status: "new" as const,
            })),
          );
        }
        if (!incoming.length) throw new Error("Nothing to import: pass csv, orders, or loadSampleOrders: true.");
        const ids = new Set(incoming.map((o) => o.id));
        incoming = incoming.filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i);
        ws.orders = [...incoming, ...ws.orders.filter((o) => !ids.has(o.id))];
        return incoming;
      });
      const pending = r.filter((o) => o.status === "new");
      const cod = pending.filter((o) => o.payment === "COD").length;
      return {
        text: `Imported ${r.length} orders (${pending.length} awaiting dispatch, ${pending.length ? pct(cod / pending.length) : "0%"} COD). Next: rto_check.`,
        data: { imported: r.length, ids: r.map((o) => o.id) },
      };
    },
  }),

  defineTool({
    name: "rto_check",
    title: "RTO risk check before shipping",
    description:
      "Score every order awaiting dispatch for RTO (return-to-origin) risk, riskiest first: score, band, estimated RTO chance, the signals behind it, and the action an experienced operator would take (ship / confirm + prepaid offer / call + ₹99 advance / hold). Also returns the batch impact: expected RTO if you ship everything blindly vs following the actions, and ₹ saved.",
    readOnly: true,
    schema: z.object({
      includeConfirmed: z.boolean().default(false).describe("Also score orders already confirmed but not shipped"),
      limit: z.number().int().min(1).max(200).default(30),
    }),
    async run(ctx, { includeConfirmed, limit }) {
      const ws = (await ctx.read()).workspace;
      const pending = ws.orders.filter((o) => o.status === "new" || (includeConfirmed && (o.status === "confirmed" || o.status === "converted-prepaid")));
      if (!pending.length) return { text: "No orders awaiting dispatch. Use import_orders or sync_website_orders." };
      const items = pending.map((order) => ({ order, risk: assessOrder(order, { orders: ws.orders }) })).sort((a, b) => b.risk.score - a.risk.score);
      const p = ws.products[0];
      const impact = portfolioImpact(items, ws.economics, p?.shippingCost ?? 65, p?.sourcingCost ?? 250);
      const lines = items.slice(0, limit).map(({ order: o, risk: r }) => {
        const why = r.signals.filter((s) => s.points > 0).sort((a, b) => b.points - a.points).slice(0, 2).map((s) => s.label).join("; ");
        return `${o.id} · ${o.customerName} · ${o.city} ${o.pincode} · ${inr(o.amount)} ${o.payment} · ${r.band.toUpperCase()} ${r.score}/100 (${pct(r.probability)} RTO) → ${r.action.label}${why ? ` · ${why}` : ""}`;
      });
      const counts = { critical: 0, high: 0, medium: 0, low: 0 } as Record<string, number>;
      for (const i of items) counts[i.risk.band]++;
      return {
        text: [
          `${items.length} orders awaiting dispatch · critical ${counts.critical}, high ${counts.high}, medium ${counts.medium}, low ${counts.low}`,
          `Ship everything blindly: ~${pct(impact.rtoRateBlind)} RTO (${impact.expectedRtoBlind.toFixed(1)} parcels, ${inr(impact.lossBlind)} lost). Follow the actions: ~${pct(impact.rtoRateWithActions)} (${inr(impact.lossWithActions)}). Saves ${inr(impact.saved)} on this batch.`,
          "",
          ...lines,
          "",
          "Use customer_message for the confirmation/prepaid/advance WhatsApp text, update_order_status once confirmed, then create_shipment.",
        ].join("\n"),
        data: {
          impact,
          orders: items.slice(0, limit).map(({ order: o, risk: r }) => ({
            id: o.id,
            band: r.band,
            score: r.score,
            rtoProbability: Math.round(r.probability * 100) / 100,
            action: r.action,
            signals: r.signals,
            duplicateOf: r.duplicateOf,
          })),
        },
      };
    },
  }),

  defineTool({
    name: "update_order_status",
    title: "Update order status",
    description: "Set the status of one or more orders (e.g. confirmed after the customer replied on WhatsApp, converted-prepaid after UPI payment, cancelled).",
    schema: z.object({
      orderIds: z.array(z.string()).min(1),
      status: z.enum(ORDER_STATUSES),
    }),
    async run(ctx, { orderIds, status }) {
      const changed = await ctx.update((ws) => {
        const ids = orderIds.map((id) => findOrder(ws, id).id);
        ws.orders = ws.orders.map((o) => (ids.includes(o.id) ? { ...o, status } : o));
        return ids;
      });
      return { text: `Set ${changed.join(", ")} to ${status}.`, data: changed };
    },
  }),

  defineTool({
    name: "customer_message",
    title: "Draft a customer WhatsApp message",
    description:
      "Hinglish WhatsApp message for an order plus a one-click wa.me link. purpose defaults to what rto_check recommends: confirm, prepaid_offer (₹50 off for UPI), advance (₹99 partial COD), fix_address, or shipped. [UPI_LINK] is a placeholder for the team's UPI link.",
    readOnly: true,
    schema: z.object({
      orderId: z.string(),
      purpose: z.enum(["confirm", "prepaid_offer", "advance", "fix_address", "shipped"]).optional(),
    }),
    async run(ctx, { orderId, purpose }) {
      const ws = (await ctx.read()).workspace;
      const o = findOrder(ws, orderId);
      const risk = assessOrder(o, { orders: ws.orders });
      const why = purpose ?? PURPOSE_FOR_ACTION[risk.action.code];
      const product = productOf(ws, o)?.name ?? "your order";
      const message = customerTemplate(why, o, ws.teamName, product);
      const link = waLink(o.id, o.phone, message);
      return {
        text: `${message}\n\nSend: ${link}${isDemo(o.id) ? "\n(Demo order: link opens WhatsApp without a number.)" : ""}`,
        data: { orderId: o.id, purpose: why, risk: { band: risk.band, action: risk.action.label }, message, whatsappLink: link },
      };
    },
  }),

  // 7. Integrations
  defineTool({
    name: "connect_integration",
    title: "Connect courier or messaging",
    description:
      "Save the team's credentials on the DropOS server: shiprocket {email, password} (verified by logging in), delhivery {apiToken}, whatsapp {phoneNumberId, accessToken} (Meta WhatsApp Cloud API), email {resendApiKey, from}. Secrets are never returned. Without them, the demo courier works and customer messages are queued with one-click send links.",
    schema: z.object({
      provider: z.enum(["shiprocket", "delhivery", "whatsapp", "email"]),
      credentials: z.record(z.string(), z.string()),
    }),
    async run(ctx, { provider, credentials: c }) {
      const all = await teamIntegrations(ctx);
      const need: Record<Provider, string[]> = {
        shiprocket: ["email", "password"],
        delhivery: ["apiToken"],
        whatsapp: ["phoneNumberId", "accessToken"],
        email: ["resendApiKey", "from"],
      };
      const missing = need[provider].filter((k) => !c[k]?.trim());
      if (missing.length) throw new Error(`${provider} needs: ${missing.join(", ")}`);
      if (provider === "shiprocket") {
        const token = await shiprocketLogin(c.email.trim(), c.password);
        all.shiprocket = { email: c.email.trim(), password: c.password, token, tokenAt: Date.now() };
      } else if (provider === "delhivery") all.delhivery = { apiToken: c.apiToken.trim() };
      else if (provider === "whatsapp") all.whatsapp = { phoneNumberId: c.phoneNumberId.trim(), accessToken: c.accessToken.trim() };
      else all.email = { resendApiKey: c.resendApiKey.trim(), from: c.from.trim() };
      await saveIntegrations(all, ctx.teamId);
      await ctx.log(`connected ${provider}`, "team");
      return { text: `${provider} connected.`, data: publicIntegrations(all) };
    },
  }),

  defineTool({
    name: "disconnect_integration",
    title: "Disconnect courier or messaging",
    description: "Remove the team's saved credentials for a provider.",
    schema: z.object({ provider: z.enum(["shiprocket", "delhivery", "whatsapp", "email"]) }),
    async run(ctx, { provider }) {
      const all = await teamIntegrations(ctx);
      delete all[provider];
      await saveIntegrations(all, ctx.teamId);
      await ctx.log(`disconnected ${provider}`, "team");
      return { text: `${provider} disconnected.`, data: publicIntegrations(all) };
    },
  }),

  defineTool({
    name: "list_integrations",
    title: "Connected couriers and messaging",
    description: "Which couriers (Shiprocket, Delhivery; demo always available) and messaging channels (WhatsApp Cloud API, email) the team has connected. No secrets.",
    readOnly: true,
    schema: z.object({}),
    async run(ctx) {
      const pub = publicIntegrations(await teamIntegrations(ctx));
      return {
        text: Object.entries(pub)
          .map(([k, v]) => `${k}: ${v.connected ? `connected${v.hint ? ` (${v.hint})` : ""}` : "not connected"}`)
          .concat("demo courier: always available")
          .join("\n"),
        data: pub,
      };
    },
  }),

  // 8-10. Shipping
  defineTool({
    name: "create_shipment",
    title: "Ship an order",
    description:
      "Book/attach a shipment for an order: courier demo (simulated journey, AWB auto) or shiprocket/delhivery (pass the AWB from the courier). Marks the order shipped and sends the customer a 'shipped' WhatsApp + email with their live tracking link (<origin>/t/<id>). Queued messages come back with one-click send links. Run rto_check first for COD orders.",
    schema: z.object({
      orderId: z.string(),
      courier: z.enum(["demo", "shiprocket", "delhivery"]).default("demo"),
      awb: z.string().optional().describe("Waybill / AWB number (required for real couriers)"),
      customerEmail: z.string().optional(),
    }),
    async run(ctx, args) {
      const ws = (await ctx.read()).workspace;
      const o = findOrder(ws, args.orderId);
      const existing = (await listShipmentsForTeam(ctx.teamId)).find((s) => s.orderId === o.id);
      if (existing) throw new Error(`${o.id} already has shipment ${existing.awb}: use track_shipments. Link: ${trackingLink(ctx.origin, existing)}`);
      const integrations = await teamIntegrations(ctx);
      const courier: Courier = args.courier;
      if (courier !== "demo" && !integrations[courier]) throw new Error(`${courier} is not connected: use connect_integration, or ship with courier "demo".`);
      const awb = (args.awb ?? "").trim() || (courier === "demo" ? demoAwb() : "");
      if (!/^[A-Za-z0-9-]{6,40}$/.test(awb)) throw new Error("Pass the AWB / waybill number from your courier (6-40 letters/digits).");
      const email = (args.customerEmail ?? o.email ?? "").trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Customer email looks invalid");

      const now = new Date().toISOString();
      const s: TeamShipment = {
        id: shipmentId(),
        teamId: ctx.teamId,
        orderId: o.id,
        courier,
        awb,
        storeName: ws.teamName || "Our store",
        productName: productOf(ws, o)?.name ?? "your order",
        customerName: o.customerName,
        phone: o.phone,
        email: email || undefined,
        city: o.city,
        pincode: o.pincode,
        amount: o.amount,
        payment: o.payment,
        status: "booked",
        events: [{ status: "booked", label: `Shipment booked with ${courier === "demo" ? "demo courier" : COURIER_LABEL[courier]}`, at: now }],
        createdAt: now,
        updatedAt: now,
        notifications: [],
      };
      const logs = await notifyCustomer(s, "shipped", ctx.origin, integrations);
      s.notifications.push(...logs);
      await saveShipment(s);
      await ctx.update((w) => {
        w.orders = w.orders.map((x) => (x.id === o.id ? { ...x, status: "shipped" as const } : x));
      });
      const link = trackingLink(ctx.origin, s);
      const msg = logs.map((l) => `${l.channel} ${l.status}${l.error ? ` (${l.error})` : ""}`).join(", ");
      return {
        text: `Shipped ${o.id} via ${COURIER_LABEL[courier]} · AWB ${awb}\nCustomer tracking link: ${link}\n"Shipped" message: ${msg}${logs.some((l) => l.status !== "sent") ? " (queued messages include a one-click send link in data)" : ""}`,
        data: { shipmentId: s.id, trackingLink: link, awb, messages: manualLinks(s, logs) },
      };
    },
  }),

  defineTool({
    name: "track_shipments",
    title: "Track shipments",
    description:
      "Refresh every in-flight shipment for the team (or just the given orders) from Shiprocket/Delhivery (demo courier advances one step per call), message customers automatically when a parcel goes out for delivery, is delivered or a delivery attempt fails, and update order statuses (delivered / rto). Returns a status table with tracking links.",
    schema: z.object({ orderIds: z.array(z.string()).optional() }),
    async run(ctx, { orderIds }) {
      const integrations = await teamIntegrations(ctx);
      const want = orderIds?.length ? new Set(orderIds.map((x) => x.replace(/^#?/, "#"))) : null;
      const all = (await listShipmentsForTeam(ctx.teamId)).filter((s) => !want || want.has(s.orderId));
      if (!all.length) return { text: "No shipments yet: use create_shipment." };
      const rows: { s: Shipment; sentNow: NotificationLog[] }[] = [];
      for (const s of all) {
        if (TERMINAL.includes(s.status)) rows.push({ s, sentNow: [] });
        else {
          const r = await refreshShipment(s.id, ctx, integrations);
          if (r) rows.push({ s: r.shipment, sentNow: r.sentNow });
        }
      }
      const finals = new Map<string, Order["status"]>();
      for (const { s } of rows) {
        if (s.status === "delivered") finals.set(s.orderId, "delivered");
        if (s.status === "rto_delivered") finals.set(s.orderId, "rto");
      }
      if (finals.size) {
        await ctx.update((ws) => {
          ws.orders = ws.orders.map((o) => (finals.has(o.id) && o.status !== finals.get(o.id) ? { ...o, status: finals.get(o.id)! } : o));
        });
      }
      const lines = rows.map(({ s, sentNow }) => {
        const last = s.events.at(-1);
        const msgs = sentNow.length ? ` · messaged: ${sentNow.map((l) => `${l.event} ${l.channel} ${l.status}`).join(", ")}` : "";
        return `${s.orderId} · ${COURIER_LABEL[s.courier]} ${s.awb} · ${STATUS_LABEL[s.status]}${last?.location ? ` (${last.location})` : ""}${s.lastError ? ` · ERROR ${s.lastError}` : ""} · ${trackingLink(ctx.origin, s)}${msgs}`;
      });
      return {
        text: lines.join("\n"),
        data: rows.map(({ s, sentNow }) => ({
          orderId: s.orderId,
          shipmentId: s.id,
          status: s.status,
          trackingLink: trackingLink(ctx.origin, s),
          lastEvent: s.events.at(-1),
          error: s.lastError,
          messagesThisRefresh: manualLinks(s, sentNow),
        })),
      };
    },
  }),

  defineTool({
    name: "notify_customer",
    title: "Message a customer about their shipment",
    description: "Send (or re-send) a shipment update by WhatsApp + email with the tracking link: shipped, out_for_delivery, delivered, or ndr (failed delivery attempt). Pass shipmentId or orderId.",
    schema: z.object({
      shipmentId: z.string().optional(),
      orderId: z.string().optional(),
      event: z.enum(["shipped", "out_for_delivery", "delivered", "ndr"]),
    }),
    async run(ctx, { shipmentId: sid, orderId, event }) {
      if (!sid && !orderId) throw new Error("Pass shipmentId or orderId");
      const list = await listShipmentsForTeam(ctx.teamId);
      const target = list.find((s) => (sid ? s.id === sid : s.orderId === orderId || s.orderId === `#${orderId?.replace(/^#/, "")}`));
      if (!target) throw new Error("No shipment found for that order: create_shipment first.");
      const integrations = await teamIntegrations(ctx);
      const r = await withShipment(target.id, async (s) => {
        const logs = await notifyCustomer(s, event as NotifyEvent, ctx.origin, integrations);
        s.notifications.push(...logs);
        s.updatedAt = new Date().toISOString();
        await saveShipment(s);
        return { s, logs };
      });
      if (!r) throw new Error("Shipment disappeared");
      await ctx.log(`sent "${event}" update for ${r.s.orderId} to ${r.s.customerName}`, "orders");
      return {
        text: r.logs.map((l) => `${l.channel}: ${l.status}${l.error ? ` (${l.error})` : ""}`).join("\n") + `\nTracking link: ${trackingLink(ctx.origin, r.s)}`,
        data: manualLinks(r.s, r.logs),
      };
    },
  }),
];
