// Courier integrations: shared types, status normalisation, real Shiprocket / Delhivery tracking clients
// and a deterministic demo courier so the flow works without any keys.

export type Courier = "shiprocket" | "delhivery" | "demo";

export type ShipmentStatus =
  | "booked"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "ndr" // delivery attempt failed (non-delivery report)
  | "rto_initiated"
  | "rto_delivered";

export interface TrackingEvent {
  status: ShipmentStatus;
  label: string;
  location?: string;
  at: string; // ISO
}

export type NotifyEvent = "shipped" | "out_for_delivery" | "delivered" | "ndr";

export interface NotificationLog {
  event: NotifyEvent;
  channel: "whatsapp" | "email";
  to: string;
  message: string;
  subject?: string;
  status: "sent" | "queued" | "failed";
  at: string;
  error?: string;
}

export interface Shipment {
  id: string; // public tracking id: /t/<id>
  orderId: string;
  courier: Courier;
  awb: string;
  storeName: string;
  productName: string;
  customerName: string;
  phone: string;
  email?: string;
  city: string;
  pincode: string;
  amount: number;
  payment: "COD" | "Prepaid";
  status: ShipmentStatus;
  events: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
  notifications: NotificationLog[];
  trackingUrl?: string;
  lastError?: string;
}

export const COURIER_LABEL: Record<Courier, string> = {
  shiprocket: "Shiprocket",
  delhivery: "Delhivery",
  demo: "Demo courier",
};

export const STATUS_LABEL: Record<ShipmentStatus, string> = {
  booked: "Booked",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  ndr: "Delivery attempt failed",
  rto_initiated: "Returning to seller",
  rto_delivered: "Returned (RTO)",
};

export const STATUS_TONE: Record<ShipmentStatus, "zinc" | "blue" | "amber" | "green" | "red" | "violet"> = {
  booked: "zinc",
  picked_up: "blue",
  in_transit: "blue",
  out_for_delivery: "amber",
  delivered: "green",
  ndr: "red",
  rto_initiated: "violet",
  rto_delivered: "violet",
};

/** The forward journey shown as a stepper on the tracking page. */
export const STEPS: ShipmentStatus[] = ["booked", "picked_up", "in_transit", "out_for_delivery", "delivered"];

export const TERMINAL: ShipmentStatus[] = ["delivered", "rto_delivered"];

/** Status changes that trigger an automatic customer message. */
export const NOTIFY_ON: Partial<Record<ShipmentStatus, NotifyEvent>> = {
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  ndr: "ndr",
};

// ---------- status normalisation ----------

/** Map any courier's free-text status into our lifecycle. Order of checks matters. */
export function normaliseStatus(raw: string | undefined | null): ShipmentStatus | null {
  const s = String(raw ?? "").toLowerCase();
  if (!s) return null;
  if (/rto.*deliver|returned to (origin|seller|shipper)|rto delivered/.test(s)) return "rto_delivered";
  if (/rto|return to origin|returned|return initiated/.test(s)) return "rto_initiated";
  if (/undeliver|not deliver|ndr|failed attempt|attempt fail|consignee (unavailable|refused)|refused|door locked|customer not available/.test(s)) return "ndr";
  if (/out for delivery|ofd|dispatched for delivery/.test(s)) return "out_for_delivery";
  if (/^delivered|\bdelivered\b/.test(s)) return "delivered";
  if (/in transit|transit|reached|arrived|connected|bagged|received at|shipped|dispatched/.test(s)) return "in_transit";
  if (/picked|pickup done|picked up/.test(s)) return "picked_up";
  if (/manifest|booked|pickup scheduled|pickup generated|awb assigned|ready to ship|pending|not picked|created/.test(s)) return "booked";
  return null;
}

export interface TrackResult {
  status: ShipmentStatus;
  events: TrackingEvent[];
  trackingUrl?: string;
}

const iso = (d: unknown) => {
  const t = new Date(String(d ?? "").replace(" ", "T"));
  return Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
};

function finish(events: TrackingEvent[], fallback: ShipmentStatus, trackingUrl?: string): TrackResult {
  const sorted = events.sort((a, b) => a.at.localeCompare(b.at));
  return { status: sorted.at(-1)?.status ?? fallback, events: sorted, trackingUrl };
}

// ---------- Shiprocket ----------
// Docs: https://apidocs.shiprocket.in  (auth/login → token valid ~10 days; track by AWB)

export async function shiprocketLogin(email: string, password: string): Promise<string> {
  const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; message?: string };
  if (!res.ok || !body.token) throw new Error(`Shiprocket login failed: ${body.message ?? res.status}`);
  return body.token;
}

export async function trackShiprocket(awb: string, token: string): Promise<TrackResult> {
  const res = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${encodeURIComponent(awb)}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Shiprocket tracking failed (${res.status}): ${String(body.message ?? "")}`);
  // Response: { tracking_data: { shipment_status, shipment_track: [{current_status,...}], shipment_track_activities: [{date, activity, location, "sr-status-label"}], track_url, error } }
  const td = (body.tracking_data ?? body) as Record<string, unknown>;
  if (td.error) throw new Error(`Shiprocket: ${String(td.error)}`);
  const acts = Array.isArray(td.shipment_track_activities) ? (td.shipment_track_activities as Record<string, unknown>[]) : [];
  const events: TrackingEvent[] = [];
  for (const a of acts) {
    const label = String(a.activity ?? a["sr-status-label"] ?? a.status ?? "");
    const status = normaliseStatus(String(a["sr-status-label"] ?? "")) ?? normaliseStatus(label);
    if (status) events.push({ status, label: label || STATUS_LABEL[status], location: a.location ? String(a.location) : undefined, at: iso(a.date) });
  }
  const track = Array.isArray(td.shipment_track) ? (td.shipment_track[0] as Record<string, unknown> | undefined) : undefined;
  const current = normaliseStatus(String(track?.current_status ?? ""));
  if (current && (events.length === 0 || events.at(-1)!.status !== current)) {
    events.push({ status: current, label: String(track?.current_status), at: iso(track?.updated_time_stamp ?? Date.now()) });
  }
  return finish(events, current ?? "booked", td.track_url ? String(td.track_url) : undefined);
}

// ---------- Delhivery ----------
// Docs: https://one.delhivery.com/developer-portal  (packages/json?waybill=… with "Authorization: Token <key>")

export async function trackDelhivery(awb: string, apiToken: string): Promise<TrackResult> {
  const res = await fetch(`https://track.delhivery.com/api/v1/packages/json/?waybill=${encodeURIComponent(awb)}`, {
    headers: { authorization: `Token ${apiToken}`, accept: "application/json" },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Delhivery tracking failed (${res.status})`);
  // Response: { ShipmentData: [ { Shipment: { Status: {Status, StatusType, StatusDateTime, StatusLocation}, Scans: [ { ScanDetail: { Scan, ScanType, Instructions, ScanDateTime, ScannedLocation } } ] } } ] }
  const data = Array.isArray(body.ShipmentData) ? (body.ShipmentData as Record<string, unknown>[]) : [];
  const shipment = data[0]?.Shipment as Record<string, unknown> | undefined;
  if (!shipment) throw new Error(`Delhivery: no shipment found for AWB ${awb}${body.Error ? ` (${String(body.Error)})` : ""}`);
  const events: TrackingEvent[] = [];
  const scans = Array.isArray(shipment.Scans) ? (shipment.Scans as Record<string, unknown>[]) : [];
  for (const s of scans) {
    const d = (s.ScanDetail ?? s) as Record<string, unknown>;
    const text = `${String(d.Scan ?? "")} ${String(d.Instructions ?? "")}`.trim();
    // Delhivery ScanType: UD (undelivered/forward), DL (delivered), RT (return), PP (pickup pending), PU (picked up)
    const type = String(d.ScanType ?? "").toUpperCase();
    let status = normaliseStatus(text);
    if (type === "DL" && /rto|return/i.test(text)) status = "rto_delivered";
    else if (type === "DL") status = "delivered";
    else if (type === "RT") status = /deliver/i.test(text) ? "rto_delivered" : "rto_initiated";
    if (status) events.push({ status, label: text || STATUS_LABEL[status], location: d.ScannedLocation ? String(d.ScannedLocation) : undefined, at: iso(d.ScanDateTime) });
  }
  const st = (shipment.Status ?? {}) as Record<string, unknown>;
  const current = normaliseStatus(`${String(st.Status ?? "")} ${String(st.Instructions ?? "")}`);
  if (current && (events.length === 0 || events.at(-1)!.status !== current)) {
    events.push({ status: current, label: String(st.Status ?? STATUS_LABEL[current]), location: st.StatusLocation ? String(st.StatusLocation) : undefined, at: iso(st.StatusDateTime) });
  }
  return finish(events, current ?? "booked", `https://www.delhivery.com/track/package/${encodeURIComponent(awb)}`);
}

// ---------- Demo courier ----------

const HUBS = ["Delhi (Bilaspur) Hub", "Bhiwandi Mother Hub", "Bengaluru (Hoskote) Hub", "Kolkata (Dankuni) Hub", "Ahmedabad (Changodar) Hub", "Hyderabad (Medchal) Hub"];

/** Advance a demo shipment by exactly one realistic step. Deterministic per AWB. */
export function advanceDemo(s: Pick<Shipment, "status" | "awb" | "city" | "events">): TrackResult {
  const seed = [...s.awb].reduce((a, c) => a + c.charCodeAt(0), 0);
  const origin = HUBS[seed % HUBS.length];
  const city = s.city || "destination city";
  const next: Partial<Record<ShipmentStatus, TrackingEvent>> = {
    booked: { status: "picked_up", label: "Shipment picked up from seller", location: origin, at: "" },
    picked_up: { status: "in_transit", label: `In transit to ${city}`, location: origin, at: "" },
    in_transit: { status: "out_for_delivery", label: "Out for delivery with our delivery partner", location: `${city} delivery centre`, at: "" },
    out_for_delivery: { status: "delivered", label: "Delivered to customer", location: city, at: "" },
    ndr: { status: "out_for_delivery", label: "Re-attempt: out for delivery", location: `${city} delivery centre`, at: "" },
    rto_initiated: { status: "rto_delivered", label: "Returned to seller", location: origin, at: "" },
  };
  const step = next[s.status];
  if (!step) return { status: s.status, events: s.events };
  return { status: step.status, events: [...s.events, { ...step, at: new Date().toISOString() }] };
}

export function demoAwb() {
  return `DEMO${Math.floor(1e9 + Math.random() * 9e9)}`;
}

export function shipmentId() {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += abc[Math.floor(Math.random() * abc.length)];
  return out;
}
