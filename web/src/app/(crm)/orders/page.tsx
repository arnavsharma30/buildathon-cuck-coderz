"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Copy, Globe, MessageCircle, RefreshCw, Truck, Upload, X } from "lucide-react";
import { useWorkspace, postJSON } from "@/lib/store";
import type { Order } from "@/lib/types";
import { assessOrder, portfolioImpact, BAND_STYLE, normalizePhone, type RtoAssessment, type RiskBand } from "@/lib/rto";
import { demoOrders, ordersFromShopifyCSV } from "@/lib/orders-demo";
import { inr, pct } from "@/lib/economics";
import { Badge, Button, Card, Empty, PageHeader, SourceBadge, Stat, cx } from "@/components/ui";

const STATUS_LABEL: Record<Order["status"], string> = {
  new: "New",
  confirmed: "Confirmed",
  "converted-prepaid": "Paid via UPI",
  cancelled: "Cancelled",
  shipped: "Shipped",
  delivered: "Delivered",
  rto: "RTO",
};

type Filter = "all" | RiskBand;

export default function OrdersPage() {
  const { ws, update, activeProduct } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ order: Order; risk: RtoAssessment; message: string; source?: "claude" | "demo"; loading: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string>();
  const published = ws.websites.filter((s) => s.publishedAt);

  const active = useMemo(() => ws.orders.filter((o) => o.status !== "delivered" && o.status !== "rto"), [ws.orders]);
  const assessed = useMemo(
    () =>
      active
        .map((order) => ({ order, risk: assessOrder(order, { orders: ws.orders }) }))
        .sort((a, b) => b.risk.score - a.risk.score),
    [active, ws.orders],
  );
  const pending = assessed.filter((a) => a.order.status === "new");

  const fwd = activeProduct?.shippingCost ?? 65;
  const cost = activeProduct?.sourcingCost ?? 250;
  const impact = useMemo(() => portfolioImpact(pending, ws.economics, fwd, cost), [pending, ws.economics, fwd, cost]);

  const counts = useMemo(() => {
    const c: Record<RiskBand, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const a of pending) c[a.risk.band]++;
    return c;
  }, [pending]);

  const shown = assessed.filter((a) => filter === "all" || a.risk.band === filter);

  function setStatus(id: string, status: Order["status"]) {
    update((w) => ({ ...w, orders: w.orders.map((o) => (o.id === id ? { ...o, status } : o)) }));
  }

  function loadDemo() {
    update((w) => ({ ...w, orders: demoOrders(activeProduct?.id) }));
  }

  async function onFile(f: File) {
    const text = await f.text();
    const orders = ordersFromShopifyCSV(text, activeProduct?.id);
    if (!orders.length) return alert("Couldn't read any orders from that CSV. Use Shopify Admin → Orders → Export.");
    update((w) => ({ ...w, orders: [...w.orders.filter((o) => !orders.some((n) => n.id === o.id)), ...orders] }));
  }

  /** Pull COD orders placed on the team's published DropOS store pages. */
  async function syncWebsiteOrders() {
    setSyncing(true);
    setSyncMsg(undefined);
    try {
      const batches = await Promise.all(
        published.map(async (site) => {
          const res = await fetch(`/api/sites/${encodeURIComponent(site.slug)}/orders`);
          if (!res.ok) return [] as Order[];
          const body = (await res.json()) as { orders?: Order[] };
          return (body.orders ?? []).map((o) => ({ ...o, source: "website" as const, productId: o.productId ?? site.productId }));
        }),
      );
      const incoming = batches.flat();
      update((w) => {
        const known = new Set(w.orders.map((o) => o.id));
        const fresh = incoming.filter((o) => !known.has(o.id));
        return fresh.length ? { ...w, orders: [...fresh, ...w.orders] } : w;
      });
      setSyncMsg(incoming.length ? `${incoming.length} order(s) on your website, all synced into the dispatch queue.` : "No website orders yet.");
    } catch (e) {
      setSyncMsg(`Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSyncing(false);
    }
  }

  async function openDraft(order: Order, risk: RtoAssessment) {
    setDraft({ order, risk, message: "", loading: true });
    try {
      const res = await postJSON<{ data: { message: string }; source: "claude" | "demo" }>("/api/orders/message", {
        order,
        productName: activeProduct?.name,
        storeName: ws.teamName,
        kind: risk.action.code,
        reasons: risk.signals.filter((s) => s.points > 0).map((s) => s.label),
      });
      setDraft({ order, risk, message: res.data.message, source: res.source, loading: false });
    } catch (e) {
      setDraft({ order, risk, message: `Couldn't draft message: ${e}`, loading: false });
    }
  }

  return (
    <div>
      <PageHeader
        step="Step 5 · Fulfilment"
        title="Orders & RTO control"
        subtitle="Every COD order that comes back costs you forward + reverse shipping and the ad that brought it. DropOS scores each new order for RTO risk before you ship, explains why, and tells you the action an experienced operator would take."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            {published.length > 0 && (
              <Button variant="secondary" loading={syncing} onClick={syncWebsiteOrders}>
                <RefreshCw className="h-4 w-4" /> Sync website orders
              </Button>
            )}
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import Shopify CSV
            </Button>
            <Button onClick={loadDemo}>Load sample orders</Button>
          </>
        }
      />

      {syncMsg && <p className="-mt-3 mb-4 text-sm text-zinc-600">{syncMsg}</p>}

      {ws.orders.length === 0 ? (
        <Empty>
          No orders yet. Export orders from Shopify (Orders → Export → CSV) and import them, or load the sample orders to see the
          RTO engine in action.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Orders awaiting dispatch" value={pending.length} hint={`${pct(impact.codShare)} COD`} />
            <Stat
              label="Expected RTO if you ship all"
              value={pct(impact.rtoRateBlind)}
              tone="bad"
              hint={`≈ ${impact.expectedRtoBlind.toFixed(1)} parcels back · ${inr(impact.lossBlind)} lost`}
            />
            <Stat
              label="Expected RTO with DropOS actions"
              value={pct(impact.rtoRateWithActions)}
              tone="good"
              hint={`≈ ${impact.expectedRtoWithActions.toFixed(1)} parcels back · ${inr(impact.lossWithActions)} lost`}
            />
            <Stat label="Money saved on this batch" value={inr(impact.saved)} tone="good" hint="shipping + lost units, before ad spend" />
            <Stat
              label="Needs attention"
              value={counts.high + counts.critical}
              tone={counts.high + counts.critical ? "warn" : undefined}
              hint={`${counts.critical} critical · ${counts.high} high · ${counts.medium} medium`}
            />
          </div>

          <Card className="mt-5" title="Dispatch queue (riskiest first)" right={
            <div className="flex gap-1">
              {(["all", "critical", "high", "medium", "low"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cx(
                    "rounded-md px-2.5 py-1 text-xs font-medium capitalize",
                    filter === f ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
                  )}
                >
                  {f} {f !== "all" && <span className="opacity-60">{counts[f]}</span>}
                </button>
              ))}
            </div>
          }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                    <th className="w-6 py-2"></th>
                    <th className="py-2">Order</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Destination</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2">Risk</th>
                    <th className="py-2">Why</th>
                    <th className="py-2">Recommended action</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ order, risk }) => {
                    const isOpen = open === order.id;
                    const top = risk.signals.filter((s) => s.points > 0).sort((a, b) => b.points - a.points).slice(0, 2);
                    return (
                      <FragmentRow key={order.id}>
                        <tr className={cx("border-b border-zinc-100 align-top", order.status !== "new" && "opacity-60")}>
                          <td className="py-3">
                            <button onClick={() => setOpen(isOpen ? null : order.id)} className="text-zinc-400 hover:text-zinc-700">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="py-3 font-mono text-xs">
                            {order.id}
                            <div className="mt-1 flex flex-wrap gap-1">
                              <Badge tone={order.payment === "COD" ? "amber" : "green"}>{order.payment}</Badge>
                              {order.source === "website" && (
                                <Badge tone="blue">
                                  <Globe className="h-3 w-3" /> Site
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-zinc-900">{order.customerName || "—"}</div>
                            <div className="text-xs text-zinc-500">{order.phone}</div>
                          </td>
                          <td className="py-3">
                            <div>{order.city}</div>
                            <div className="text-xs text-zinc-500">
                              {order.state} · {order.pincode}
                            </div>
                          </td>
                          <td className="py-3 text-right tabular-nums">{inr(order.amount)}</td>
                          <td className="py-3">
                            <RiskMeter risk={risk} />
                          </td>
                          <td className="max-w-[240px] py-3 text-xs text-zinc-600">
                            {top.map((s) => (
                              <div key={s.key}>• {s.label}</div>
                            ))}
                            {risk.duplicateOf && <Badge tone="red" className="mt-1">Duplicate?</Badge>}
                          </td>
                          <td className="py-3">
                            <div className="font-medium text-zinc-900">{risk.action.label}</div>
                            <div className="max-w-[220px] text-xs text-zinc-500">{risk.action.detail}</div>
                            {order.status === "new" && (
                              <Button variant="secondary" className="mt-2 px-2.5 py-1 text-xs" onClick={() => openDraft(order, risk)}>
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp draft
                              </Button>
                            )}
                            {(order.status === "confirmed" || order.status === "converted-prepaid") && (
                              <Link
                                href="/shipping"
                                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700"
                              >
                                <Truck className="h-3.5 w-3.5" /> Ship →
                              </Link>
                            )}
                          </td>
                          <td className="py-3">
                            <select
                              value={order.status}
                              onChange={(e) => setStatus(order.id, e.target.value as Order["status"])}
                              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"
                            >
                              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-zinc-100 bg-zinc-50/70">
                            <td></td>
                            <td colSpan={8} className="py-3">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <div className="mb-2 text-xs font-semibold text-zinc-700">
                                    Risk breakdown: score {risk.score}/100 → {pct(risk.probability)} estimated RTO chance
                                  </div>
                                  <ul className="space-y-1 text-xs">
                                    {risk.signals.map((s) => (
                                      <li key={s.key} className="flex justify-between gap-4">
                                        <span className="text-zinc-600">{s.label}</span>
                                        <span className={cx("tabular-nums font-medium", s.points > 0 ? "text-red-600" : "text-emerald-600")}>
                                          {s.points > 0 ? `+${s.points}` : s.points}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="text-xs text-zinc-600">
                                  <div className="mb-2 font-semibold text-zinc-700">Shipping address</div>
                                  <div>{order.customerName}</div>
                                  <div>{order.address}</div>
                                  <div>
                                    {order.city}, {order.state} {order.pincode}
                                  </div>
                                  <div className="mt-2">
                                    Placed {new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} · Qty {order.quantity}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </FragmentRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="mt-5" title="How the score works">
            <p className="text-sm text-zinc-600">
              Each order starts from its payment mode (COD +25, prepaid −20), then adds points for signals that experienced operators check by hand:
              pincode zone (metro hubs lower risk; regions with historically high COD refusal raise it), invalid or fake phone numbers, vague or
              junk addresses, gibberish names, late-night impulse orders, high-value or bulk COD baskets, duplicates within 24h, and customers who
              refused a parcel before. Scores map to an estimated RTO probability and an action: <b>ship</b>, <b>confirm + prepaid offer</b>,{" "}
              <b>call + ₹99 advance</b>, or <b>hold</b>. Weights are heuristic estimates, not a trained model; a team can tune them as it collects
              its own delivery data.
            </p>
          </Card>
        </>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setDraft(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">WhatsApp to {draft.order.customerName}</div>
                <div className="text-xs text-zinc-500">
                  {draft.order.id} · {draft.risk.action.label}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge source={draft.source} />
                <button onClick={() => setDraft(null)} className="text-zinc-400 hover:text-zinc-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <textarea
              className="h-44 w-full rounded-lg border border-zinc-300 p-3 text-sm"
              value={draft.loading ? "Drafting…" : draft.message}
              onChange={(e) => setDraft({ ...draft, message: e.target.value })}
            />
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => navigator.clipboard.writeText(draft.message)}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <a
                target="_blank"
                rel="noreferrer"
                href={
                  // Demo orders never open a chat with a real number.
                  draft.order.id.startsWith("#D")
                    ? `https://wa.me/?text=${encodeURIComponent(draft.message)}`
                    : `https://wa.me/91${normalizePhone(draft.order.phone)}?text=${encodeURIComponent(draft.message)}`
                }
              >
                <Button>
                  <MessageCircle className="h-4 w-4" /> Open in WhatsApp
                </Button>
              </a>
              <Button
                variant="secondary"
                onClick={() => {
                  setStatus(draft.order.id, draft.risk.action.code === "hold" ? "new" : "confirmed");
                  setDraft(null);
                }}
              >
                Mark confirmed
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function RiskMeter({ risk }: { risk: RtoAssessment }) {
  const s = BAND_STYLE[risk.band];
  const color = { low: "bg-emerald-500", medium: "bg-amber-400", high: "bg-red-500", critical: "bg-violet-600" }[risk.band];
  return (
    <div className="w-28">
      <div className="flex items-center justify-between">
        <Badge tone={s.tone}>{s.label}</Badge>
        <span className="text-xs tabular-nums text-zinc-600">{pct(risk.probability)}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100">
        <div className={cx("h-1.5 rounded-full", color)} style={{ width: `${Math.max(4, risk.score)}%` }} />
      </div>
    </div>
  );
}
