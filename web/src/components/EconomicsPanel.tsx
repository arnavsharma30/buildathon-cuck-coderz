"use client";

import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import type { EconomicsSettings, Product } from "@/lib/types";
import { inr, pct, unitEconomics } from "@/lib/economics";
import { Card, Field, cx, inputCls } from "./ui";

interface Props {
  product: Product;
  settings: EconomicsSettings;
  onProductChange: (patch: Partial<Product>) => void;
  onSettingsChange: (patch: Partial<EconomicsSettings>) => void;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-600">{label}</span>
        <span className="tabular-nums font-semibold text-zinc-900">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-zinc-900"
      />
    </div>
  );
}

export function EconomicsPanel({ product, settings: s, onProductChange, onSettingsChange }: Props) {
  const input = { sellingPrice: product.sellingPrice, productCost: product.sourcingCost, shippingFwd: product.shippingCost };
  const r = unitEconomics(input, s);
  const losing = r.profitPerOrder < 0;
  const thin = !losing && r.marginPct < 0.1;
  const maxCost = Math.max(...r.costs.map((c) => c.value), 1);

  const sensitivity = [0.1, 0.2, 0.3, 0.4, 0.5].map((rto) => ({
    rto,
    profit: unitEconomics(input, { ...s, rtoCod: rto }).profitPerOrder,
  }));

  const verdict = losing
    ? `At ${pct(s.rtoCod)} COD RTO and ₹${s.cpa} CPA you lose ${inr(-r.profitPerOrder)} on every order placed, even though the "margin" looks like ${pct(r.naiveMarginPct)}. Cut CPA below ${inr(Math.max(0, r.profitBeforeAds))}, push prepaid, or raise the price.`
    : thin
      ? `Barely profitable: ${inr(r.profitPerOrder)} per order. One bad ad day or a COD RTO spike above ${r.maxRtoCod != null ? pct(r.maxRtoCod) : "n/a"} wipes you out.`
      : `Healthy: ${inr(r.profitPerOrder)} per order placed. You can afford up to ${inr(r.profitBeforeAds)} CPA and survive COD RTO up to ${r.maxRtoCod != null ? pct(r.maxRtoCod) : "n/a"}.`;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* Inputs */}
      <Card title="Your numbers">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Selling price">
            <input
              className={inputCls}
              type="number"
              value={product.sellingPrice}
              onChange={(e) => onProductChange({ sellingPrice: Number(e.target.value) })}
            />
          </Field>
          <Field label="Landed cost">
            <input
              className={inputCls}
              type="number"
              value={product.sourcingCost}
              onChange={(e) => onProductChange({ sourcingCost: Number(e.target.value) })}
            />
          </Field>
          <Field label="Shipping">
            <input
              className={inputCls}
              type="number"
              value={product.shippingCost}
              onChange={(e) => onProductChange({ shippingCost: Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="mt-5 space-y-4">
          <Slider label="Orders on COD" value={s.codShare} min={0} max={1} step={0.05} format={(v) => pct(v)} onChange={(v) => onSettingsChange({ codShare: v })} />
          <Slider label="COD RTO rate" value={s.rtoCod} min={0} max={0.6} step={0.01} format={(v) => pct(v)} onChange={(v) => onSettingsChange({ rtoCod: v })} />
          <Slider label="Prepaid RTO rate" value={s.rtoPrepaid} min={0} max={0.2} step={0.01} format={(v) => pct(v)} onChange={(v) => onSettingsChange({ rtoPrepaid: v })} />
          <Slider label="Meta CPA (ad cost per order)" value={s.cpa} min={0} max={700} step={10} format={(v) => inr(v)} onChange={(v) => onSettingsChange({ cpa: v })} />
          <Slider label="RTO reverse shipping" value={s.rtoShipping} min={0} max={200} step={5} format={(v) => inr(v)} onChange={(v) => onSettingsChange({ rtoShipping: v })} />
          <Slider label="RTO units damaged / unsellable" value={s.rtoProductLossPct} min={0} max={1} step={0.05} format={(v) => pct(v)} onChange={(v) => onSettingsChange({ rtoProductLossPct: v })} />
          <div className="grid grid-cols-3 gap-2">
            <Field label="COD fee %">
              <input className={inputCls} type="number" step="0.5" value={s.codFeePct} onChange={(e) => onSettingsChange({ codFeePct: Number(e.target.value) })} />
            </Field>
            <Field label="Gateway %">
              <input className={inputCls} type="number" step="0.5" value={s.gatewayPct} onChange={(e) => onSettingsChange({ gatewayPct: Number(e.target.value) })} />
            </Field>
            <Field label="Packaging ₹">
              <input className={inputCls} type="number" value={s.packaging} onChange={(e) => onSettingsChange({ packaging: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      </Card>

      {/* Output */}
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">What beginners calculate</div>
            <div className="mt-2 text-4xl font-semibold tabular-nums text-zinc-500 line-through decoration-zinc-400/70">
              {inr(r.naiveMargin)}
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              price − cost − shipping = <b>{pct(r.naiveMarginPct)} margin</b>
            </div>
            <div className="mt-3 text-xs text-zinc-400">Ignores RTO, reverse shipping, COD fees and ad spend.</div>
          </div>
          <div
            className={cx(
              "rounded-xl border p-5",
              losing ? "border-red-200 bg-red-50" : thin ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50",
            )}
          >
            <div
              className={cx(
                "text-xs font-semibold uppercase tracking-wider",
                losing ? "text-red-700" : thin ? "text-amber-700" : "text-emerald-700",
              )}
            >
              What you actually make per order placed
            </div>
            <div
              className={cx(
                "mt-2 text-4xl font-semibold tabular-nums",
                losing ? "text-red-600" : thin ? "text-amber-600" : "text-emerald-600",
              )}
            >
              {inr(r.profitPerOrder)}
            </div>
            <div className="mt-1 text-sm text-zinc-600">
              {pct(r.marginPct)} of collected revenue · {pct(r.blendedRto)} of all orders come back
            </div>
            <div className="mt-3 flex items-start gap-2 text-xs text-zinc-700">
              {losing ? (
                <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              ) : thin ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <span>{verdict}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MiniStat label="Break-even CPA" value={inr(r.profitBeforeAds)} hint="Max ad cost per order" bad={r.profitBeforeAds < s.cpa} />
          <MiniStat
            label="Max COD RTO"
            value={r.maxRtoCod == null ? "Never profitable" : pct(r.maxRtoCod)}
            hint="Before you lose money"
            bad={r.maxRtoCod == null || r.maxRtoCod < s.rtoCod}
          />
          <MiniStat label="Break-even ROAS" value={Number.isFinite(r.roasBreakEven) ? `${r.roasBreakEven.toFixed(2)}×` : "∞"} hint="Meta purchase ROAS needed" />
          <MiniStat label="Delivered rate" value={pct(r.deliveredRate)} hint="Orders that turn into cash" />
        </div>

        <div className="grid gap-5 md:grid-cols-[1fr_260px]">
          <Card title={`Where ${inr(r.revenue)} of expected revenue per order goes`}>
            <div className="space-y-2">
              {r.costs.map((c) => (
                <div key={c.label} className="flex items-center gap-3 text-sm">
                  <span className="w-56 shrink-0 text-zinc-600">{c.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-zinc-100">
                    <div
                      className={cx("h-2 rounded-full", c.label.startsWith("RTO") || c.label.startsWith("Meta") ? "bg-red-400" : "bg-zinc-400")}
                      style={{ width: `${(c.value / maxCost) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right tabular-nums text-zinc-800">{inr(c.value)}</span>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3 text-sm font-semibold">
                <span>Profit per order placed</span>
                <span className={cx("tabular-nums", losing ? "text-red-600" : "text-emerald-600")}>{inr(r.profitPerOrder)}</span>
              </div>
            </div>
          </Card>
          <Card title="If COD RTO moves…">
            <table className="w-full text-sm">
              <tbody>
                {sensitivity.map((row) => (
                  <tr key={row.rto} className="border-b border-zinc-100 last:border-0">
                    <td className="py-1.5 text-zinc-600">{pct(row.rto)} RTO</td>
                    <td className={cx("py-1.5 text-right font-medium tabular-nums", row.profit < 0 ? "text-red-600" : "text-emerald-600")}>
                      {inr(row.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-snug text-zinc-500">
              Every 10 points of COD RTO costs about{" "}
              {inr(Math.abs(sensitivity[0].profit - sensitivity[1].profit))} per order. That&apos;s why the Orders &amp; RTO tab exists.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint, bad }: { label: string; value: string; hint: string; bad?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={cx("mt-1 text-xl font-semibold tabular-nums", bad ? "text-red-600" : "text-zinc-900")}>{value}</div>
      <div className="mt-0.5 text-[11px] text-zinc-400">{hint}</div>
    </div>
  );
}
