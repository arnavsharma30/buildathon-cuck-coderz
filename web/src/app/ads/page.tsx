"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Plus, Dices, Trash2, ArrowUpRight, Info } from "lucide-react";
import { Badge, Button, Card, Empty, Field, PageHeader, SourceBadge, Stat, cx, inputCls } from "@/components/ui";
import { newId, postJSON, useWorkspace } from "@/lib/store";
import { inr, unitEconomics } from "@/lib/economics";
import { adMetrics, decide, simulate, type AdPlan, type Verdict } from "@/lib/ads";
import type { AdSetRow } from "@/lib/types";

const VERDICT_TONE: Record<Verdict, "red" | "zinc" | "blue" | "green"> = { KILL: "red", WAIT: "zinc", KEEP: "blue", SCALE: "green" };

const NUM_FIELDS: { key: keyof Pick<AdSetRow, "spend" | "impressions" | "clicks" | "addToCarts" | "purchases">; label: string }[] = [
  { key: "spend", label: "Spend ₹" },
  { key: "impressions", label: "Impr." },
  { key: "clicks", label: "Clicks" },
  { key: "addToCarts", label: "ATC" },
  { key: "purchases", label: "Orders" },
];

export default function AdsPage() {
  const { ws, update, activeProduct } = useWorkspace();
  const [dailyBudget, setDailyBudget] = useState(1500);
  const [plan, setPlan] = useState<AdPlan>();
  const [source, setSource] = useState<"claude" | "demo">();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const econ = useMemo(() => {
    if (!activeProduct) return null;
    return unitEconomics(
      { sellingPrice: activeProduct.sellingPrice, productCost: activeProduct.sourcingCost, shippingFwd: activeProduct.shippingCost },
      ws.economics,
    );
  }, [activeProduct, ws.economics]);

  if (!activeProduct || !econ) {
    return (
      <>
        <PageHeader step="Step 4" title="Meta ads" subtitle="Campaign plan, performance tracker and kill/scale decisions against your real break-even CPA." />
        <Empty>
          No product yet. <Link href="/products" className="font-medium text-zinc-900 underline">Pick a product</Link> first.
        </Empty>
      </>
    );
  }

  const product = activeProduct;
  const be = econ.profitBeforeAds;
  const rows = ws.adsets.filter((a) => a.productId === product.id);
  const angles = Array.from(new Set(ws.creatives.filter((c) => c.productId === product.id).map((c) => c.angle)));

  const computed = rows.map((a) => {
    const m = adMetrics(a, product.sellingPrice, econ.deliveredRate, be);
    return { a, m, d: decide(a, m, be) };
  });
  const tot = rows.reduce(
    (s, a) => ({ spend: s.spend + a.spend, purchases: s.purchases + a.purchases, impressions: s.impressions + a.impressions, clicks: s.clicks + a.clicks }),
    { spend: 0, purchases: 0, impressions: 0, clicks: 0 },
  );
  const blendedCpa = tot.purchases > 0 ? tot.spend / tot.purchases : 0;
  const totalProfit = tot.purchases * be - tot.spend;
  const rtoRoas = tot.spend > 0 ? (tot.purchases * product.sellingPrice * econ.deliveredRate) / tot.spend : 0;

  async function generatePlan() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await postJSON<{ plan: AdPlan; source: "claude" | "demo"; error?: string }>("/api/ads/plan", {
        product,
        creatives: angles,
        dailyBudget,
        breakEvenCpa: be,
      });
      setPlan(res.plan);
      setSource(res.source);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function createAdsets() {
    if (!plan) return;
    const newRows: AdSetRow[] = plan.adsets.map((s) => ({
      id: newId("as"),
      productId: product.id,
      name: s.name,
      creativeAngle: s.creativeAngle,
      audience: s.audience,
      dailyBudget: Math.round(s.dailyBudget),
      spend: 0,
      impressions: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
    }));
    update((w) => ({ ...w, adsets: [...w.adsets, ...newRows] }));
  }

  function addBlank() {
    const row: AdSetRow = {
      id: newId("as"),
      productId: product.id,
      name: `Ad set ${rows.length + 1}`,
      creativeAngle: angles[0] ?? "—",
      audience: "Broad, India, 18-40",
      dailyBudget: 500,
      spend: 0,
      impressions: 0,
      clicks: 0,
      addToCarts: 0,
      purchases: 0,
    };
    update((w) => ({ ...w, adsets: [...w.adsets, row] }));
  }

  function setField(id: string, key: keyof AdSetRow, value: number) {
    update((w) => ({ ...w, adsets: w.adsets.map((a) => (a.id === id ? { ...a, [key]: Number.isFinite(value) ? value : 0 } : a)) }));
  }

  function simulateAll() {
    let i = 0;
    update((w) => ({
      ...w,
      adsets: w.adsets.map((a) => (a.productId === product.id ? simulate(a, product.sellingPrice, i++, be) : a)),
    }));
  }

  function applyScale(id: string, newBudget: number) {
    setField(id, "dailyBudget", newBudget);
  }

  function remove(id: string) {
    update((w) => ({ ...w, adsets: w.adsets.filter((a) => a.id !== id) }));
  }

  return (
    <>
      <PageHeader
        step="Step 4"
        title="Meta ads"
        subtitle={`Plan the test, log the numbers from Ads Manager, and get a KILL / WAIT / KEEP / SCALE call for every ad set, judged against ${product.name}'s RTO-adjusted break-even CPA, not gut feel.`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Break-even CPA (after RTO)"
          value={inr(be)}
          tone={be > 0 ? undefined : "bad"}
          hint="Max ad spend per order before you lose money"
        />
        <Stat label="Break-even ROAS" value={Number.isFinite(econ.roasBreakEven) ? `${econ.roasBreakEven.toFixed(2)}×` : "∞"} hint="On delivered revenue" />
        <Stat label="Delivered rate" value={`${Math.round(econ.deliveredRate * 100)}%`} hint="Share of orders that actually pay out" />
        <Stat label="Selling price" value={inr(product.sellingPrice)} hint={`Landed cost ${inr(product.sourcingCost)} + ship ${inr(product.shippingCost)}`} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2" title="1 · Campaign plan" right={<SourceBadge source={source} />}>
          <div className="flex items-end gap-3">
            <Field label="Total daily budget (₹)">
              <input type="number" className={cx(inputCls, "w-36")} value={dailyBudget} min={300} step={100} onChange={(e) => setDailyBudget(Number(e.target.value))} />
            </Field>
            <Button onClick={generatePlan} loading={loading}>
              <Sparkles className="h-4 w-4" /> Generate plan
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {angles.length ? `Uses your saved creative angles: ${angles.join(", ")}.` : (
              <>
                No saved creatives yet; <Link className="underline" href="/creatives">make some</Link> for a better plan.
              </>
            )}
          </p>
          {error && <p className="mt-2 text-xs text-amber-700">AI unavailable, using the built-in playbook. ({error.slice(0, 120)})</p>}

          {plan && (
            <div className="mt-5 space-y-4 text-sm">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Objective</div>
                <div className="text-zinc-800">{plan.objective}</div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Structure</div>
                <div className="text-zinc-800">{plan.campaignStructure}</div>
              </div>
              <div className="space-y-2">
                {plan.adsets.map((s, i) => (
                  <div key={i} className="rounded-lg border border-zinc-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-zinc-900">{s.name}</div>
                      <Badge tone="green">{inr(s.dailyBudget)}/day</Badge>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">{s.audience}</div>
                    <div className="mt-1 text-xs text-zinc-400">Creative: {s.creativeAngle}</div>
                  </div>
                ))}
              </div>
              <Button variant="secondary" onClick={createAdsets}>
                <Plus className="h-4 w-4" /> Add these ad sets to the tracker
              </Button>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Kill / scale rules</div>
                <ul className="list-disc space-y-1 pl-5 text-zinc-700">
                  {plan.rules.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Pre-launch checklist</div>
                <ul className="space-y-1 text-zinc-700">
                  {plan.checklist.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <input type="checkbox" className="mt-1" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-6 xl:col-span-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Total spend" value={inr(tot.spend)} />
            <Stat label="Orders" value={tot.purchases} />
            <Stat
              label="Blended CPA"
              value={blendedCpa ? inr(blendedCpa) : "—"}
              tone={!blendedCpa ? undefined : blendedCpa <= be ? "good" : "bad"}
              hint={`vs break-even ${inr(be)}`}
            />
            <Stat
              label="Profit after RTO"
              value={inr(totalProfit)}
              tone={tot.spend === 0 ? undefined : totalProfit >= 0 ? "good" : "bad"}
              hint={`RTO-adj. ROAS ${rtoRoas.toFixed(2)}×`}
            />
          </div>

          <Card
            title="2 · Performance tracker & decisions"
            right={
              <div className="flex gap-2">
                <Button variant="secondary" onClick={addBlank}>
                  <Plus className="h-4 w-4" /> Ad set
                </Button>
                <Button variant="secondary" onClick={simulateAll} disabled={rows.length === 0} title="Fill with plausible Indian Meta numbers for a demo">
                  <Dices className="h-4 w-4" /> Simulate 3 days
                </Button>
              </div>
            }
          >
            {rows.length === 0 ? (
              <Empty>Generate a plan and add its ad sets, or add one manually. Then paste the numbers from Ads Manager each evening.</Empty>
            ) : (
              <div className="space-y-4">
                {computed.map(({ a, m, d }) => (
                  <div key={a.id} className="rounded-lg border border-zinc-200 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <input
                        className="min-w-0 flex-1 rounded border border-transparent px-1 text-sm font-medium text-zinc-900 hover:border-zinc-200 focus:border-zinc-300 focus:outline-none"
                        value={a.name}
                        onChange={(e) => update((w) => ({ ...w, adsets: w.adsets.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)) }))}
                      />
                      <span className="text-xs text-zinc-500">{inr(a.dailyBudget)}/day</span>
                      <Badge tone={VERDICT_TONE[d.verdict]} className="text-[11px] font-bold">
                        {d.verdict}
                      </Badge>
                      <button onClick={() => remove(a.id)} className="text-zinc-400 hover:text-red-600" title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {NUM_FIELDS.map((f) => (
                        <label key={f.key} className="block">
                          <span className="block text-[10px] uppercase text-zinc-400">{f.label}</span>
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-md border border-zinc-200 px-2 py-1 text-sm tabular-nums focus:border-zinc-400 focus:outline-none"
                            value={a[f.key]}
                            onChange={(e) => setField(a.id, f.key, Number(e.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-zinc-600 sm:grid-cols-7">
                      <Metric label="CTR" value={`${(m.ctr * 100).toFixed(2)}%`} bad={a.impressions >= 1000 && m.ctr < 0.008} />
                      <Metric label="CPC" value={m.cpc ? inr(m.cpc) : "—"} />
                      <Metric label="CPM" value={m.cpm ? inr(m.cpm) : "—"} />
                      <Metric label="Cost/ATC" value={m.costPerAtc ? inr(m.costPerAtc) : "—"} />
                      <Metric label="CPA" value={m.cpa ? inr(m.cpa) : "—"} bad={m.cpa > be} good={m.cpa > 0 && m.cpa <= be} />
                      <Metric label="ROAS" value={`${m.roas.toFixed(2)}×`} />
                      <Metric label="RTO-adj ROAS" value={`${m.rtoRoas.toFixed(2)}×`} good={m.profit > 0} bad={a.spend > 0 && m.profit < 0} />
                    </div>
                    <div
                      className={cx(
                        "mt-2 flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
                        d.verdict === "KILL" && "bg-red-50 text-red-800",
                        d.verdict === "SCALE" && "bg-emerald-50 text-emerald-800",
                        d.verdict === "KEEP" && "bg-sky-50 text-sky-800",
                        d.verdict === "WAIT" && "bg-zinc-50 text-zinc-700",
                      )}
                    >
                      <span className="flex-1">{d.reasons.join(" ")}</span>
                      <span className="font-medium">{inr(m.profit)} profit after RTO</span>
                      {d.verdict === "SCALE" && d.newBudget && (
                        <button onClick={() => applyScale(a.id, d.newBudget!)} className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 font-medium text-white hover:bg-emerald-500">
                          <ArrowUpRight className="h-3 w-3" /> Apply {inr(d.newBudget)}/day
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 flex items-start gap-1.5 text-[11px] text-zinc-400">
              <Info className="mt-px h-3 w-3 shrink-0" />
              Numbers are entered from Ads Manager (or simulated for a demo). Pulling them automatically through the Meta Marketing API and pushing budget changes back is the next integration.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-zinc-400">{label}</div>
      <div className={cx("tabular-nums", good && "font-medium text-emerald-600", bad && "font-medium text-red-600")}>{value}</div>
    </div>
  );
}
