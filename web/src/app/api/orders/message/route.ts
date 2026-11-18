import * as z from "zod/v4";
import { aiJSON } from "@/lib/ai";
import type { Order } from "@/lib/types";

// Drafts the WhatsApp message an operator sends before shipping a risky COD order.
const Schema = z.object({ message: z.string() });

type Kind = "ship" | "confirm" | "prepaid" | "call-advance" | "hold";

export async function POST(req: Request) {
  const { order, productName, storeName, kind, reasons } = (await req.json()) as {
    order: Order;
    productName?: string;
    storeName?: string;
    kind: Kind;
    reasons?: string[];
  };
  const store = storeName || "our store";
  const product = productName || "your order";
  const first = (order.customerName || "").split(" ")[0] || "there";

  const fallback = () => ({ message: template(kind, { first, store, product, order }) });

  const result = await aiJSON({
    schema: Schema,
    fallback,
    prompt: `Write ONE WhatsApp message (Hinglish, warm, short, max 70 words, 1-2 emojis) from the Indian D2C store "${store}" to customer ${order.customerName} about order ${order.id} for "${product}" (₹${order.amount}, ${order.payment}, ${order.city} ${order.pincode}).
Goal: ${GOALS[kind]}
Risk signals we noticed (do NOT mention them or sound suspicious): ${(reasons ?? []).join("; ") || "none"}.
Include clear reply options (e.g. "Reply 1 to confirm"). No links except the placeholder [UPI_LINK] when asking for payment.`,
  });
  return Response.json(result);
}

const GOALS: Record<Kind, string> = {
  ship: "confirm the order and set delivery expectations (3-5 days), ask them to keep cash/UPI ready.",
  confirm: "get an explicit confirmation before we ship.",
  prepaid: "confirm the order AND offer ₹50 off if they pay now via UPI instead of COD.",
  "call-advance": "confirm the order and ask for a small ₹99 advance via UPI to reserve dispatch (balance on delivery).",
  hold: "politely ask them to confirm their full address with house number + landmark and a working phone number before we can dispatch.",
};

function template(kind: Kind, v: { first: string; store: string; product: string; order: Order }) {
  const head = `Hi ${v.first}! 👋 ${v.store} here. Thanks for ordering ${v.product} (${v.order.id}, ₹${v.order.amount}).`;
  switch (kind) {
    case "ship":
      return `${head}\nYour order is confirmed and will reach you in 3-5 days 🚚. Please keep ₹${v.order.amount} cash/UPI ready at delivery.\nReply 1 to confirm, 2 to cancel.`;
    case "confirm":
      return `${head}\nBas ek quick confirmation chahiye before we dispatch.\nReply 1 to confirm ✅, 2 to cancel.`;
    case "prepaid":
      return `${head}\nConfirm karne ke liye reply 1 karein ✅\n🎁 Special offer: abhi UPI se pay karein aur ₹50 OFF paayein (pay ₹${v.order.amount - 50}): [UPI_LINK]\nCOD bhi available hai.`;
    case "call-advance":
      return `${head}\nDispatch reserve karne ke liye sirf ₹99 advance UPI se pay karein: [UPI_LINK]\nBaaki ₹${v.order.amount - 99} delivery pe. Reply 1 once paid ✅`;
    case "hold":
      return `${head}\nDelivery partner ko address samajh nahi aa raha 🙏 Please apna full address bhejein: house/flat no., street, landmark aur pincode. Phir hum turant dispatch kar denge.`;
  }
}
