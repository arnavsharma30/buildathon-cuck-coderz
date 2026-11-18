import { NextResponse } from "next/server";
import * as z from "zod/v4";
import { aiJSON } from "@/lib/ai";
import { computeLanded, parseQuoteText } from "@/lib/suppliers-demo";
import type { Quote } from "@/lib/types";

export const maxDuration = 60;

const QuoteSchema = z.object({
  unitPrice: z.number().describe("INR per unit EXCLUDING GST. If the supplier says GST included, give the inclusive price and gstPercent 0"),
  moq: z.number().describe("minimum order quantity in pieces, 1 if not mentioned"),
  gstPercent: z.number().describe("GST % charged on top of unitPrice; 0 if included or not charged"),
  shippingPerUnit: z.number().describe("INR shipping/courier charge per order to the end customer, 0 if free or included"),
  dispatchDays: z.number().describe("days to dispatch after order; 3 if not mentioned"),
  dropshipSupported: z.boolean().describe("ships directly to our end customers"),
  codSupported: z.boolean().describe("handles Cash on Delivery orders"),
  blindShipping: z.boolean().describe("unbranded / white-label packing without supplier invoice"),
  samplePrice: z.number().describe("INR sample cost, 0 if not mentioned or free"),
  returnPolicy: z.string().describe("short summary of damage/return/RTO policy, or 'Not mentioned'"),
  notes: z.string().describe("anything missing or risky the team should ask about next, one or two short sentences"),
});

export async function POST(req: Request) {
  const { rawReply = "", productName = "" } = (await req.json().catch(() => ({}))) as { rawReply?: string; productName?: string };
  if (!rawReply.trim()) return NextResponse.json({ error: "rawReply is required" }, { status: 400 });

  const result = await aiJSON({
    schema: QuoteSchema,
    prompt: `Extract the quotation from this IndiaMART supplier's reply${productName ? ` about "${productName}"` : ""}. Replies are often messy Hinglish (e.g. "din" = days, "nahi" = no, "kar denge" = will do).
Supplier reply:
"""
${rawReply}
"""`,
    fallback: () => {
      const { landedCost: _landed, ...rest } = parseQuoteText(rawReply);
      void _landed;
      return { ...rest, samplePrice: rest.samplePrice ?? 0 };
    },
  });

  const d = result.data;
  const quote: Quote = { ...d, samplePrice: d.samplePrice || undefined, landedCost: computeLanded(d) };
  return NextResponse.json({ quote, source: result.source, error: result.error });
}
