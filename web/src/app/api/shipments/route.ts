import { demoAwb, shipmentId, type Courier, type Shipment } from "@/lib/couriers";
import { notifyCustomer } from "@/lib/notify";
import { getIntegrations, listShipments, originOf, saveShipment } from "@/lib/shipping-store";
import type { Order } from "@/lib/types";

// GET /api/shipments?orderIds=a,b  → shipments for those orders (newest first)
export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("orderIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const all = await listShipments();
  const want = new Set(ids);
  return Response.json({ shipments: ids.length ? all.filter((s) => want.has(s.orderId)) : [] });
}

// POST /api/shipments  {order, courier, awb?, storeName, productName, email?, origin?}
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    order?: Order;
    courier?: Courier;
    awb?: string;
    storeName?: string;
    productName?: string;
    email?: string;
    origin?: string;
  };
  const o = body.order;
  if (!o?.id || !o.phone) return Response.json({ error: "order is required" }, { status: 400 });
  const courier: Courier = body.courier === "shiprocket" || body.courier === "delhivery" ? body.courier : "demo";
  const integrations = await getIntegrations();
  if (courier !== "demo" && !integrations[courier]) return Response.json({ error: `${courier} is not connected` }, { status: 400 });
  const awb = (body.awb ?? "").trim() || (courier === "demo" ? demoAwb() : "");
  if (!/^[A-Za-z0-9-]{6,40}$/.test(awb)) return Response.json({ error: "Enter the AWB / waybill number from your courier" }, { status: 400 });
  const email = (body.email ?? o.email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Customer email looks invalid" }, { status: 400 });

  const now = new Date().toISOString();
  const s: Shipment = {
    id: shipmentId(),
    orderId: o.id,
    courier,
    awb,
    storeName: (body.storeName ?? "").trim() || "Our store",
    productName: (body.productName ?? "").trim() || "your order",
    customerName: o.customerName,
    phone: o.phone,
    email: email || undefined,
    city: o.city,
    pincode: o.pincode,
    amount: o.amount,
    payment: o.payment,
    status: "booked",
    events: [{ status: "booked", label: `Shipment booked with ${courier === "demo" ? "demo courier" : courier}`, at: now }],
    createdAt: now,
    updatedAt: now,
    notifications: [],
  };
  s.notifications.push(...(await notifyCustomer(s, "shipped", originOf(req, body.origin), integrations)));
  await saveShipment(s);
  return Response.json({ shipment: s });
}
