import type { EconomicsSettings } from "./types";

// Indian D2C defaults for a first-time COD-heavy store (tunable on the Products page).
export const DEFAULT_ECONOMICS: EconomicsSettings = {
  codShare: 0.7,
  rtoCod: 0.3,
  rtoPrepaid: 0.04,
  codFeePct: 2,
  gatewayPct: 2,
  rtoShipping: 70,
  rtoProductLossPct: 0.1,
  packaging: 15,
  cpa: 220,
};

export interface UnitInput {
  sellingPrice: number;
  productCost: number; // landed product cost per unit (incl. GST)
  shippingFwd: number;
}

export interface UnitResult {
  blendedRto: number; // fraction of all orders that come back
  deliveredRate: number;
  revenue: number; // expected collected revenue per order placed
  costs: { label: string; value: number }[];
  totalCost: number;
  profitPerOrder: number; // expected, per order placed, after ads
  profitBeforeAds: number; // = break-even CPA
  naiveMargin: number; // what beginners compute: price - cost - shipping
  naiveMarginPct: number;
  marginPct: number; // profit / revenue
  maxRtoCod: number | null; // COD RTO rate at which profit hits zero (null if never profitable)
  roasBreakEven: number; // revenue / profitBeforeAds
}

/**
 * Expected economics per order PLACED (not per order delivered) — this is the number beginners miss.
 * A COD order that comes back still costs forward + reverse shipping and the ad that produced it.
 */
export function unitEconomics(u: UnitInput, s: EconomicsSettings): UnitResult {
  const p = u.sellingPrice;
  const blendedRto = s.codShare * s.rtoCod + (1 - s.codShare) * s.rtoPrepaid;
  const delivered = 1 - blendedRto;
  const deliveredCod = s.codShare * (1 - s.rtoCod);

  const revenue = delivered * p;
  const costs = [
    { label: "Product (delivered + lost RTO units)", value: u.productCost * (delivered + blendedRto * s.rtoProductLossPct) },
    { label: "Forward shipping (every order)", value: u.shippingFwd },
    { label: "RTO reverse shipping", value: blendedRto * s.rtoShipping },
    { label: "COD remittance fee", value: deliveredCod * p * (s.codFeePct / 100) },
    { label: "Payment gateway (prepaid)", value: (1 - s.codShare) * p * (s.gatewayPct / 100) },
    { label: "Packaging", value: s.packaging },
    { label: "Meta ads (CPA)", value: s.cpa },
  ].map((c) => ({ ...c, value: round(c.value) }));

  const totalCost = costs.reduce((a, c) => a + c.value, 0);
  const profitPerOrder = revenue - totalCost;
  const profitBeforeAds = profitPerOrder + s.cpa;
  const naiveMargin = p - u.productCost - u.shippingFwd;

  return {
    blendedRto,
    deliveredRate: delivered,
    revenue: round(revenue),
    costs,
    totalCost: round(totalCost),
    profitPerOrder: round(profitPerOrder),
    profitBeforeAds: round(profitBeforeAds),
    naiveMargin: round(naiveMargin),
    naiveMarginPct: p > 0 ? naiveMargin / p : 0,
    marginPct: revenue > 0 ? profitPerOrder / revenue : 0,
    maxRtoCod: solveMaxRto(u, s),
    roasBreakEven: profitBeforeAds > 0 ? round((revenue / profitBeforeAds) * 100) / 100 : Infinity,
  };
}

// Profit is linear in rtoCod, so find the zero crossing with two evaluations.
function solveMaxRto(u: UnitInput, s: EconomicsSettings): number | null {
  const at = (r: number) => unitEconomicsRaw(u, { ...s, rtoCod: r });
  const p0 = at(0);
  const p1 = at(1);
  if (p0 <= 0) return null;
  if (p1 >= 0) return 1;
  return p0 / (p0 - p1);
}

function unitEconomicsRaw(u: UnitInput, s: EconomicsSettings): number {
  const p = u.sellingPrice;
  const rto = s.codShare * s.rtoCod + (1 - s.codShare) * s.rtoPrepaid;
  const d = 1 - rto;
  const dc = s.codShare * (1 - s.rtoCod);
  return (
    d * p -
    u.productCost * (d + rto * s.rtoProductLossPct) -
    u.shippingFwd -
    rto * s.rtoShipping -
    dc * p * (s.codFeePct / 100) -
    (1 - s.codShare) * p * (s.gatewayPct / 100) -
    s.packaging -
    s.cpa
  );
}

export function round(n: number) {
  return Math.round(n * 100) / 100;
}

export const inr = (n: number) =>
  (n < 0 ? "-₹" : "₹") + Math.abs(Math.round(n)).toLocaleString("en-IN");

export const pct = (f: number, digits = 0) => `${(f * 100).toFixed(digits)}%`;
