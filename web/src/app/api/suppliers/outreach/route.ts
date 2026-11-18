import { NextResponse } from "next/server";
import * as z from "zod/v4";
import { aiJSON } from "@/lib/ai";
import { outreachTemplate, type Channel } from "@/lib/suppliers-demo";
import type { Product, Supplier } from "@/lib/types";

export const maxDuration = 60;

const Schema = z.object({ message: z.string() });

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    product?: Partial<Product>;
    supplier?: Partial<Supplier>;
    channel?: Channel;
    teamName?: string;
  };
  const product = { name: body.product?.name || "your product", sellingPrice: body.product?.sellingPrice || 0 };
  const supplier = { name: body.supplier?.name || "Supplier", city: body.supplier?.city || "" };
  const channel: Channel = body.channel === "email" || body.channel === "indiamart" ? body.channel : "whatsapp";
  const teamName = body.teamName;

  const style =
    channel === "whatsapp"
      ? "a WhatsApp message in natural Hinglish (Roman script), warm and respectful ('ji'), numbered questions, under 120 words"
      : channel === "indiamart"
        ? "an IndiaMART 'Contact Supplier' enquiry in simple English, one paragraph, under 80 words"
        : "a short professional email in English with a Subject line, bullet questions, under 170 words";

  const result = await aiJSON({
    schema: Schema,
    prompt: `Draft ${style} from a student D2C dropshipping team${teamName ? ` called "${teamName}"` : ""} to the IndiaMART supplier "${supplier.name}"${supplier.city ? ` in ${supplier.city}` : ""} about "${product.name}".
Sound like a credible, serious small business (expect 5-10 orders/day to start), not a student project. Ask for: per-unit rate at 10/50/100 pcs, GST % and GST bill, whether they dropship directly to our customers, blind/white-label packing, COD support, dispatch time, sample cost, and damage/return (RTO) policy. Return only the message text.`,
    fallback: () => ({ message: outreachTemplate({ product, supplier, channel, teamName }) }),
  });

  return NextResponse.json({ message: result.data.message, source: result.source, error: result.error });
}
