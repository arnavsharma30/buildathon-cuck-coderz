import * as z from "zod/v4";
import { aiJSON } from "@/lib/ai";
import { fallbackSiteContent } from "@/lib/site";
import type { Product, SiteContent } from "@/lib/types";

const SiteSchema = z.object({
  brandName: z.string(),
  tagline: z.string(),
  announcement: z.string(),
  hero: z.object({ headline: z.string(), subheadline: z.string(), cta: z.string(), badge: z.string() }),
  benefits: z.array(z.object({ icon: z.string(), title: z.string(), text: z.string() })),
  howItWorks: z.array(z.object({ title: z.string(), text: z.string() })),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  offerBullets: z.array(z.string()),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  guarantee: z.string(),
  footerNote: z.string(),
});

export async function POST(req: Request) {
  const { product, brandName, language = "Hinglish", theme = "fresh" } = (await req.json()) as {
    product?: Product;
    brandName?: string;
    language?: "English" | "Hinglish" | "Hindi";
    theme?: string;
  };
  if (!product?.name) return Response.json({ error: "product is required" }, { status: 400 });

  const fallback = fallbackSiteContent(product, { brandName, language });

  const res = await aiJSON({
    schema: SiteSchema,
    effort: "low",
    fallback: () => ({ ...fallback, offerBullets: fallback.offer.bullets, hero: { ...fallback.hero, badge: fallback.hero.badge ?? "" } }),
    prompt: `Write the copy for a single-product Indian D2C store landing page (Shopify-style, mobile-first, COD-friendly).

Product: ${product.name}
Category: ${product.category}
Why it sells: ${product.why}
Target audience: ${product.targetAudience}
Description from the team: ${product.description || "(none)"}
Options/variants: ${product.variants?.join(", ") || "(none)"}
Price: ₹${product.sellingPrice}${product.compareAtPrice ? ` (MRP ₹${product.compareAtPrice})` : ""}
Brand name: ${brandName?.trim() || "(suggest a short, memorable brand name)"}
Language: ${language} (Hinglish = natural Roman-script Hindi-English mix that Indian Instagram shoppers use). Visual theme: ${theme}.

Return:
- announcement: one short top-bar line (shipping/COD)
- hero: punchy headline (max 8 words), subheadline (1-2 sentences, concrete benefit), CTA button text (max 4 words, mention COD if natural), badge (2-3 words)
- benefits: exactly 4, each with ONE emoji icon, a 2-4 word title and one sentence
- howItWorks: exactly 3 steps: order with COD → WhatsApp confirmation → delivery in 3-6 days
- specs: 4-6 label/value rows that are plausible for this product (no invented certifications)
- offerBullets: 3 bullets from ONLY these policies: Cash on Delivery, free shipping across India, 7-day replacement for damaged/wrong items
- faq: exactly 5 (COD, delivery time, damaged item/replacement, how to use or sizing, order confirmation on WhatsApp)
- guarantee: one line about the 7-day replacement
- footerNote: short copyright line with the brand name

HARD RULES: Do not invent customer reviews, star ratings, customer counts ("10,000+ happy customers"), sales numbers, awards, certifications, countdown timers or fake scarcity. No medical claims or guaranteed results. Keep claims modest and true for a typical product of this kind.`,
  });

  const d = res.data;
  const content: SiteContent = {
    brandName: d.brandName || fallback.brandName,
    tagline: d.tagline,
    announcement: d.announcement,
    hero: { headline: d.hero.headline, subheadline: d.hero.subheadline, cta: d.hero.cta, badge: d.hero.badge || undefined },
    benefits: d.benefits.slice(0, 6),
    howItWorks: d.howItWorks.slice(0, 4),
    specs: d.specs.slice(0, 8),
    offer: { price: product.sellingPrice, compareAtPrice: product.compareAtPrice, bullets: d.offerBullets.slice(0, 4) },
    faq: d.faq.slice(0, 8),
    guarantee: d.guarantee,
    reviews: [], // never generated: only the team's real reviews go here
    footerNote: d.footerNote,
  };
  return Response.json({ content, source: res.source, ...(res.error ? { error: res.error } : {}) });
}
