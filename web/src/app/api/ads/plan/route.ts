import * as z from "zod/v4";
import { aiJSON } from "@/lib/ai";
import { fallbackPlan } from "@/lib/ads";
import type { Product } from "@/lib/types";

const PlanSchema = z.object({
  objective: z.string(),
  campaignStructure: z.string(),
  adsets: z.array(
    z.object({
      name: z.string(),
      audience: z.string(),
      dailyBudget: z.number(),
      creativeAngle: z.string(),
    }),
  ),
  rules: z.array(z.string()),
  checklist: z.array(z.string()),
});

export async function POST(req: Request) {
  const body = (await req.json()) as { product?: Product; creatives?: string[]; dailyBudget?: number; breakEvenCpa?: number };
  const product = body.product;
  if (!product?.name) return Response.json({ error: "product is required" }, { status: 400 });
  const dailyBudget = Math.max(300, Math.round(body.dailyBudget ?? 1500));
  const be = Math.round(body.breakEvenCpa ?? 0);
  const angles = (body.creatives ?? []).filter(Boolean);

  const prompt = `Plan a first Meta ads testing campaign for a student dropshipping store in India.

Product: ${product.name} (${product.category}), selling price ₹${product.sellingPrice}
Target audience: ${product.targetAudience}
Creative angles available: ${angles.length ? angles.join(", ") : "none yet; suggest 3"}
Total daily budget: ₹${dailyBudget}
Break-even CPA (max ad spend per order before losing money, after RTO): ₹${be}

Return:
- objective: the campaign objective and optimisation event.
- campaignStructure: one or two sentences (ABO vs CBO, ad sets × ads, how long to test).
- adsets: exactly 3 ad sets. dailyBudget values in INR must add up to ₹${dailyBudget}. audience must be India-specific (geo/tier, age, gender, interests or Advantage+ broad). creativeAngle must be one of the available angles if any.
- rules: 5-7 kill/scale rules expressed against the break-even CPA of ₹${be} (spend thresholds, CTR floor, when to scale and by how much, what to do if ATC is high but purchases low).
- checklist: 6-8 setup steps before launch (pixel + Conversions API via the Shopify app, domain verification, event priority, COD confirmation, catalog, UTMs).`;

  const result = await aiJSON({
    schema: PlanSchema,
    prompt,
    fallback: () => fallbackPlan(product, angles, dailyBudget, be),
    effort: "low",
  });
  return Response.json({ plan: result.data, source: result.source, error: result.error });
}
