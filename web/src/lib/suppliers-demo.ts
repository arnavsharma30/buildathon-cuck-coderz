// Offline fallbacks for the Suppliers module: seeded sample suppliers, outreach templates
// and a deterministic parser for messy Hinglish supplier replies.
import type { Product, Quote, Supplier } from "./types";

export type SupplierLead = Omit<Supplier, "id" | "productId" | "stage">;

// ---------- seeded sample suppliers ----------

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HUBS = [
  { city: "Delhi (Sadar Bazar)", prefix: ["Shree Balaji", "Gupta", "Bansal", "Jai Mata Di"] },
  { city: "Delhi (Gandhi Nagar)", prefix: ["Aggarwal", "Kapoor", "Royal"] },
  { city: "Surat", prefix: ["Shree Krishna", "Patel", "Om Sai"] },
  { city: "Mumbai (Masjid Bunder)", prefix: ["Mehta", "Al-Noor", "Shah"] },
  { city: "Ludhiana", prefix: ["Singh", "Punjab", "Guru Kripa"] },
  { city: "Jaipur", prefix: ["Rajputana", "Marudhar", "Pink City"] },
  { city: "Ahmedabad", prefix: ["Shivam", "Gujarat", "Ambica"] },
  { city: "Rajkot", prefix: ["Saurashtra", "Umiya", "Jalaram"] },
  { city: "Kolkata (Burrabazar)", prefix: ["Maa Tara", "Bengal", "Jain"] },
];

const SUFFIX = ["Enterprises", "Traders", "Impex", "Industries", "Trading Co.", "Wholesale", "Overseas", "Creations"];

/** Rough wholesale price guess from the product's own sourcing estimate (or the query). */
function basePrice(query: string, hint?: number) {
  if (hint && hint > 0) return hint;
  const q = query.toLowerCase();
  if (/(watch|earbud|speaker|projector|camera|massager)/.test(q)) return 450;
  if (/(jewel|earring|necklace|ring|bracelet)/.test(q)) return 90;
  if (/(led|light|lamp)/.test(q)) return 160;
  if (/(bottle|mug|organizer|kitchen|holder)/.test(q)) return 120;
  if (/(shirt|kurti|tshirt|t-shirt|hoodie|saree|dress)/.test(q)) return 220;
  return 180;
}

export function sampleSuppliers(query: string, priceHint?: number): SupplierLead[] {
  const r = rng(hash(query.trim().toLowerCase()));
  const base = basePrice(query, priceHint);
  const hubs = [...HUBS].sort(() => r() - 0.5).slice(0, 6);
  const words = query
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

  return hubs.map((h, i) => {
    const factor = 0.75 + r() * 0.6; // 0.75x – 1.35x of base
    const lo = Math.max(10, Math.round((base * factor) / 5) * 5);
    const hi = Math.round((lo * (1.15 + r() * 0.25)) / 5) * 5;
    const moqN = [5, 10, 10, 20, 25, 50, 100][Math.floor(r() * 7)];
    const years = 2 + Math.floor(r() * 18);
    const name = `${h.prefix[Math.floor(r() * h.prefix.length)]} ${i % 3 === 0 ? words + " " : ""}${SUFFIX[Math.floor(r() * SUFFIX.length)]}`.replace(/\s+/g, " ");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return {
      name,
      city: h.city,
      url: `https://www.indiamart.com/${slug}/`,
      priceRange: `₹${lo} – ₹${hi} / piece`,
      moq: `${moqN} pieces`,
      gstVerified: r() > 0.2,
      trustSeal: r() > 0.6,
      yearsInBusiness: years,
      rating: Math.round((3.4 + r() * 1.5) * 10) / 10,
      source: "sample" as const,
      notes: "Sample listing (live IndiaMART lookup needs an Anthropic API key). Verify on IndiaMART before contacting.",
    };
  });
}

// ---------- outreach templates ----------

export type Channel = "whatsapp" | "email" | "indiamart";

export function outreachTemplate(opts: {
  product: Pick<Product, "name" | "sellingPrice">;
  supplier: Pick<Supplier, "name" | "city">;
  channel: Channel;
  teamName?: string;
}): string {
  const { product, supplier, channel } = opts;
  const named = opts.teamName?.trim();
  if (channel === "whatsapp") {
    return [
      `Namaste ${supplier.name} ji 🙏`,
      ``,
      `Main ${named ? named + " se" : "ek D2C brand ki taraf se"} baat kar raha hoon. Hum ek online D2C brand chala rahe hain aur IndiaMART pe aapka *${product.name}* dekha. Regular orders ke liye partner dhoond rahe hain.`,
      ``,
      `Kuch details chahiye thi:`,
      `1. Rate per piece – 10 / 50 / 100 pcs pe?`,
      `2. GST extra hai ya included? (GST bill milega?)`,
      `3. Kya aap seedha hamare customer ko dropship kar sakte ho? Blind / white-label packing (aapka naam/bill parcel mein nahi)?`,
      `4. COD orders handle karte ho ya sirf prepaid?`,
      `5. Order milne ke kitne din mein dispatch?`,
      `6. Sample ka cost kitna hoga?`,
      `7. Damage / return case mein kya policy hai?`,
      ``,
      `Shuru mein 5-10 orders/day expect kar rahe hain, aage badhega. Rate sahi raha toh is hafte se start karenge. Dhanyavaad!`,
    ].join("\n");
  }
  if (channel === "indiamart") {
    return [
      `Hi, we run an online D2C store${named ? ` (${named})` : ""} and want to source ${product.name} regularly.`,
      `Please share: rate per piece at 10/50/100 pcs, GST %, MOQ, dispatch time, and sample price.`,
      `Do you dropship directly to our customers with blind (unbranded) packing, and do you support COD orders?`,
      `Also, what is your policy for damaged/returned (RTO) parcels? Expecting 5-10 orders/day to start.`,
    ].join(" ");
  }
  return [
    `Subject: Dropshipping partnership enquiry – ${product.name}`,
    ``,
    `Dear ${supplier.name} team,`,
    ``,
    `We are ${named ? `${named}, ` : ""}an online D2C store in India, and we found your ${product.name} listing on IndiaMART. We are looking for a reliable supplier to fulfil our orders, starting at around 5–10 orders a day.`,
    ``,
    `Could you please share:`,
    `• Per-unit rate at 10, 50 and 100 pieces`,
    `• GST % (and whether you issue GST invoices)`,
    `• Whether you can dropship directly to our customers, with blind / white-label packaging`,
    `• Whether you support Cash-on-Delivery orders`,
    `• Dispatch time after order confirmation`,
    `• Sample price and shipping`,
    `• Your policy on damaged or returned (RTO) parcels`,
    ``,
    `If the terms work, we would like to place a sample order this week.`,
    ``,
    `Best regards,`,
    `${named || "Team, D2C Store"}`,
  ].join("\n");
}

// ---------- deterministic quote parser ----------

const num = (s: string | undefined) => (s ? Number(s.replace(/,/g, "")) : NaN);

function firstNum(text: string, patterns: RegExp[]): number | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = num(m[1]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

const NEG = "(?:nahi|nahin|nhi|nai|no|not|na|❌|cannot|can't|cant|won't|dont|don't|nahi hoga|available nahi)";

function yesNo(text: string, keyword: RegExp, defaultValue: boolean): boolean {
  const lines = text.split(/[\n.;,!]+/);
  for (const line of lines) {
    if (keyword.test(line)) {
      if (new RegExp(`\\b${NEG}\\b|❌`, "i").test(line)) return false;
      return true;
    }
  }
  return defaultValue;
}

export function computeLanded(q: Pick<Quote, "unitPrice" | "gstPercent" | "shippingPerUnit">) {
  return Math.round((q.unitPrice * (1 + (q.gstPercent || 0) / 100) + (q.shippingPerUnit || 0)) * 100) / 100;
}

export function parseQuoteText(raw: string): Quote {
  const t = raw.replace(/₹/g, "₹").replace(/rs\.?/gi, "₹").toLowerCase();

  const unitPrice =
    firstNum(t, [
      /(?:rate|price|cost|per\s*(?:pc|piece|pcs|unit)|@)\s*(?:is|hai|:|-|=)?\s*₹?\s*(\d[\d,]*(?:\.\d+)?)/,
      /₹\s*(\d[\d,]*(?:\.\d+)?)\s*(?:\/|per)\s*(?:pc|pcs|piece|unit)/,
      /(\d[\d,]*(?:\.\d+)?)\s*(?:₹|rupees|rupaye|rs)?\s*(?:\/|per)\s*(?:pc|pcs|piece|unit)/,
      /₹\s*(\d[\d,]*(?:\.\d+)?)/,
    ]) ?? 0;

  let gstPercent = firstNum(t, [/(\d[\d.]*)\s*%\s*gst/, /gst\s*(?:@|:|-|=)?\s*(\d[\d.]*)\s*%/, /gst\s*(\d[\d.]*)/]) ?? NaN;
  if (Number.isNaN(gstPercent)) {
    gstPercent = /gst\s*(?:incl|included|inclusive|sahit|ke saath)/.test(t) ? 0 : /gst/.test(t) ? 18 : 0;
  }
  if (/(?:incl|including|inclusive)\w*\s*(?:of\s*)?gst/.test(t) || /gst\s*(?:incl|included|inclusive)/.test(t)) gstPercent = 0;

  const moq = firstNum(t, [/moq\s*(?:is|hai|:|-|=)?\s*(\d[\d,]*)/, /minimum\s*(?:order)?\s*(?:qty|quantity)?\s*(?:is|hai|:|-)?\s*(\d[\d,]*)/, /(\d[\d,]*)\s*(?:pcs|pieces|pc)\s*(?:minimum|min|se kam nahi)/]) ?? 1;

  const shippingPerUnit =
    firstNum(t, [
      /(?:shipping|delivery|courier|freight)\s*(?:charge|charges|cost)?\s*(?:is|hai|:|-|=)?\s*₹?\s*(\d[\d,]*)/,
      /₹?\s*(\d[\d,]*)\s*(?:extra|alag)?\s*(?:for\s*)?(?:shipping|delivery|courier)/,
    ]) ?? 0;
  const freeShip = /(free\s*(?:shipping|delivery))|(shipping|delivery)\s*(?:free|included|inclusive)/.test(t);

  const dispatchDays =
    firstNum(t, [
      /dispatch\w*\s*(?:in|within|me|mein)?\s*(\d+)\s*(?:-\s*\d+\s*)?(?:days?|din|working)/,
      /(\d+)\s*(?:-\s*\d+\s*)?(?:days?|din)\s*(?:me|mein|in)?\s*(?:dispatch|ship|bhej)/,
      /(?:ship|bhej)\w*\s*(?:in|within|me|mein)?\s*(\d+)\s*(?:days?|din)/,
    ]) ?? (/same\s*day|aaj hi/.test(t) ? 0 : /next\s*day|kal/.test(t) ? 1 : 3);

  const samplePrice = firstNum(t, [/sample\s*(?:ka|price|cost|charge|charges)?\s*(?:is|hai|:|-|=)?\s*₹?\s*(\d[\d,]*)/]);

  const codSupported = yesNo(t, /\bcod\b|cash on delivery/, false);
  const dropshipSupported = yesNo(t, /drop\s*-?\s*ship|direct(?:ly)?\s*(?:to|customer)|customer ko (?:seedha|direct)|seedha customer/, /blind|customer/.test(t));
  const blindShipping = yesNo(t, /blind|white\s*-?\s*label|unbranded|without (?:our|bill|invoice|name)|bina naam/, false);

  const returnMatch = raw.match(/(?:return|damage|replace)[^\n.]*/i);
  const returnPolicy = returnMatch ? returnMatch[0].trim() : "Not mentioned — ask before finalising";

  const ship = freeShip ? 0 : shippingPerUnit;
  const notes: string[] = [];
  if (!unitPrice) notes.push("Couldn't find a unit price — check the reply.");
  if (!/cod|cash on delivery/.test(t)) notes.push("COD not mentioned.");
  if (!/dispatch|ship|bhej|din|days/.test(t)) notes.push("Dispatch time not mentioned (assumed 3 days).");

  const q: Quote = {
    unitPrice,
    moq,
    gstPercent,
    shippingPerUnit: ship,
    dispatchDays,
    dropshipSupported,
    codSupported,
    blindShipping,
    samplePrice,
    returnPolicy,
    notes: notes.join(" ") || "Parsed from supplier reply.",
    landedCost: 0,
  };
  q.landedCost = computeLanded(q);
  return q;
}

/** Example replies used for the demo "paste reply" button. */
export const SAMPLE_REPLIES = [
  "rate 180 + 18% gst, moq 20 pcs, dispatch 2 din me, cod nahi hoga, shipping 60 extra, blind ship kar denge. sample 250 ka padega. damage hua toh video bhejo replace karenge",
  "Sir price ₹165/pc GST included. MOQ 10 pieces. We do dropship direct to customer with blind packing, COD available (2% extra). Dispatch within 1 day. Delivery charges 75 per parcel. Return only for damage with unboxing video.",
  "Hello ji, 150 rs per piece, 5% gst extra. Minimum 50 pcs. Dispatch in 4 days. Cod not possible, only prepaid. Courier 55. Sample free if you order 50.",
];

/** Score a quote for a dropship team. Higher is better. Returns reasons for transparency. */
export function scoreQuote(q: Quote, profitPerOrder: number): { score: number; reasons: string[]; warnings: string[] } {
  let score = profitPerOrder;
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!q.dropshipSupported) {
    score -= 150;
    warnings.push("No direct dropship — you'd have to hold stock and ship yourselves");
  } else reasons.push("Dropships to customer");
  if (!q.codSupported) {
    score -= 60;
    warnings.push("No COD — ~70% of Indian first-time buyers want COD");
  } else reasons.push("Supports COD");
  if (q.blindShipping) reasons.push("Blind/white-label packing");
  else warnings.push("Parcel may carry supplier branding");
  if (q.dispatchDays > 3) {
    score -= (q.dispatchDays - 3) * 25;
    warnings.push(`Slow dispatch (${q.dispatchDays} days) raises cancellations & RTO`);
  } else reasons.push(`Fast dispatch (${q.dispatchDays}d)`);
  if (q.moq > 20) {
    score -= Math.min(120, (q.moq - 20) * 2);
    warnings.push(`High MOQ (${q.moq} pcs) locks up your budget`);
  } else reasons.push(`Low MOQ (${q.moq})`);
  return { score, reasons, warnings };
}
