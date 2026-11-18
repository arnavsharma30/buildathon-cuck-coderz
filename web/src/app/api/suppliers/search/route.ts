import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import * as z from "zod/v4";
import { aiJSON, client, DROPSHIP_SYSTEM, hasAI, MODEL } from "@/lib/ai";
import { sampleSuppliers, type SupplierLead } from "@/lib/suppliers-demo";

export const maxDuration = 120;

const LeadSchema = z.object({
  suppliers: z.array(
    z.object({
      name: z.string(),
      city: z.string(),
      url: z.string().describe("IndiaMART listing or company page URL, empty string if unknown"),
      priceRange: z.string().describe("e.g. '₹150 – ₹220 / piece', empty string if not shown"),
      moq: z.string().describe("e.g. '10 pieces', empty string if not shown"),
      gstVerified: z.boolean(),
      trustSeal: z.boolean(),
      yearsInBusiness: z.number().describe("0 if unknown"),
      rating: z.number().describe("0-5, 0 if unknown"),
      notes: z.string().describe("one line: what they sell / anything notable"),
    }),
  ),
});

async function liveSearch(query: string, productName: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Find 5-8 real wholesale suppliers on IndiaMART (indiamart.com) for: "${query}" (product: ${productName}).
For each supplier give: company name, city, price range per piece, MOQ, GST verified / TrustSEAL if the listing shows it, years in business if shown, rating if shown, and the listing URL.
Prefer suppliers that look like they could ship single orders (dropshipping) and are in major wholesale hubs. Only report suppliers you actually found in search results.`,
    },
  ];
  let text = "";
  for (let i = 0; i < 4; i++) {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: DROPSHIP_SYSTEM,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", allowed_domains: ["indiamart.com"], max_uses: 4 }],
      output_config: { effort: "low" },
    });
    text += res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  return text;
}

export async function POST(req: Request) {
  const { query = "", productName = "", priceHint } = (await req.json().catch(() => ({}))) as {
    query?: string;
    productName?: string;
    priceHint?: number;
  };
  const q = String(query || productName).trim();
  if (!q) return NextResponse.json({ error: "query is required" }, { status: 400 });

  const fallback = () => sampleSuppliers(q, priceHint);

  if (!hasAI()) return NextResponse.json({ suppliers: fallback(), source: "sample" });

  try {
    const found = await liveSearch(q, productName || q);
    if (!found.trim()) throw new Error("web search returned no text");
    const structured = await aiJSON({
      schema: LeadSchema,
      prompt: `Convert these IndiaMART search findings into structured supplier records. Only include suppliers present in the findings; do not invent any.\n\n${found}`,
      fallback: () => ({ suppliers: [] }),
    });
    const suppliers: SupplierLead[] = structured.data.suppliers.map((s) => ({
      name: s.name,
      city: s.city,
      url: s.url || undefined,
      priceRange: s.priceRange || undefined,
      moq: s.moq || undefined,
      gstVerified: s.gstVerified,
      trustSeal: s.trustSeal,
      yearsInBusiness: s.yearsInBusiness || undefined,
      rating: s.rating || undefined,
      notes: s.notes,
      source: "indiamart-live",
    }));
    if (structured.source !== "claude" || suppliers.length === 0) throw new Error(structured.error || "no suppliers extracted");
    return NextResponse.json({ suppliers, source: "indiamart-live" });
  } catch (e) {
    console.error("[suppliers/search] falling back to sample data:", e);
    return NextResponse.json({
      suppliers: fallback(),
      source: "sample",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
