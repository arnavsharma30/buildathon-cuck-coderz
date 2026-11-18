// Deterministic helpers for the Creatives and Meta Ads modules:
// fallback generators (used when Claude is unavailable) and the kill/scale decision engine.
import type { AdSetRow, Creative, Product } from "./types";

export type CreativeDraft = Omit<Creative, "id" | "productId" | "createdAt">;
export type Language = Creative["language"];

export interface AdPlanAdset {
  name: string;
  audience: string;
  dailyBudget: number;
  creativeAngle: string;
}

export interface AdPlan {
  objective: string;
  campaignStructure: string;
  adsets: AdPlanAdset[];
  rules: string[];
  checklist: string[];
}

const r = (n: number) => Math.round(n);
const inr = (n: number) => "₹" + r(n).toLocaleString("en-IN");

/* ------------------------------------------------------------------ */
/* Fallback creatives                                                   */
/* ------------------------------------------------------------------ */

export function fallbackCreatives(p: Product, language: Language, count = 4): CreativeDraft[] {
  const anchor = r((p.sellingPrice * 2.1) / 100) * 100 - 1; // fake "market" price anchor
  const aud = p.targetAudience || "you";
  const hi = language !== "English";
  const trust = hi
    ? "✅ Cash on Delivery available\n🚚 Free shipping all over India\n↩️ Easy 7-day replacement"
    : "✅ Cash on Delivery available\n🚚 Free shipping across India\n↩️ Easy 7-day replacement";

  const all: CreativeDraft[] = [
    {
      angle: "Problem → Solution",
      hook: hi ? `Roz ki ye problem? ${p.name} ne solve kar di 😮` : `Still struggling with this every day? Watch this 😮`,
      primaryText: hi
        ? `Bas ek ${p.name} aur life easy! 🙌\n${p.why}\n\nSirf ${inr(p.sellingPrice)} mein — limited stock.\n${trust}`
        : `One ${p.name} and the daily hassle is gone 🙌\n${p.why}\n\nJust ${inr(p.sellingPrice)}, limited stock.\n${trust}`,
      headline: hi ? `${p.name} – sirf ${inr(p.sellingPrice)}` : `${p.name} for just ${inr(p.sellingPrice)}`,
      cta: "Shop now",
      reelScript: [
        "0-3s: Close-up of the frustrating everyday problem (text overlay: the hook)",
        `3-6s: Hand reveals the ${p.name}, quick zoom-in`,
        "6-12s: Product solving the problem in one smooth take",
        "12-18s: 2-3 rapid feature cuts with on-screen captions",
        `18-22s: Price card ${inr(p.sellingPrice)} + "COD available" badge`,
        "22-25s: CTA: 'Order now, link in bio / tap Shop Now'",
      ],
      visualIdea: `Split frame: messy 'before' on the left, ${p.name} in use on the right, bold yellow caption.`,
      language,
    },
    {
      angle: "Price anchor",
      hook: hi ? `Amazon pe ${inr(anchor)}, yahan sirf ${inr(p.sellingPrice)} 🤯` : `Others charge ${inr(anchor)}. We charge ${inr(p.sellingPrice)} 🤯`,
      primaryText: hi
        ? `Same quality, aadhi keemat. 💸\n${p.name}, direct factory se aapke ghar tak.\n\n${trust}`
        : `Same quality, half the price 💸\n${p.name}, straight from the factory to your door.\n\n${trust}`,
      headline: hi ? `Aaj hi order karein – ${inr(p.sellingPrice)}` : `Today only: ${inr(p.sellingPrice)}`,
      cta: "Shop now",
      reelScript: [
        `0-3s: Screenshot-style card '${inr(anchor)}' getting slashed in red`,
        `3-6s: Our price ${inr(p.sellingPrice)} pops in with a sound effect`,
        "6-12s: Unboxing showing it's the same product",
        "12-18s: Product in use, 2 quick angles",
        "18-22s: 'COD + Free shipping' trust badges",
        "22-25s: CTA with countdown sticker 'Offer ends tonight'",
      ],
      visualIdea: "Strike-through competitor price in red, our price huge in green, product cut-out on white.",
      language,
    },
    {
      angle: "UGC unboxing",
      hook: hi ? `Maine ${inr(p.sellingPrice)} mein ye mangaya… honest review 👇` : `I ordered this for ${inr(p.sellingPrice)}… honest review 👇`,
      primaryText: hi
        ? `"Socha tha bekaar hoga, but sach mein kaam karta hai!" ⭐⭐⭐⭐⭐\nPerfect for ${aud}.\n\n${trust}`
        : `"I thought it'd be a gimmick, but it actually works!" ⭐⭐⭐⭐⭐\nPerfect for ${aud}.\n\n${trust}`,
      headline: hi ? "Log pagal ho rahe hain iske liye" : "Everyone's ordering this right now",
      cta: "Shop now",
      reelScript: [
        "0-3s: Selfie-cam, creator holding the sealed parcel, says the hook",
        "3-8s: Unboxing ASMR: tape, box, first look",
        "8-15s: First use, genuine reaction",
        "15-20s: 'What I like / what I didn't' quick list",
        "20-25s: 'Link is in the ad, they do COD too' + point down",
      ],
      visualIdea: "Phone-shot vertical video, natural light, creator's face + product, captions in Instagram font.",
      language,
    },
    {
      angle: "Gift / Festive",
      hook: hi ? `Gift ka idea nahi mil raha? Ye dekho 🎁` : `Stuck on a gift idea? Look at this 🎁`,
      primaryText: hi
        ? `Birthday, anniversary ya festive season, ${p.name} sabko pasand aata hai. 🎁\nGift-ready packing.\n\n${trust}`
        : `Birthdays, anniversaries, festive season: everyone loves a ${p.name} 🎁\nGift-ready packing.\n\n${trust}`,
      headline: hi ? "Perfect gift, ghar tak delivery" : "The gift they'll actually use",
      cta: "Shop now",
      reelScript: [
        "0-3s: Gift box being handed over, surprised face",
        `3-8s: Box opens, ${p.name} revealed with fairy lights in background`,
        "8-14s: Receiver using it happily",
        "14-20s: 'Under ₹" + r(p.sellingPrice + 1) + "' text + gift-wrap shot",
        "20-25s: CTA: 'Order today, delivered before the occasion'",
      ],
      visualIdea: "Warm festive palette, diyas/fairy lights, product inside an open gift box.",
      language,
    },
    {
      angle: "Social proof",
      hook: hi ? `10,000+ logon ne ye already try kiya hai 🔥` : `Why is everyone in India buying this? 🔥`,
      primaryText: hi
        ? `Reviews khud bolte hain ⭐ 4.6/5\n"Paisa vasool!" – Neha, Pune\n"Best purchase of the month" – Rahul, Jaipur\n\n${trust}`
        : `The reviews speak ⭐ 4.6/5\n"Totally worth it!" – Neha, Pune\n"Best buy of the month" – Rahul, Jaipur\n\n${trust}`,
      headline: hi ? "Trending in India 🔥" : "Trending across India 🔥",
      cta: "Shop now",
      reelScript: [
        "0-3s: Fast montage of 4 different people using it",
        "3-10s: Review screenshots sliding in",
        "10-16s: Product hero shot, rotating",
        "16-20s: '★ 4.6 rated' badge + COD badge",
        "20-25s: CTA",
      ],
      visualIdea: "Collage of customer photos with star ratings overlaid. Replace with your REAL reviews before running.",
      language,
    },
  ];
  return all.slice(0, Math.max(1, Math.min(count, all.length)));
}

/* ------------------------------------------------------------------ */
/* Fallback campaign plan                                               */
/* ------------------------------------------------------------------ */

export function fallbackPlan(p: Product, angles: string[], dailyBudget: number, breakEvenCpa: number): AdPlan {
  const useAngles = angles.length ? angles : ["Problem → Solution", "Price anchor", "UGC unboxing"];
  const audiences = [
    `Broad (Advantage+ audience), India, 18-40, all genders; let the creative do the targeting`,
    `Interest stack: ${p.category} + online shopping + engaged shoppers, Tier 1+2 cities, 21-38`,
    `Lookalike-ready: Instagram engagers + website visitors (retarget ATC, 7 days) once the pixel has 50+ events`,
  ];
  const n = 3;
  const per = r(dailyBudget / n);
  return {
    objective: "Sales (Conversions → Purchase), optimised on the Shopify pixel + Conversions API",
    campaignStructure: `1 ABO testing campaign · ${n} ad sets × ${Math.min(3, useAngles.length)} creatives each · ${inr(per)}/day per ad set · let it run 3 days before judging results · winners move to a CBO scaling campaign`,
    adsets: audiences.map((a, i) => ({
      name: `T${i + 1} | ${["Broad", "Interest", "Retarget"][i]} | ${useAngles[i % useAngles.length]}`,
      audience: a,
      dailyBudget: per,
      creativeAngle: useAngles[i % useAngles.length],
    })),
    rules: [
      `Break-even CPA for this product is ${inr(breakEvenCpa)}; every rule below is measured against it.`,
      `KILL an ad set that spends ${inr(breakEvenCpa * 1.5)} (1.5× BE-CPA) with zero purchases.`,
      `KILL / swap creative if CTR (link) < 0.8% after 1,000+ impressions: the hook isn't stopping the scroll.`,
      `WAIT if spend < 1× BE-CPA: not enough data, don't touch it (no edits in the learning phase).`,
      `SCALE +20% budget/day when CPA < 0.7× BE-CPA for 2 days running; never jump more than 20-30% at once.`,
      `If ATC is high but purchases are low → fix the store (price, COD option, trust badges, page speed), not the ad.`,
      `Judge on RTO-adjusted ROAS: a COD order is not revenue until it's delivered.`,
    ],
    checklist: [
      "Install the Meta pixel via the Facebook & Instagram Shopify app (turns on Conversions API automatically)",
      "Verify your store domain in Business Manager → Brand safety → Domains",
      "Set up Aggregated Event Measurement: Purchase as the top-priority event",
      "Business Manager + Ad account in INR, IST timezone, payment method added",
      "Connect the Instagram page; post 6-9 organic posts so the page looks real",
      "Enable COD + partial-prepaid on Shopify checkout, with a WhatsApp COD confirmation flow",
      "Product catalog synced (for later Advantage+ catalog ads)",
      "UTM parameters on every ad: utm_source=meta&utm_campaign={{campaign.name}}",
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Metrics + decision engine                                            */
/* ------------------------------------------------------------------ */

export interface AdMetrics {
  ctr: number; // fraction
  cpc: number;
  cpm: number;
  costPerAtc: number;
  cpa: number;
  roas: number;
  rtoRoas: number;
  profit: number; // RTO-adjusted, after ad spend
}

export function adMetrics(a: AdSetRow, sellingPrice: number, deliveredRate: number, profitBeforeAds: number): AdMetrics {
  const div = (x: number, y: number) => (y > 0 ? x / y : 0);
  return {
    ctr: div(a.clicks, a.impressions),
    cpc: div(a.spend, a.clicks),
    cpm: div(a.spend, a.impressions) * 1000,
    costPerAtc: div(a.spend, a.addToCarts),
    cpa: div(a.spend, a.purchases),
    roas: div(a.purchases * sellingPrice, a.spend),
    rtoRoas: div(a.purchases * sellingPrice * deliveredRate, a.spend),
    profit: a.purchases * profitBeforeAds - a.spend,
  };
}

export type Verdict = "KILL" | "WAIT" | "KEEP" | "SCALE";
export interface Decision {
  verdict: Verdict;
  reasons: string[];
  newBudget?: number;
}

/** Standard media-buyer rules, measured against the product's break-even CPA. */
export function decide(a: AdSetRow, m: AdMetrics, breakEvenCpa: number): Decision {
  const be = Math.max(1, breakEvenCpa);
  const reasons: string[] = [];

  if (breakEvenCpa <= 0) {
    return { verdict: "KILL", reasons: ["Product loses money even with zero ad spend: fix price/cost/RTO before running ads."] };
  }
  if (a.spend <= 0 || a.impressions <= 0) {
    return { verdict: "WAIT", reasons: ["No delivery yet."] };
  }
  if (a.purchases === 0 && a.spend >= 1.5 * be) {
    reasons.push(`Spent ${inr(a.spend)} (≥1.5× BE-CPA ${inr(be)}) with 0 purchases.`);
    if (a.impressions >= 1000 && m.ctr < 0.008) reasons.push(`CTR ${(m.ctr * 100).toFixed(2)}%: the hook isn't working.`);
    else if (a.addToCarts > 0) reasons.push(`${a.addToCarts} ATCs but no purchase: check store, price and COD option.`);
    return { verdict: "KILL", reasons };
  }
  if (a.impressions >= 1000 && m.ctr < 0.008 && a.purchases <= 1) {
    return {
      verdict: "KILL",
      reasons: [`CTR ${(m.ctr * 100).toFixed(2)}% after ${a.impressions.toLocaleString("en-IN")} impressions (< 0.8%). Swap the creative hook.`],
    };
  }
  if (a.purchases > 0 && m.cpa > 1.3 * be && a.spend >= 2 * be) {
    return { verdict: "KILL", reasons: [`CPA ${inr(m.cpa)} is ${(m.cpa / be).toFixed(1)}× break-even after meaningful spend.`] };
  }
  if (a.spend < be) {
    reasons.push(`Only ${inr(a.spend)} spent (< 1× BE-CPA). Let it exit learning.`);
    if (a.impressions >= 1000 && m.ctr >= 0.015) reasons.push(`Strong CTR ${(m.ctr * 100).toFixed(2)}%, promising.`);
    return { verdict: "WAIT", reasons };
  }
  if (a.purchases >= 2 && m.cpa > 0 && m.cpa < 0.7 * be) {
    const newBudget = r(a.dailyBudget * 1.2);
    return {
      verdict: "SCALE",
      reasons: [`CPA ${inr(m.cpa)} is ${Math.round((1 - m.cpa / be) * 100)}% under break-even. +20% budget → ${inr(newBudget)}/day.`],
      newBudget,
    };
  }
  if (a.purchases > 0 && m.cpa <= be) {
    return { verdict: "KEEP", reasons: [`Profitable: CPA ${inr(m.cpa)} ≤ BE-CPA ${inr(be)}. Hold budget, test a new creative alongside.`] };
  }
  if (a.purchases > 0) {
    return { verdict: "WAIT", reasons: [`CPA ${inr(m.cpa)} slightly above break-even ${inr(be)}. Give it one more day.`] };
  }
  return { verdict: "WAIT", reasons: [`No purchase yet at ${inr(a.spend)} spend. Kill at ${inr(1.5 * be)}.`] };
}

/* ------------------------------------------------------------------ */
/* Demo simulator                                                       */
/* ------------------------------------------------------------------ */

/**
 * Plausible 3-day results for an Indian Meta test (CPM ₹80-200, CTR 0.4-3%).
 * Each ad set gets a different "personality" calibrated to the product's break-even CPA,
 * so a demo shows a winner (SCALE), a dud hook (KILL) and a borderline one (KEEP/WAIT).
 */
export function simulate(a: AdSetRow, sellingPrice: number, idx: number, breakEvenCpa?: number): AdSetRow {
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const be = breakEvenCpa && breakEvenCpa > 0 ? breakEvenCpa : sellingPrice * 0.35;
  const profiles = [
    { ctr: [1.8, 2.8], cpaX: [0.45, 0.62] }, // winner
    { ctr: [0.4, 0.75], cpaX: [0, 0] }, // dud hook: no orders
    { ctr: [1.0, 1.6], cpaX: [0.82, 0.98] }, // borderline
  ];
  const pr = profiles[idx % profiles.length];
  const spend = r(a.dailyBudget * 3 * rand(0.9, 1.0));
  const impressions = r((spend / rand(80, 200)) * 1000);
  const clicks = r(impressions * (rand(pr.ctr[0], pr.ctr[1]) / 100));
  const purchases = pr.cpaX[1] === 0 ? 0 : Math.max(1, r(spend / (be * rand(pr.cpaX[0], pr.cpaX[1]))));
  const addToCarts = Math.min(clicks, Math.max(purchases + (pr.cpaX[1] === 0 ? r(rand(1, 4)) : 0), r(purchases / rand(0.3, 0.45))));
  return { ...a, spend, impressions, clicks: Math.max(clicks, addToCarts), addToCarts, purchases };
}
