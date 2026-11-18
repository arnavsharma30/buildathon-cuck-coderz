import { NOTIFY_ON, STEPS, advanceDemo, shiprocketLogin, trackDelhivery, trackShiprocket, type NotifyEvent, type Shipment, type TrackResult } from "@/lib/couriers";
import { notifyCustomer } from "@/lib/notify";
import { getIntegrations, getShipment, originOf, saveIntegrations, saveShipment, withShipment, type Integrations } from "@/lib/shipping-store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const s = await getShipment((await params).id);
  if (!s) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ shipment: s });
}

async function track(s: Shipment, integrations: Integrations): Promise<TrackResult> {
  if (s.courier === "demo") return advanceDemo(s);
  if (s.courier === "delhivery") {
    if (!integrations.delhivery) throw new Error("Delhivery is not connected");
    return trackDelhivery(s.awb, integrations.delhivery.apiToken);
  }
  const sr = integrations.shiprocket;
  if (!sr) throw new Error("Shiprocket is not connected");
  // Shiprocket tokens last ~10 days; refresh after 7.
  if (!sr.token || !sr.tokenAt || Date.now() - sr.tokenAt > 7 * 864e5) {
    sr.token = await shiprocketLogin(sr.email, sr.password);
    sr.tokenAt = Date.now();
    await saveIntegrations(integrations);
  }
  return trackShiprocket(s.awb, sr.token);
}

const rank = (st: Shipment["status"]) => {
  const i = STEPS.indexOf(st);
  return i === -1 ? 99 : i;
};

// POST {action: "refresh"} | {action: "notify", event}
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; event?: NotifyEvent; origin?: string };
  const origin = originOf(req, body.origin);
  const integrations = await getIntegrations();

  const result = await withShipment(id, async (s) => {
    if (body.action === "notify") {
      const event = body.event ?? "shipped";
      s.notifications.push(...(await notifyCustomer(s, event, origin, integrations)));
    } else {
      try {
        const r = await track(s, integrations);
        const before = s.status;
        const seen = new Set(s.events.map((e) => `${e.status}|${e.at}|${e.label}`));
        const fresh = r.events.filter((e) => !seen.has(`${e.status}|${e.at}|${e.label}`));
        if (s.courier === "demo") s.events = r.events;
        else s.events = [...s.events.filter((e) => e.status === "booked" && e.label.startsWith("Shipment booked")), ...r.events];
        s.status = r.status;
        if (r.trackingUrl) s.trackingUrl = r.trackingUrl;
        s.lastError = undefined;
        // Message the customer once per newly reached milestone.
        const already = new Set(s.notifications.map((n) => n.event));
        const reached = new Set(fresh.map((e) => e.status));
        if (before !== s.status) reached.add(s.status);
        for (const st of reached) {
          const ev = NOTIFY_ON[st];
          if (ev && !already.has(ev) && !(ev !== "ndr" && rank(st) < rank(before))) {
            s.notifications.push(...(await notifyCustomer(s, ev, origin, integrations)));
            already.add(ev);
          }
        }
      } catch (e) {
        s.lastError = e instanceof Error ? e.message : String(e);
      }
    }
    s.updatedAt = new Date().toISOString();
    await saveShipment(s);
    return s;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ shipment: result });
}
