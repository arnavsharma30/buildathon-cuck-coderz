import type { NotificationLog, NotifyEvent, Shipment } from "./couriers";
import { COURIER_LABEL } from "./couriers";
import type { Integrations } from "./shipping-store";

// Customer shipment messages: WhatsApp (Hinglish) + email (English), each with the public tracking link.

export function trackingLink(origin: string, s: Pick<Shipment, "id">) {
  return `${origin.replace(/\/$/, "")}/t/${s.id}`;
}

const first = (name: string) => (name || "").trim().split(/\s+/)[0] || "there";

export function whatsappText(event: NotifyEvent, s: Shipment, link: string): string {
  const hi = `Hi ${first(s.customerName)}! 👋 ${s.storeName} here.`;
  const cod = s.payment === "COD" ? `\n💵 Please keep ₹${s.amount} cash/UPI ready at delivery.` : "";
  switch (event) {
    case "shipped":
      return `${hi}\nAapka order *${s.productName}* (${s.orderId}) ship ho gaya hai 🚚\nCourier: ${COURIER_LABEL[s.courier]} · AWB ${s.awb}\nLive tracking: ${link}${cod}`;
    case "out_for_delivery":
      return `${hi}\nAapka order *${s.productName}* aaj deliver hoga! 🛵 Delivery partner raste mein hai.${cod}\nTrack: ${link}`;
    case "delivered":
      return `${hi}\nAapka order *${s.productName}* deliver ho gaya ✅ Thank you for shopping with us!\nKoi issue ho toh isi number pe reply karein. Order details: ${link}`;
    case "ndr":
      return `${hi}\nDelivery partner aaj aapka order *${s.productName}* deliver nahi kar paaye 😕\nPlease reply with a good time / correct address & landmark so we can re-attempt.\nTrack: ${link}`;
  }
}

export function emailContent(event: NotifyEvent, s: Shipment, link: string): { subject: string; text: string } {
  const hi = `Hi ${first(s.customerName)},`;
  const cod = s.payment === "COD" ? `\n\nPlease keep ₹${s.amount} ready (cash or UPI) at delivery.` : "";
  const sign = `\n\nTrack your order: ${link}\n\n— ${s.storeName}`;
  switch (event) {
    case "shipped":
      return {
        subject: `Your ${s.storeName} order ${s.orderId} has shipped`,
        text: `${hi}\n\nGood news: your ${s.productName} is on its way via ${COURIER_LABEL[s.courier]} (AWB ${s.awb}).${cod}${sign}`,
      };
    case "out_for_delivery":
      return { subject: `Out for delivery today: ${s.productName}`, text: `${hi}\n\nYour ${s.productName} is out for delivery and should reach you today.${cod}${sign}` };
    case "delivered":
      return { subject: `Delivered: ${s.productName}`, text: `${hi}\n\nYour ${s.productName} has been delivered. Thank you for ordering from ${s.storeName}! Reply to this email if anything is wrong.${sign}` };
    case "ndr":
      return {
        subject: `We couldn't deliver your ${s.productName} today`,
        text: `${hi}\n\nOur delivery partner couldn't complete delivery today. Please reply with a convenient time and your full address with a landmark so we can re-attempt.${sign}`,
      };
  }
}

export const EVENT_LABEL: Record<NotifyEvent, string> = {
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  ndr: "Delivery failed",
};

function waNumber(phone: string) {
  let d = (phone || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d.length === 10 ? `91${d}` : null;
}

async function sendWhatsApp(cfg: NonNullable<Integrations["whatsapp"]>, to: string, text: string) {
  // Meta WhatsApp Cloud API. Free-form text only works inside the 24h customer-service window;
  // business-initiated updates need a Meta-approved template.
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: true, body: text } }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `WhatsApp API ${res.status}`);
  }
}

async function sendEmail(cfg: NonNullable<Integrations["email"]>, to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.resendApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: cfg.from, to: [to], subject, text }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Resend ${res.status}`);
  }
}

/**
 * Send (or queue) the WhatsApp + email messages for one event. Without credentials, messages are
 * logged as "queued" and the dashboard offers one-click wa.me / mailto links instead.
 */
export async function notifyCustomer(s: Shipment, event: NotifyEvent, origin: string, integrations: Integrations): Promise<NotificationLog[]> {
  const link = trackingLink(origin, s);
  const at = new Date().toISOString();
  const logs: NotificationLog[] = [];

  const wa = whatsappText(event, s, link);
  const waTo = waNumber(s.phone);
  if (!waTo) {
    logs.push({ event, channel: "whatsapp", to: s.phone, message: wa, status: "failed", at, error: "Invalid mobile number" });
  } else if (!integrations.whatsapp || s.orderId.startsWith("#D")) {
    // Demo orders never message real-looking numbers.
    logs.push({ event, channel: "whatsapp", to: waTo, message: wa, status: "queued", at });
  } else {
    try {
      await sendWhatsApp(integrations.whatsapp, waTo, wa);
      logs.push({ event, channel: "whatsapp", to: waTo, message: wa, status: "sent", at });
    } catch (e) {
      logs.push({ event, channel: "whatsapp", to: waTo, message: wa, status: "failed", at, error: e instanceof Error ? e.message : String(e) });
    }
  }

  if (s.email) {
    const { subject, text } = emailContent(event, s, link);
    if (!integrations.email || s.orderId.startsWith("#D")) {
      logs.push({ event, channel: "email", to: s.email, subject, message: text, status: "queued", at });
    } else {
      try {
        await sendEmail(integrations.email, s.email, subject, text);
        logs.push({ event, channel: "email", to: s.email, subject, message: text, status: "sent", at });
      } catch (e) {
        logs.push({ event, channel: "email", to: s.email, subject, message: text, status: "failed", at, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return logs;
}
