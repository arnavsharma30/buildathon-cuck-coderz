import * as z from "zod/v4";
import { aiJSON } from "@/lib/ai";
import { demoProducts } from "@/lib/products-demo";

const ProductIdeaSchema = z.object({
  name: z.string(),
  category: z.string(),
  why: z.string().describe("One or two sentences: why this can sell in India right now, and the visual Reel hook"),
  targetAudience: z.string(),
  sourcingCost: z.number().describe("Estimated IndiaMART wholesale price per unit in INR"),
  sellingPrice: z.number().describe("Suggested store price in INR"),
  shippingCost: z.number().describe("Forward shipping per order in INR via Shiprocket/Delhivery"),
  scores: z.object({
    demand: z.number().describe("0-10"),
    margin: z.number().describe("0-10"),
    rtoRisk: z.number().describe("0-10, higher = more likely to be refused on COD delivery"),
    competition: z.number().describe("0-10, higher = more saturated on Meta/Amazon/Meesho"),
    wow: z.number().describe("0-10, thumb-stopping power in a 15s Reel"),
  }),
  risks: z.array(z.string()).describe("2-3 concrete risks for a first-time team"),
  indiamartQuery: z.string().describe("Short search phrase to find wholesalers on IndiaMART"),
});

const ResponseSchema = z.object({ products: z.array(ProductIdeaSchema) });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { niche?: string; budget?: number; audience?: string };
  const niche = (body.niche ?? "").slice(0, 200);
  const audience = (body.audience ?? "").slice(0, 200);
  const budget = Number(body.budget) || 25000;

  const prompt = `Suggest exactly 5 products a Masters' Union student team can dropship in India in the next 4 weeks.

Team inputs:
- Niche / interest: ${niche || "open, anything that works"}
- Target audience: ${audience || "your recommendation"}
- Total Meta ads budget: ₹${budget.toLocaleString("en-IN")}

Hard constraints (beginners get killed by these):
- Sourceable from Indian wholesalers on IndiaMART, ships direct to customer (no inventory)
- Light, non-fragile, no size/fit variance, no electricity-safety or medical claims
- Sweet spot price ₹399-₹1499 with at least 3x markup on landed cost
- Demonstrable in a 15-second Reel without voiceover
- Reasonable COD RTO risk (avoid pure impulse buys that customers refuse at the door)

Scores are honest estimates on a 0-10 scale. Prices in INR.`;

  const result = await aiJSON({
    schema: ResponseSchema,
    prompt,
    effort: "low",
    fallback: () => ({ products: demoProducts(niche, audience, 5) }),
  });

  const products = result.data.products.slice(0, 5).map((p) => ({
    ...p,
    sourcingCost: Math.round(p.sourcingCost),
    sellingPrice: Math.round(p.sellingPrice),
    shippingCost: Math.round(p.shippingCost),
    scores: Object.fromEntries(
      Object.entries(p.scores).map(([k, v]) => [k, Math.max(0, Math.min(10, Math.round(v)))]),
    ) as typeof p.scores,
  }));

  return Response.json({ products, source: result.source, error: result.error });
}
