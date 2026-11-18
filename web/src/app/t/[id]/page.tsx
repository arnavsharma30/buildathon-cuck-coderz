import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COURIER_LABEL, STATUS_LABEL, STEPS, type Shipment, type ShipmentStatus } from "@/lib/couriers";
import { getShipment } from "@/lib/shipping-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getShipment((await params).id);
  if (!s) return { title: "Tracking not found" };
  return { title: `${STATUS_LABEL[s.status]} · ${s.storeName} order ${s.orderId}`, robots: { index: false } };
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const maskName = (n: string) =>
  (n || "Customer")
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w : `${w[0]}.`))
    .join(" ");

const HEADLINE: Record<ShipmentStatus, { title: string; sub: string; color: string }> = {
  booked: { title: "Order packed & booked", sub: "Waiting for the courier to pick it up.", color: "bg-zinc-900" },
  picked_up: { title: "Picked up by courier", sub: "Your parcel has left the seller.", color: "bg-sky-600" },
  in_transit: { title: "On the way", sub: "Moving through the courier network.", color: "bg-sky-600" },
  out_for_delivery: { title: "Out for delivery today", sub: "Keep your phone handy for the delivery partner's call.", color: "bg-amber-500" },
  delivered: { title: "Delivered", sub: "Enjoy your order!", color: "bg-emerald-600" },
  ndr: { title: "Delivery attempt failed", sub: "Reply to the store on WhatsApp with a good time and full address.", color: "bg-red-600" },
  rto_initiated: { title: "Returning to seller", sub: "This parcel couldn't be delivered.", color: "bg-violet-600" },
  rto_delivered: { title: "Returned to seller", sub: "This parcel was returned.", color: "bg-violet-600" },
};

function progressIndex(s: Shipment) {
  const reached = s.events.map((e) => STEPS.indexOf(e.status)).filter((i) => i >= 0);
  return Math.max(0, STEPS.indexOf(s.status), ...reached);
}

export default async function TrackingPage({ params }: Props) {
  const s = await getShipment((await params).id);
  if (!s) notFound();
  const h = HEADLINE[s.status];
  const idx = progressIndex(s);
  const exception = s.status === "ndr" || s.status.startsWith("rto");
  const events = [...s.events].reverse();

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-zinc-900">{s.storeName}</div>
          <div className="text-xs text-zinc-500">Order {s.orderId}</div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className={`${h.color} px-6 py-6 text-white`}>
            <div className="text-xs font-medium uppercase tracking-wider opacity-80">Hi {maskName(s.customerName)}, your order is</div>
            <div className="mt-1 text-2xl font-semibold">{h.title}</div>
            <div className="mt-1 text-sm opacity-90">{h.sub}</div>
          </div>

          <div className="px-6 py-5">
            <div className="text-sm font-medium text-zinc-900">{s.productName}</div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {s.city} {s.pincode} · {s.payment === "COD" ? `Cash on Delivery ₹${s.amount}` : `Prepaid ₹${s.amount}`}
            </div>

            {!exception && (
              <ol className="mt-6 grid grid-cols-5 gap-1">
                {STEPS.map((st, i) => (
                  <li key={st} className="text-center">
                    <div className={`mx-auto h-1.5 rounded-full ${i <= idx ? "bg-emerald-500" : "bg-zinc-200"}`} />
                    <div className={`mt-2 text-[11px] leading-tight ${i <= idx ? "font-medium text-zinc-900" : "text-zinc-400"}`}>{STATUS_LABEL[st]}</div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-6 rounded-xl bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
              <span className="font-medium text-zinc-800">{COURIER_LABEL[s.courier]}</span> · AWB <span className="font-mono">{s.awb}</span>
              {s.trackingUrl && (
                <>
                  {" · "}
                  <a className="underline" href={s.trackingUrl} target="_blank" rel="noreferrer">
                    courier tracking
                  </a>
                </>
              )}
            </div>

            <h2 className="mb-3 mt-6 text-sm font-semibold text-zinc-900">Shipment updates</h2>
            <ol className="relative space-y-4 border-l border-zinc-200 pl-5">
              {events.map((e, i) => (
                <li key={`${e.at}-${i}`} className="relative">
                  <span className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-emerald-500 ring-4 ring-emerald-100" : "bg-zinc-300"}`} />
                  <div className="text-sm text-zinc-900">{e.label}</div>
                  <div className="text-xs text-zinc-500">
                    {fmt(e.at)}
                    {e.location ? ` · ${e.location}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Questions about your order? WhatsApp {s.storeName} on the number that sent you this link.
          <br />
          <span className="text-zinc-400">Tracking by DropOS</span>
        </p>
      </div>
    </div>
  );
}
