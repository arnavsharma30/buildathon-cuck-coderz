import * as z from "zod/v4";
import { aiJSON } from "@/lib/ai";
import { fallbackCreatives, type Language } from "@/lib/ads";
import type { Product } from "@/lib/types";

const CreativeSchema = z.object({
  angle: z.string(),
  hook: z.string(),
  primaryText: z.string(),
  headline: z.string(),
  cta: z.string(),
  reelScript: z.array(z.string()),
  visualIdea: z.string(),
});
const Out = z.object({ creatives: z.array(CreativeSchema) });

export async function POST(req: Request) {
  const body = (await req.json()) as { product?: Product; language?: Language; count?: number };
  const product = body.product;
  if (!product?.name) return Response.json({ error: "product is required" }, { status: 400 });
  const language: Language = body.language ?? "Hinglish";
  const count = Math.min(Math.max(body.count ?? 4, 1), 5);

  const prompt = `Write ${count} Meta (Instagram/Facebook) ad creatives for this dropshipping product, in ${language}${
    language === "Hinglish" ? " (Hindi words in Roman script mixed with English, the way Indian Instagram talks)" : ""
  }.

Product: ${product.name}
Category: ${product.category}
Why it sells: ${product.why}
Target audience: ${product.targetAudience}
Selling price: ₹${product.sellingPrice}

Rules:
- Each creative uses a DIFFERENT angle, chosen from: Problem → Solution, Before/After, Gift/Festive, UGC unboxing, Price anchor (e.g. "Amazon pe ₹1499, yahan ₹699"), Social proof.
- hook: what is said/shown in the first 3 seconds, max 12 words, must stop the scroll.
- primaryText: 3-6 short lines with a few emojis, end with trust lines for Indian COD buyers (Cash on Delivery, free shipping, easy replacement).
- headline: max 40 characters. cta: a Meta CTA button label such as "Shop now".
- reelScript: 5-6 shots for a 20-25s vertical Reel, each "0-3s: ..." style.
- visualIdea: one sentence describing the static image/thumbnail.
- Don't claim fake certifications or medical benefits. If you use social proof, tell the team to replace it with real reviews.`;

  const result = await aiJSON({
    schema: Out,
    prompt,
    fallback: () => ({ creatives: fallbackCreatives(product, language, count) }),
    effort: "low",
  });

  const creatives = result.data.creatives.slice(0, count).map((c) => ({ ...c, language }));
  return Response.json({ creatives, source: result.source, error: result.error });
}
