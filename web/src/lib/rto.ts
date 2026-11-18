import type { EconomicsSettings, Order } from "./types";

/**
 * RTO (Return-To-Origin) risk engine.
 *
 * In Indian COD e-commerce a large share of orders are refused at the door or undeliverable.
 * Each RTO costs forward + reverse shipping, a damaged unit now and then, and the ad spend that
 * produced it. Beginners ship every order blindly. This engine scores each order from signals that
 * operators check by hand (payment mode, pincode zone, address and phone quality, repeat or blocked
 * customers, impulse timing, basket size) and maps the score to the action an experienced operator takes.
 *
 * Every signal contributes visible points, so a student can see *why* an order is risky.
 * Weights are heuristic estimates, not a trained model.
 */

export type RiskBand = "low" | "medium" | "high" | "critical";

export interface RiskSignal {
  key: string;
  label: string;
  points: number; // + raises risk, - lowers it
}

export interface RtoAction {
  code: "ship" | "confirm" | "prepaid" | "call-advance" | "hold";
  label: string;
  detail: string;
}

export interface RtoAssessment {
  orderId: string;
  score: number; // 0-100
  band: RiskBand;
  probability: number; // estimated chance this order ends in RTO
  signals: RiskSignal[];
  action: RtoAction;
  duplicateOf?: string;
}

// ---- Pincode heuristics (first digits of the 6-digit Indian PIN) ----
// Metro delivery hubs: dense courier coverage, low refusal rates.
const METRO_PREFIXES: Record<string, string> = {
  "110": "Delhi",
  "400": "Mumbai",
  "560": "Bengaluru",
  "600": "Chennai",
  "500": "Hyderabad",
  "411": "Pune",
  "700": "Kolkata",
  "380": "Ahmedabad",
  "122": "Gurugram",
  "201": "Noida / Ghaziabad",
  "121": "Faridabad",
  "160": "Chandigarh",
};

// Postal regions that operators commonly flag for high COD refusal / weak last-mile coverage.
const HIGH_RTO_REGIONS: { prefix: string; region: string; points: number }[] = [
  { prefix: "27", region: "Eastern UP", points: 14 },
  { prefix: "22", region: "Central UP", points: 10 },
  { prefix: "84", region: "North Bihar", points: 16 },
  { prefix: "85", region: "Bihar", points: 16 },
  { prefix: "80", region: "Bihar", points: 14 },
  { prefix: "81", region: "Jharkhand", points: 12 },
  { prefix: "82", region: "Jharkhand", points: 12 },
  { prefix: "83", region: "Jharkhand", points: 12 },
  { prefix: "18", region: "Jammu & Kashmir", points: 12 },
  { prefix: "19", region: "Jammu & Kashmir", points: 12 },
  { prefix: "78", region: "North-East", points: 14 },
  { prefix: "79", region: "North-East", points: 14 },
  { prefix: "34", region: "West Rajasthan", points: 10 },
  { prefix: "47", region: "North MP", points: 8 },
];

const JUNK_WORDS = /\b(test|testing|xyz|abc|asdf|qwerty|na|n\/a|none|dummy|fake)\b/i;
const ADDRESS_DETAIL = /\b(flat|house|h\.?\s?no|plot|floor|block|sector|apartment|apt|tower|street|road|rd|lane|gali|nagar|colony|near|opp|behind|ward|village|vill|post|po)\b/i;

export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

function phoneSignals(raw: string): RiskSignal[] {
  const d = normalizePhone(raw);
  if (d.length !== 10) return [{ key: "phone-invalid", label: `Phone "${raw}" is not a valid 10-digit mobile`, points: 22 }];
  const out: RiskSignal[] = [];
  if (!/^[6-9]/.test(d)) out.push({ key: "phone-prefix", label: "Mobile number doesn't start with 6-9", points: 15 });
  if (/^(\d)\1{6,}/.test(d) || /(\d)\1{6,}$/.test(d) || "0123456789".includes(d) || "9876543210".includes(d)) {
    out.push({ key: "phone-fake", label: "Phone looks fake (repeated/sequential digits)", points: 22 });
  }
  return out;
}

function addressSignals(o: Order): RiskSignal[] {
  const out: RiskSignal[] = [];
  const a = (o.address || "").trim();
  if (a.length < 20) out.push({ key: "addr-short", label: `Address is very short (${a.length} chars)`, points: 12 });
  if (!/\d/.test(a)) out.push({ key: "addr-nonum", label: "No house / flat / plot number in address", points: 9 });
  if (!ADDRESS_DETAIL.test(a)) out.push({ key: "addr-vague", label: "No street, area or landmark in address", points: 5 });
  if (JUNK_WORDS.test(a) || JUNK_WORDS.test(o.customerName)) out.push({ key: "junk", label: "Placeholder / test words in name or address", points: 15 });
  return out;
}

function pincodeSignals(pin: string): RiskSignal[] {
  const p = (pin || "").trim();
  if (!/^[1-9]\d{5}$/.test(p)) return [{ key: "pin-invalid", label: `Pincode "${pin}" is invalid`, points: 22 }];
  const metro = METRO_PREFIXES[p.slice(0, 3)];
  if (metro) return [{ key: "pin-metro", label: `Metro pincode (${metro}): strong courier coverage`, points: -8 }];
  const high = HIGH_RTO_REGIONS.find((r) => p.startsWith(r.prefix));
  if (high) return [{ key: "pin-high", label: `${high.region} pincode: historically high COD refusal`, points: high.points }];
  return [{ key: "pin-nonmetro", label: "Non-metro pincode", points: 4 }];
}

function nameSignals(name: string): RiskSignal[] {
  const n = (name || "").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (n.length < 3 || !/[aeiou]/i.test(n) || /(.)\1{3,}/i.test(n)) return [{ key: "name-gibberish", label: `Name "${n}" looks gibberish`, points: 10 }];
  if (parts.length === 1) return [{ key: "name-single", label: "Only a first name was given", points: 3 }];
  return [];
}

function timeSignals(iso: string): RiskSignal[] {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [];
  // Interpret in IST.
  const hour = (d.getUTCHours() + 5 + Math.floor((d.getUTCMinutes() + 30) / 60)) % 24;
  if (hour >= 0 && hour < 5) return [{ key: "late-night", label: `Placed at ${String(hour).padStart(2, "0")}:xx IST (late-night impulse buy)`, points: 6 }];
  return [];
}

export interface AssessContext {
  /** All orders, used to detect duplicates and repeat RTO customers. */
  orders: Order[];
}

export function assessOrder(o: Order, ctx: AssessContext): RtoAssessment {
  const signals: RiskSignal[] = [];

  if (o.payment === "COD") signals.push({ key: "cod", label: "Cash on delivery: nothing paid upfront", points: 25 });
  else signals.push({ key: "prepaid", label: "Prepaid: customer already paid", points: -20 });

  signals.push(...pincodeSignals(o.pincode));
  signals.push(...phoneSignals(o.phone));
  signals.push(...addressSignals(o));
  signals.push(...nameSignals(o.customerName));
  signals.push(...timeSignals(o.createdAt));

  if (o.payment === "COD" && o.amount >= 1500) signals.push({ key: "high-value", label: `High-value COD (₹${o.amount}): more door refusals`, points: 8 });
  if (o.quantity >= 3 && o.payment === "COD") signals.push({ key: "bulk-cod", label: `${o.quantity} units on COD`, points: 6 });

  // Repeat / blocked customers, matched by phone.
  const phone = normalizePhone(o.phone);
  let duplicateOf: string | undefined;
  if (phone.length === 10) {
    const same = ctx.orders.filter((x) => x.id !== o.id && normalizePhone(x.phone) === phone);
    const priorRto = same.filter((x) => x.status === "rto");
    const priorDelivered = same.filter((x) => x.status === "delivered");
    if (priorRto.length) signals.push({ key: "prior-rto", label: `Customer refused ${priorRto.length} earlier order(s)`, points: 30 });
    if (priorDelivered.length) signals.push({ key: "repeat-good", label: "Repeat customer with a delivered order", points: -15 });
    const t = new Date(o.createdAt).getTime();
    const dup = same.find((x) => x.status !== "rto" && x.status !== "delivered" && Math.abs(new Date(x.createdAt).getTime() - t) < 24 * 3600e3);
    if (dup) {
      duplicateOf = dup.id;
      signals.push({ key: "duplicate", label: `Possible duplicate of ${dup.id} (same phone within 24h)`, points: 10 });
    }
  }

  const raw = signals.reduce((a, s) => a + s.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  const band: RiskBand = score >= 70 ? "critical" : score >= 50 ? "high" : score >= 30 ? "medium" : "low";
  return { orderId: o.id, score, band, probability: scoreToProbability(score), signals, action: actionFor(band, o), duplicateOf };
}

/** Rough calibration: a clean prepaid order is about 3%, a typical COD order about 25-30%, a junk COD order over 70%. */
export function scoreToProbability(score: number): number {
  return Math.min(0.9, 0.03 + 0.8 * Math.pow(score / 100, 1.6));
}

function actionFor(band: RiskBand, o: Order): RtoAction {
  if (o.payment === "Prepaid" && band === "low") return { code: "ship", label: "Ship now", detail: "Prepaid and clean. Book the courier." };
  switch (band) {
    case "low":
      return { code: "ship", label: "Auto-confirm & ship", detail: "Send the WhatsApp order confirmation and ship within 24h." };
    case "medium":
      return { code: "prepaid", label: "Confirm + offer prepaid", detail: "WhatsApp confirm, and offer ₹50 off for paying by UPI now." };
    case "high":
      return { code: "call-advance", label: "Call + ₹99 advance", detail: "Call to confirm, and ask for a ₹99 UPI advance (partial COD) before shipping." };
    case "critical":
      return { code: "hold", label: "Hold: verify first", detail: "Don't ship. Fix address/phone and take prepaid or advance, otherwise cancel." };
  }
}

// ---- Portfolio-level impact: blind shipping vs following DropOS actions ----

export interface RtoImpact {
  orders: number;
  codShare: number;
  expectedRtoBlind: number; // expected count
  expectedRtoWithActions: number;
  lossBlind: number; // INR
  lossWithActions: number;
  saved: number;
  rtoRateBlind: number;
  rtoRateWithActions: number;
}

/**
 * Cost of one RTO = forward + reverse shipping + share of units lost.
 * Effects of actions (operator rules of thumb, conservative):
 *  - confirm/prepaid offer: about 35% of medium-risk customers pay upfront (RTO about 4%); the rest are confirmed (RTO x0.7)
 *  - call + advance: the advance-payers (about 50%) behave like prepaid; non-payers are cancelled before shipping (no cost)
 *  - hold: these orders are not shipped unless verified, so they cost almost nothing
 */
export function portfolioImpact(
  items: { order: Order; risk: RtoAssessment }[],
  econ: EconomicsSettings,
  forwardShipping: number,
  productCost: number,
): RtoImpact {
  const costPerRto = forwardShipping + econ.rtoShipping + productCost * econ.rtoProductLossPct;
  let blind = 0;
  let acted = 0;
  for (const { risk } of items) {
    const p = risk.probability;
    blind += p;
    switch (risk.action.code) {
      case "ship":
        acted += p;
        break;
      case "confirm":
        acted += p * 0.7;
        break;
      case "prepaid":
        acted += 0.35 * 0.04 + 0.65 * p * 0.7;
        break;
      case "call-advance":
        acted += 0.5 * 0.04;
        break;
      case "hold":
        acted += 0.2 * 0.04;
        break;
    }
  }
  const n = items.length || 1;
  return {
    orders: items.length,
    codShare: items.filter((i) => i.order.payment === "COD").length / n,
    expectedRtoBlind: blind,
    expectedRtoWithActions: acted,
    lossBlind: blind * costPerRto,
    lossWithActions: acted * costPerRto,
    saved: (blind - acted) * costPerRto,
    rtoRateBlind: blind / n,
    rtoRateWithActions: acted / n,
  };
}

export const BAND_STYLE: Record<RiskBand, { tone: "green" | "amber" | "red" | "violet"; label: string }> = {
  low: { tone: "green", label: "Low" },
  medium: { tone: "amber", label: "Medium" },
  high: { tone: "red", label: "High" },
  critical: { tone: "violet", label: "Critical" },
};
