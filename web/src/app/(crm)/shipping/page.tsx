"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, ExternalLink, Mail, MessageCircle, Plug, RefreshCw, Truck, Unplug } from "lucide-react";
import { useWorkspace } from "@/lib/store";
import type { Order } from "@/lib/types";
import { assessOrder, BAND_STYLE } from "@/lib/rto";
import { inr } from "@/lib/economics";
import { COURIER_LABEL, STATUS_LABEL, STATUS_TONE, type Courier, type NotificationLog, type Shipment } from "@/lib/couriers";
import type { PublicIntegrations } from "@/lib/shipping-store";
import { Badge, Button, Card, Empty, Field, PageHeader, Stat, cx, inputCls } from "@/components/ui";

type Provider = keyof PublicIntegrations;

const PROVIDER_META: Record<Provider, { title: string; kind: "Courier" | "Messaging"; blurb: string; fields: { key: string; label: string; type?: string; placeholder: string }[] }> = {
  shiprocket: {
    title: "Shiprocket",
    kind: "Courier",
    blurb: "Track every AWB across Shiprocket's 25+ couriers. Use an API user (Settings → API → Configure).",
    fields: [
      { key: "email", label: "API user email", placeholder: "api-user@yourstore.in" },
      { key: "password", label: "API user password", type: "password", placeholder: "••••••••" },
    ],
  },
  delhivery: {
    title: "Delhivery",
    kind: "Courier",
    blurb: "Direct Delhivery account. Paste the API token from the Delhivery One developer portal.",
    fields: [{ key: "apiToken", label: "API token", type: "password", placeholder: "e.g. 3f9a…" }],
  },
  whatsapp: {
    title: "WhatsApp Cloud API",
    kind: "Messaging",
    blurb: "Auto-send shipment updates from your business number via Meta. Without it, DropOS queues messages for one-click sending.",
    fields: [
      { key: "phoneNumberId", label: "Phone number ID", placeholder: "1234567890123" },
      { key: "accessToken", label: "Permanent access token", type: "password", placeholder: "EAAG…" },
    ],
  },
  email: {
    title: "Email (Resend)",
    kind: "Messaging",
    blurb: "Send tracking emails from your domain via Resend.",
    fields: [
      { key: "resendApiKey", label: "Resend API key", type: "password", placeholder: "re_…" },
      { key: "from", label: "From address", placeholder: "orders@yourstore.in" },
    ],
  },
};

const READY: Order["status"][] = ["confirmed", "converted-prepaid", "new"];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body;
}

function waLink(n: NotificationLog, orderId: string) {
  const text = encodeURIComponent(n.message);
  // Demo orders never open a chat with a real-looking number.
  return orderId.startsWith("#D") ? `https://wa.me/?text=${text}` : `https://wa.me/${n.to}?text=${text}`;
}

export default function ShippingPage() {
  const { ws, update, activeProduct } = useWorkspace();
  const [integrations, setIntegrations] = useState<PublicIntegrations | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [connecting, setConnecting] = useState<Provider | null>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string>();
  const [shipFor, setShipFor] = useState<Order | null>(null);
  const [shipForm, setShipForm] = useState<{ courier: Courier; awb: string; email: string }>({ courier: "demo", awb: "", email: "" });
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const orderIds = useMemo(() => ws.orders.map((o) => o.id).join(","), [ws.orders]);

  useEffect(() => {
    api<PublicIntegrations>("/api/integrations").then(setIntegrations).catch(() => {});
  }, []);
  useEffect(() => {
    if (!orderIds) return;
    let live = true;
    api<{ shipments: Shipment[] }>(`/api/shipments?orderIds=${encodeURIComponent(orderIds)}`)
      .then((r) => live && setShipments(r.shipments))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [orderIds]);

  const shippedOrderIds = useMemo(() => new Set(shipments.map((s) => s.orderId)), [shipments]);
  const ready = useMemo(
    () =>
      ws.orders
        .filter((o) => READY.includes(o.status) && !shippedOrderIds.has(o.id))
        .map((order) => ({ order, risk: assessOrder(order, { orders: ws.orders }) }))
        .sort((a, b) => Number(b.order.status !== "new") - Number(a.order.status !== "new") || a.risk.score - b.risk.score),
    [ws.orders, shippedOrderIds],
  );

  const stats = useMemo(() => {
    const c = (f: (s: Shipment) => boolean) => shipments.filter(f).length;
    const logs = shipments.flatMap((s) => s.notifications);
    return {
      moving: c((s) => ["booked", "picked_up", "in_transit"].includes(s.status)),
      ofd: c((s) => s.status === "out_for_delivery"),
      delivered: c((s) => s.status === "delivered"),
      problems: c((s) => s.status === "ndr" || s.status.startsWith("rto")),
      sent: logs.filter((l) => l.status === "sent").length,
      queued: logs.filter((l) => l.status === "queued").length,
    };
  }, [shipments]);

  const connectedCouriers: Courier[] = ["demo", ...(["shiprocket", "delhivery"] as const).filter((p) => integrations?.[p].connected)];

  function syncOrderStatus(s: Shipment) {
    const next: Order["status"] | null = s.status === "delivered" ? "delivered" : s.status === "rto_delivered" ? "rto" : null;
    if (!next) return;
    update((w) => ({ ...w, orders: w.orders.map((o) => (o.id === s.orderId && o.status !== next ? { ...o, status: next } : o)) }));
  }

  function upsert(s: Shipment) {
    setShipments((list) => [s, ...list.filter((x) => x.id !== s.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async function connect(p: Provider) {
    setBusy(`connect-${p}`);
    setErr(undefined);
    try {
      const r = await api<{ integrations: PublicIntegrations }>("/api/integrations", { method: "POST", body: JSON.stringify({ provider: p, credentials: creds }) });
      setIntegrations(r.integrations);
      setConnecting(null);
      setCreds({});
    } catch (e) {
      setErr(`${PROVIDER_META[p].title}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(p: Provider) {
    if (!confirm(`Disconnect ${PROVIDER_META[p].title}?`)) return;
    const r = await api<{ integrations: PublicIntegrations }>(`/api/integrations?provider=${p}`, { method: "DELETE" });
    setIntegrations(r.integrations);
  }

  async function createShipment() {
    if (!shipFor) return;
    setBusy("ship");
    setErr(undefined);
    try {
      const product = ws.products.find((p) => p.id === shipFor.productId) ?? activeProduct;
      const r = await api<{ shipment: Shipment }>("/api/shipments", {
        method: "POST",
        body: JSON.stringify({
          order: shipFor,
          courier: shipForm.courier,
          awb: shipForm.awb,
          email: shipForm.email,
          storeName: ws.websites.find((w) => w.productId === product?.id)?.content.brandName ?? ws.teamName,
          productName: product?.name,
          origin: window.location.origin,
        }),
      });
      upsert(r.shipment);
      update((w) => ({ ...w, orders: w.orders.map((o) => (o.id === shipFor.id ? { ...o, status: "shipped" } : o)) }));
      setShipFor(null);
      setOpen(r.shipment.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function refresh(s: Shipment) {
    setBusy(`refresh-${s.id}`);
    try {
      const r = await api<{ shipment: Shipment }>(`/api/shipments/${s.id}`, { method: "POST", body: JSON.stringify({ action: "refresh", origin: window.location.origin }) });
      upsert(r.shipment);
      syncOrderStatus(r.shipment);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function refreshAll() {
    setBusy("all");
    try {
      for (const s of shipments.filter((x) => x.status !== "delivered" && x.status !== "rto_delivered")) {
        const r = await api<{ shipment: Shipment }>(`/api/shipments/${s.id}`, { method: "POST", body: JSON.stringify({ action: "refresh", origin: window.location.origin }) });
        upsert(r.shipment);
        syncOrderStatus(r.shipment);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1200);
  }

  const trackUrl = (s: Shipment) => (typeof window === "undefined" ? `/t/${s.id}` : `${window.location.origin}/t/${s.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        step="Step 7 · Delivery"
        title="Shipping & tracking"
        subtitle="Connect Shiprocket or Delhivery, ship confirmed orders, and track every parcel here. Customers get a live tracking link plus WhatsApp and email updates when the parcel ships, goes out for delivery and is delivered."
        actions={
          shipments.length > 0 && (
            <Button variant="secondary" loading={busy === "all"} onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" /> Refresh all
            </Button>
          )
        }
      />

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {/* 1 · Partners */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-zinc-900">Demo courier</div>
            <Badge tone="green">Always on</Badge>
          </div>
          <p className="mt-2 text-xs text-zinc-600">Simulates a real journey one step per refresh, so you can show the full flow without courier keys.</p>
        </div>
        {(Object.keys(PROVIDER_META) as Provider[]).map((p) => {
          const meta = PROVIDER_META[p];
          const st = integrations?.[p];
          return (
            <div key={p} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{meta.kind}</div>
                  <div className="text-sm font-semibold text-zinc-900">{meta.title}</div>
                </div>
                {st?.connected ? <Badge tone="green">Connected</Badge> : <Badge>Not connected</Badge>}
              </div>
              <p className="mt-2 text-xs text-zinc-500">{meta.blurb}</p>
              {st?.connected ? (
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
                  <span className="truncate font-mono">{st.hint}</span>
                  <button className="flex items-center gap-1 text-red-600 hover:underline" onClick={() => disconnect(p)}>
                    <Unplug className="h-3.5 w-3.5" /> Disconnect
                  </button>
                </div>
              ) : connecting === p ? (
                <div className="mt-3 space-y-2">
                  {meta.fields.map((f) => (
                    <input
                      key={f.key}
                      className={cx(inputCls, "py-1.5 text-xs")}
                      type={f.type ?? "text"}
                      placeholder={`${f.label}: ${f.placeholder}`}
                      value={creds[f.key] ?? ""}
                      onChange={(e) => setCreds((c) => ({ ...c, [f.key]: e.target.value }))}
                      autoComplete="off"
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button className="px-2.5 py-1.5 text-xs" loading={busy === `connect-${p}`} onClick={() => connect(p)}>
                      Save
                    </Button>
                    <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => setConnecting(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-3 px-2.5 py-1.5 text-xs"
                  onClick={() => {
                    setConnecting(p);
                    setCreds({});
                  }}
                >
                  <Plug className="h-3.5 w-3.5" /> Connect
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <p className="-mt-3 text-[11px] text-zinc-400">
        Credentials are stored only on your DropOS server and never sent back to the browser. WhatsApp note: messages a customer didn&apos;t start need a
        Meta-approved template outside the 24-hour window. Until WhatsApp is connected, every update is queued here with a one-click send link.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="In transit" value={stats.moving} />
        <Stat label="Out for delivery" value={stats.ofd} tone={stats.ofd ? "warn" : undefined} />
        <Stat label="Delivered" value={stats.delivered} tone={stats.delivered ? "good" : undefined} />
        <Stat label="Failed attempt / RTO" value={stats.problems} tone={stats.problems ? "bad" : undefined} />
        <Stat label="Customer messages" value={`${stats.sent} sent`} hint={`${stats.queued} queued for one-click send`} />
      </div>

      {/* 2 · Ready to ship */}
      <Card title={`Ready to ship (${ready.length})`}>
        {ready.length === 0 ? (
          <p className="text-sm text-zinc-500">No orders waiting. Confirm COD orders on the Orders &amp; RTO page, or sync website orders, and they&apos;ll appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Order</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Destination</th>
                  <th className="py-2 pr-3 text-right font-medium">Amount</th>
                  <th className="py-2 pr-3 font-medium">RTO risk</th>
                  <th className="py-2 pr-3 font-medium">Order status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {ready.slice(0, 25).map(({ order, risk }) => (
                  <tr key={order.id} className="border-b border-zinc-100 last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-xs">
                      {order.id} <Badge tone={order.payment === "COD" ? "amber" : "green"}>{order.payment}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">{order.customerName}</td>
                    <td className="py-2.5 pr-3 text-zinc-600">
                      {order.city} · {order.pincode}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{inr(order.amount)}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={BAND_STYLE[risk.band].tone}>{BAND_STYLE[risk.band].label}</Badge>
                      {(risk.band === "high" || risk.band === "critical") && order.status === "new" && (
                        <span className="ml-2 text-xs text-red-600">verify before shipping</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs capitalize text-zinc-600">{order.status.replace("-", " ")}</td>
                    <td className="py-2.5 text-right">
                      <Button
                        className="px-2.5 py-1.5 text-xs"
                        variant={order.status === "new" ? "secondary" : "primary"}
                        onClick={() => {
                          setShipFor(order);
                          setShipForm({ courier: connectedCouriers.at(-1) ?? "demo", awb: "", email: order.email ?? "" });
                        }}
                      >
                        <Truck className="h-3.5 w-3.5" /> Ship
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 3 · Shipments */}
      <Card title={`Shipments (${shipments.length})`}>
        {shipments.length === 0 ? (
          <Empty>No shipments yet. Hit &quot;Ship&quot; on an order above: the customer gets a tracking link on WhatsApp and email.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="w-6 py-2"></th>
                  <th className="py-2 pr-3 font-medium">Order / AWB</th>
                  <th className="py-2 pr-3 font-medium">Customer</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Latest update</th>
                  <th className="py-2 pr-3 font-medium">Customer tracking link</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => {
                  const last = s.events.at(-1);
                  const isOpen = open === s.id;
                  const url = trackUrl(s);
                  return (
                    <ShipmentRows key={s.id}>
                      <tr className="border-b border-zinc-100 align-top">
                        <td className="py-3">
                          <button onClick={() => setOpen(isOpen ? null : s.id)} className="text-zinc-400 hover:text-zinc-700">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="font-mono text-xs">{s.orderId}</div>
                          <div className="text-xs text-zinc-500">
                            {COURIER_LABEL[s.courier]} · <span className="font-mono">{s.awb}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <div>{s.customerName}</div>
                          <div className="text-xs text-zinc-500">
                            {s.city} · {s.payment} {inr(s.amount)}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                          {s.lastError && <div className="mt-1 max-w-[200px] text-[11px] text-red-600">{s.lastError}</div>}
                        </td>
                        <td className="max-w-[240px] py-3 pr-3 text-xs text-zinc-600">
                          {last?.label}
                          {last?.location && <div className="text-zinc-400">{last.location}</div>}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2 text-xs">
                            <a href={`/t/${s.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-medium text-zinc-900 hover:underline">
                              /t/{s.id} <ExternalLink className="h-3 w-3" />
                            </a>
                            <button onClick={() => copy(url, s.id)} className="text-zinc-400 hover:text-zinc-700" title="Copy link">
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            {copied === s.id && <span className="text-emerald-600">Copied</span>}
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            variant="secondary"
                            className="px-2.5 py-1.5 text-xs"
                            loading={busy === `refresh-${s.id}`}
                            disabled={s.status === "delivered" || s.status === "rto_delivered"}
                            onClick={() => refresh(s)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Refresh
                          </Button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-zinc-100 bg-zinc-50/70">
                          <td></td>
                          <td colSpan={6} className="py-4">
                            <div className="grid gap-6 md:grid-cols-2">
                              <div>
                                <div className="mb-2 text-xs font-semibold text-zinc-700">Tracking timeline</div>
                                <ol className="relative space-y-3 border-l border-zinc-200 pl-4">
                                  {[...s.events].reverse().map((e, i) => (
                                    <li key={`${e.at}-${i}`} className="relative text-xs">
                                      <span className={cx("absolute -left-[21px] top-1 h-2 w-2 rounded-full", i === 0 ? "bg-emerald-500" : "bg-zinc-300")} />
                                      <div className="text-zinc-800">{e.label}</div>
                                      <div className="text-zinc-500">
                                        {new Date(e.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                                        {e.location ? ` · ${e.location}` : ""}
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                              <div>
                                <div className="mb-2 text-xs font-semibold text-zinc-700">Customer messages</div>
                                {s.notifications.length === 0 ? (
                                  <p className="text-xs text-zinc-500">None yet.</p>
                                ) : (
                                  <ul className="space-y-2">
                                    {[...s.notifications].reverse().map((n, i) => (
                                      <li key={`${n.at}-${n.channel}-${i}`} className="rounded-lg border border-zinc-200 bg-white p-2.5 text-xs">
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                          <span className="flex items-center gap-1.5 font-medium text-zinc-800">
                                            {n.channel === "whatsapp" ? <MessageCircle className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                                            {n.event.replace(/_/g, " ")} · {n.channel}
                                          </span>
                                          <Badge tone={n.status === "sent" ? "green" : n.status === "queued" ? "amber" : "red"}>{n.status}</Badge>
                                        </div>
                                        <div className="line-clamp-3 whitespace-pre-line text-zinc-600">{n.message}</div>
                                        {n.error && <div className="mt-1 text-red-600">{n.error}</div>}
                                        {n.status !== "sent" && (
                                          <div className="mt-2">
                                            {n.channel === "whatsapp" ? (
                                              <a className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline" target="_blank" rel="noreferrer" href={waLink(n, s.orderId)}>
                                                <MessageCircle className="h-3.5 w-3.5" /> Send on WhatsApp
                                              </a>
                                            ) : (
                                              <a
                                                className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline"
                                                href={`mailto:${n.to}?subject=${encodeURIComponent(n.subject ?? "")}&body=${encodeURIComponent(n.message)}`}
                                              >
                                                <Mail className="h-3.5 w-3.5" /> Send email
                                              </a>
                                            )}
                                          </div>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </ShipmentRows>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ship modal */}
      {shipFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShipFor(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-sm font-semibold text-zinc-900">Ship order {shipFor.id}</div>
            <div className="mb-4 text-xs text-zinc-500">
              {shipFor.customerName} · {shipFor.city} {shipFor.pincode} · {shipFor.payment} {inr(shipFor.amount)}
            </div>
            <div className="space-y-3">
              <Field label="Delivery partner">
                <select className={inputCls} value={shipForm.courier} onChange={(e) => setShipForm((f) => ({ ...f, courier: e.target.value as Courier }))}>
                  {connectedCouriers.map((c) => (
                    <option key={c} value={c}>
                      {COURIER_LABEL[c]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="AWB / waybill number" hint={shipForm.courier === "demo" ? "Leave blank: the demo courier generates one." : "From your Shiprocket / Delhivery booking."}>
                <input className={inputCls} value={shipForm.awb} onChange={(e) => setShipForm((f) => ({ ...f, awb: e.target.value }))} placeholder={shipForm.courier === "demo" ? "auto" : "e.g. 1234567890123"} />
              </Field>
              <Field label="Customer email (optional)" hint="We'll email the tracking link too.">
                <input className={inputCls} type="email" value={shipForm.email} onChange={(e) => setShipForm((f) => ({ ...f, email: e.target.value }))} placeholder="customer@gmail.com" />
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShipFor(null)}>
                Cancel
              </Button>
              <Button loading={busy === "ship"} disabled={shipForm.courier !== "demo" && !shipForm.awb.trim()} onClick={createShipment}>
                <Truck className="h-4 w-4" /> Ship &amp; notify customer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShipmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
