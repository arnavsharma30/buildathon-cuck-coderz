"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle, Mail, Store, Search, X, Trophy, AlertTriangle, ClipboardPaste, Star } from "lucide-react";
import { Badge, Button, Card, Empty, Field, PageHeader, SourceBadge, Stat, cx, inputCls } from "@/components/ui";
import { postJSON, useWorkspace, newId } from "@/lib/store";
import { inr, unitEconomics } from "@/lib/economics";
import { computeLanded, SAMPLE_REPLIES, scoreQuote, type Channel, type SupplierLead } from "@/lib/suppliers-demo";
import type { Quote, Supplier, SupplierStage } from "@/lib/types";

const STAGES: { id: SupplierStage; label: string; hint: string }[] = [
  { id: "found", label: "Found", hint: "Shortlisted from IndiaMART" },
  { id: "contacted", label: "Contacted", hint: "Waiting for a reply" },
  { id: "quoted", label: "Quoted", hint: "Have rates — compare below" },
  { id: "sampling", label: "Sampling", hint: "Sample ordered" },
  { id: "finalized", label: "Finalized", hint: "Your fulfilment partner" },
];

type SearchSource = "indiamart-live" | "sample";

export default function SuppliersPage() {
  const { ws, ready, update, activeProduct } = useWorkspace();
  const [query, setQueryState] = useState<{ pid: string; q: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [lastSource, setLastSource] = useState<SearchSource | undefined>();
  const [searchError, setSearchError] = useState<string | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<"outreach" | "quote">("outreach");

  const suppliers = useMemo(
    () => ws.suppliers.filter((s) => s.productId === activeProduct?.id),
    [ws.suppliers, activeProduct?.id],
  );

  if (!ready) return null;
  if (!activeProduct) {
    return (
      <>
        <PageHeader step="Step 2" title="Suppliers & quotes" subtitle="Find IndiaMART wholesalers, send outreach, parse quotes and pick a fulfilment partner." />
        <Empty>
          Pick a product first.{" "}
          <Link href="/products" className="font-medium text-zinc-900 underline">
            Go to product research →
          </Link>
        </Empty>
      </>
    );
  }

  const product = activeProduct;
  const q = query && query.pid === product.id ? query.q : product.indiamartQuery || product.name;
  const setQuery = (v: string) => setQueryState({ pid: product.id, q: v });

  async function search() {
    setSearching(true);
    setSearchError(undefined);
    try {
      const res = await postJSON<{ suppliers: SupplierLead[]; source: SearchSource; error?: string }>("/api/suppliers/search", {
        query: q,
        productName: product.name,
        priceHint: product.sourcingCost,
      });
      setLastSource(res.source);
      if (res.error) setSearchError(res.error);
      update((w) => {
        const existing = new Set(w.suppliers.filter((s) => s.productId === product.id).map((s) => s.name.toLowerCase()));
        const fresh: Supplier[] = res.suppliers
          .filter((s) => !existing.has(s.name.toLowerCase()))
          .map((s) => ({ ...s, id: newId("sup"), productId: product.id, stage: "found" }));
        return { ...w, suppliers: [...w.suppliers, ...fresh] };
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  const patch = (id: string, p: Partial<Supplier>) =>
    update((w) => ({ ...w, suppliers: w.suppliers.map((s) => (s.id === id ? { ...s, ...p } : s)) }));

  function finalize(s: Supplier) {
    if (!s.quote) return;
    const quote = s.quote;
    update((w) => ({
      ...w,
      suppliers: w.suppliers.map((x) =>
        x.id === s.id ? { ...x, stage: "finalized" } : x.productId === s.productId && x.stage === "finalized" ? { ...x, stage: "quoted" } : x,
      ),
      products: w.products.map((p) =>
        p.id === s.productId
          ? {
              ...p,
              sourcingCost: Math.round(quote.unitPrice * (1 + quote.gstPercent / 100)),
              shippingCost: quote.shippingPerUnit > 0 ? quote.shippingPerUnit : p.shippingCost,
              status: p.status === "live" ? "live" : "sourcing",
            }
          : p,
      ),
    }));
  }

  const counts = Object.fromEntries(STAGES.map((st) => [st.id, suppliers.filter((s) => s.stage === st.id).length])) as Record<SupplierStage, number>;
  const quoted = suppliers.filter((s) => s.quote && s.stage !== "rejected");
  const rejected = suppliers.filter((s) => s.stage === "rejected");
  const open = suppliers.find((s) => s.id === openId);

  // comparison
  const rows = quoted.map((s) => {
    const quote = s.quote!;
    const productCost = Math.round(quote.unitPrice * (1 + quote.gstPercent / 100) * 100) / 100;
    const econ = unitEconomics(
      { sellingPrice: product.sellingPrice, productCost, shippingFwd: quote.shippingPerUnit || product.shippingCost },
      ws.economics,
    );
    const sc = scoreQuote(quote, econ.profitPerOrder);
    return { s, quote, econ, sc };
  });
  const best = rows.length ? rows.reduce((a, b) => (b.sc.score > a.sc.score ? b : a)) : undefined;
  const bestLanded = rows.length ? Math.min(...rows.map((r) => r.quote.landedCost)) : undefined;

  return (
    <>
      <PageHeader
        step="Step 2"
        title="Suppliers & quotes"
        subtitle={`Source "${product.name}" from IndiaMART: shortlist wholesalers, send outreach in one click, paste their (Hinglish) replies and let DropOS turn them into comparable quotes with real RTO-adjusted profit.`}
      />

      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label="IndiaMART search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  className={cx(inputCls, "pl-9")}
                  value={q}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                  placeholder="e.g. led strip lights wholesale"
                />
              </div>
            </Field>
          </div>
          <Button onClick={search} loading={searching}>
            Find suppliers on IndiaMART
          </Button>
          {lastSource && <SourceBadge source={lastSource} />}
        </div>
        {lastSource === "sample" && (
          <p className="mt-3 text-xs text-zinc-500">
            Showing <b>sample suppliers</b> modelled on real wholesale hubs. Add an <code>ANTHROPIC_API_KEY</code> to search live IndiaMART listings
            (Claude web search, restricted to indiamart.com).
            {searchError && <span className="text-zinc-400"> ({searchError.slice(0, 120)})</span>}
          </p>
        )}
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Shortlisted" value={suppliers.length - rejected.length} />
        <Stat label="Contacted" value={counts.contacted + counts.quoted + counts.sampling + counts.finalized} />
        <Stat label="Quotes in" value={rows.length} />
        <Stat label="Best landed cost" value={bestLanded !== undefined ? inr(bestLanded) : "—"} hint="unit + GST + shipping" />
        <Stat
          label="Partner"
          value={<span className="text-base">{suppliers.find((s) => s.stage === "finalized")?.name ?? "Not yet"}</span>}
          tone={counts.finalized ? "good" : undefined}
        />
      </div>

      {suppliers.length === 0 ? (
        <Empty>No suppliers yet. Search IndiaMART above to build your shortlist.</Empty>
      ) : (
        <div className="mb-6 grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(220px, 1fr))` }}>
          {STAGES.map((st) => (
            <div key={st.id} className="rounded-xl bg-zinc-100/70 p-2.5">
              <div className="mb-2 flex items-center justify-between px-1">
                <div>
                  <div className="text-xs font-semibold text-zinc-800">{st.label}</div>
                  <div className="text-[11px] text-zinc-500">{st.hint}</div>
                </div>
                <Badge>{counts[st.id]}</Badge>
              </div>
              <div className="space-y-2">
                {suppliers
                  .filter((s) => s.stage === st.id)
                  .map((s) => (
                    <SupplierCard
                      key={s.id}
                      s={s}
                      isBest={best?.s.id === s.id}
                      onOutreach={() => {
                        setOpenId(s.id);
                        setOpenTab("outreach");
                      }}
                      onQuote={() => {
                        setOpenId(s.id);
                        setOpenTab("quote");
                      }}
                      onStage={(stage) => patch(s.id, { stage })}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {rejected.length > 0 && (
        <p className="mb-6 text-xs text-zinc-500">
          Rejected: {rejected.map((s) => s.name).join(", ")}{" "}
          <button className="underline" onClick={() => rejected.forEach((s) => patch(s.id, { stage: "found" }))}>
            restore
          </button>
        </p>
      )}

      <Card
        title="Quote comparison"
        right={<span className="text-xs text-zinc-500">Profit uses your RTO / COD / CPA assumptions from Product research · sells at {inr(product.sellingPrice)}</span>}
      >
        {rows.length === 0 ? (
          <Empty>Paste a supplier&apos;s reply on any card (&ldquo;Paste reply&rdquo;) to see it here, side by side.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Supplier</th>
                  <th className="px-2 font-medium">Unit</th>
                  <th className="px-2 font-medium">GST</th>
                  <th className="px-2 font-medium">Ship</th>
                  <th className="px-2 font-medium">Landed</th>
                  <th className="px-2 font-medium">MOQ</th>
                  <th className="px-2 font-medium">Dispatch</th>
                  <th className="px-2 text-center font-medium">Dropship</th>
                  <th className="px-2 text-center font-medium">COD</th>
                  <th className="px-2 text-center font-medium">Blind</th>
                  <th className="px-2 font-medium">Profit / order</th>
                  <th className="px-2 font-medium">Verdict</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...rows]
                  .sort((a, b) => b.sc.score - a.sc.score)
                  .map(({ s, quote, econ, sc }) => {
                    const isBest = best?.s.id === s.id;
                    return (
                      <tr key={s.id} className={cx("border-b border-zinc-100 align-top", isBest && "bg-emerald-50/60")}>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-zinc-900">{s.name}</div>
                          <div className="text-xs text-zinc-500">{s.city}</div>
                          {isBest && (
                            <Badge tone="green" className="mt-1">
                              <Trophy className="h-3 w-3" /> Best pick
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-2.5 tabular-nums">{inr(quote.unitPrice)}</td>
                        <td className="px-2 py-2.5 tabular-nums">{quote.gstPercent}%</td>
                        <td className="px-2 py-2.5 tabular-nums">{quote.shippingPerUnit ? inr(quote.shippingPerUnit) : "—"}</td>
                        <td className="px-2 py-2.5 font-medium tabular-nums">{inr(quote.landedCost)}</td>
                        <td className="px-2 py-2.5 tabular-nums">{quote.moq}</td>
                        <td className="px-2 py-2.5 tabular-nums">{quote.dispatchDays}d</td>
                        <td className="px-2 py-2.5 text-center">
                          <Tick ok={quote.dropshipSupported} />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Tick ok={quote.codSupported} />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Tick ok={quote.blindShipping} />
                        </td>
                        <td className={cx("px-2 py-2.5 font-semibold tabular-nums", econ.profitPerOrder >= 0 ? "text-emerald-600" : "text-red-600")}>
                          {inr(econ.profitPerOrder)}
                          <div className="text-[11px] font-normal text-zinc-500">break-even CPA {inr(econ.profitBeforeAds)}</div>
                        </td>
                        <td className="max-w-64 px-2 py-2.5 text-xs">
                          {sc.warnings.map((w) => (
                            <div key={w} className="flex gap-1 text-amber-700">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                            </div>
                          ))}
                          {sc.reasons.slice(0, 3).map((r) => (
                            <div key={r} className="flex gap-1 text-emerald-700">
                              <Check className="mt-0.5 h-3 w-3 shrink-0" /> {r}
                            </div>
                          ))}
                        </td>
                        <td className="py-2.5 pl-2">
                          {s.stage === "finalized" ? (
                            <Badge tone="green">Partner</Badge>
                          ) : (
                            <Button variant={isBest ? "primary" : "secondary"} className="whitespace-nowrap" onClick={() => finalize(s)}>
                              Finalize
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {open && (
        <SupplierDrawer
          key={open.id}
          s={open}
          tab={openTab}
          setTab={setOpenTab}
          productName={product.name}
          productPrice={product.sellingPrice}
          teamName={ws.teamName}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(open.id, p)}
        />
      )}
    </>
  );
}

function Tick({ ok }: { ok: boolean }) {
  return ok ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <X className="mx-auto h-4 w-4 text-red-500" />;
}

function SupplierCard({
  s,
  isBest,
  onOutreach,
  onQuote,
  onStage,
}: {
  s: Supplier;
  isBest: boolean;
  onOutreach: () => void;
  onQuote: () => void;
  onStage: (st: SupplierStage) => void;
}) {
  return (
    <div className={cx("rounded-lg border bg-white p-3 shadow-sm", isBest ? "border-emerald-400" : "border-zinc-200")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-900" title={s.name}>
            {s.name}
          </div>
          <div className="text-xs text-zinc-500">{s.city}</div>
        </div>
        {s.url && (
          <a href={s.url} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-zinc-700" title="Open listing">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="mt-2 space-y-0.5 text-xs text-zinc-700">
        {s.quote ? (
          <div>
            <b>{inr(s.quote.landedCost)}</b> landed · MOQ {s.quote.moq} · {s.quote.dispatchDays}d
          </div>
        ) : (
          <>
            {s.priceRange && <div>{s.priceRange}</div>}
            {s.moq && <div className="text-zinc-500">MOQ {s.moq}</div>}
          </>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {s.gstVerified && <Badge tone="blue">GST ✓</Badge>}
        {s.trustSeal && <Badge tone="violet">TrustSEAL</Badge>}
        {s.yearsInBusiness ? <Badge>{s.yearsInBusiness} yrs</Badge> : null}
        {s.rating ? (
          <Badge tone="amber">
            <Star className="h-3 w-3" />
            {s.rating}
          </Badge>
        ) : null}
        {s.source === "sample" && <Badge>sample</Badge>}
        {isBest && <Badge tone="green">Best pick</Badge>}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <button onClick={onOutreach} className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-700">
          {s.outreach ? "Outreach ✓" : "Draft outreach"}
        </button>
        <button onClick={onQuote} className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">
          {s.quote ? "Edit quote" : "Paste reply"}
        </button>
        <select
          value={s.stage}
          onChange={(e) => onStage(e.target.value as SupplierStage)}
          className="rounded-md border border-zinc-200 bg-white px-1 py-1 text-[11px] text-zinc-600"
          title="Move stage"
        >
          {STAGES.map((st) => (
            <option key={st.id} value={st.id}>
              {st.label}
            </option>
          ))}
          <option value="rejected">Rejected</option>
        </select>
      </div>
    </div>
  );
}

const CHANNELS: { id: Channel; label: string; icon: typeof MessageCircle }[] = [
  { id: "whatsapp", label: "WhatsApp (Hinglish)", icon: MessageCircle },
  { id: "email", label: "Email", icon: Mail },
  { id: "indiamart", label: "IndiaMART enquiry", icon: Store },
];

function SupplierDrawer({
  s,
  tab,
  setTab,
  productName,
  productPrice,
  teamName,
  onClose,
  onPatch,
}: {
  s: Supplier;
  tab: "outreach" | "quote";
  setTab: (t: "outreach" | "quote") => void;
  productName: string;
  productPrice: number;
  teamName: string;
  onClose: () => void;
  onPatch: (p: Partial<Supplier>) => void;
}) {
  const [channel, setChannel] = useState<Channel>(s.outreach?.channel ?? "whatsapp");
  const [message, setMessage] = useState(s.outreach?.message ?? "");
  const [msgSource, setMsgSource] = useState<"claude" | "demo" | undefined>();
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [reply, setReply] = useState(s.rawReply ?? "");
  const [quote, setQuote] = useState<Quote | undefined>(s.quote);
  const [quoteSource, setQuoteSource] = useState<"claude" | "demo" | undefined>();
  const [parsing, setParsing] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0);

  async function draft(ch: Channel) {
    setDrafting(true);
    try {
      const res = await postJSON<{ message: string; source: "claude" | "demo" }>("/api/suppliers/outreach", {
        product: { name: productName, sellingPrice: productPrice },
        supplier: { name: s.name, city: s.city },
        channel: ch,
        teamName,
      });
      setMessage(res.message);
      setMsgSource(res.source);
    } finally {
      setDrafting(false);
    }
  }

  async function parse() {
    setParsing(true);
    try {
      const res = await postJSON<{ quote: Quote; source: "claude" | "demo" }>("/api/suppliers/parse-quote", { rawReply: reply, productName });
      setQuote(res.quote);
      setQuoteSource(res.source);
    } finally {
      setParsing(false);
    }
  }

  const phoneDigits = s.source === "indiamart-live" ? (s.phone ?? "").replace(/\D/g, "") : "";
  const waHref = `https://wa.me/${phoneDigits.length >= 10 ? (phoneDigits.length === 10 ? "91" + phoneDigits : phoneDigits) : ""}?text=${encodeURIComponent(message)}`;

  const setQ = (p: Partial<Quote>) =>
    setQuote((q) => {
      if (!q) return q;
      const next = { ...q, ...p };
      return { ...next, landedCost: computeLanded(next) };
    });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/30" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-xs text-zinc-500">{s.city}</div>
            <h2 className="text-lg font-semibold text-zinc-900">{s.name}</h2>
            <div className="mt-1 text-xs text-zinc-500">
              {s.priceRange} {s.moq && `· MOQ ${s.moq}`}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex gap-1 rounded-lg bg-zinc-100 p-1 text-sm">
          {(["outreach", "quote"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx("flex-1 rounded-md px-3 py-1.5 font-medium", tab === t ? "bg-white shadow-sm" : "text-zinc-500")}
            >
              {t === "outreach" ? "1 · Outreach" : "2 · Quote"}
            </button>
          ))}
        </div>

        {tab === "outreach" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setChannel(c.id);
                      draft(c.id);
                    }}
                    className={cx(
                      "flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium",
                      channel === c.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {c.label}
                  </button>
                );
              })}
            </div>
            {!message && (
              <Button onClick={() => draft(channel)} loading={drafting} className="w-full">
                Draft {CHANNELS.find((c) => c.id === channel)?.label} message
              </Button>
            )}
            {message && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-600">Message (edit freely)</span>
                  <div className="flex items-center gap-2">
                    <SourceBadge source={msgSource} />
                    <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => draft(channel)} loading={drafting}>
                      Regenerate
                    </Button>
                  </div>
                </div>
                <textarea className={cx(inputCls, "h-72 font-mono text-xs leading-relaxed")} value={message} onChange={(e) => setMessage(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(message);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
                  </Button>
                  {channel === "whatsapp" && (
                    <a href={waHref} target="_blank" rel="noreferrer">
                      <Button variant="secondary">
                        <MessageCircle className="h-4 w-4" /> Open WhatsApp
                      </Button>
                    </a>
                  )}
                  {channel === "indiamart" && s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      <Button variant="secondary">
                        <ExternalLink className="h-4 w-4" /> Open listing
                      </Button>
                    </a>
                  )}
                  <Button
                    onClick={() => {
                      onPatch({
                        outreach: { channel, message, sentAt: Date.now() },
                        stage: s.stage === "found" ? "contacted" : s.stage,
                      });
                      setTab("quote");
                    }}
                  >
                    <Check className="h-4 w-4" /> Mark contacted
                  </Button>
                </div>
                {s.outreach?.sentAt && (
                  <p className="text-xs text-zinc-500">Contacted via {s.outreach.channel} on {new Date(s.outreach.sentAt).toLocaleString("en-IN")}</p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Paste the supplier's reply (WhatsApp / email / IndiaMART — Hinglish is fine)">
              <textarea
                className={cx(inputCls, "h-32 text-sm")}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="e.g. rate 180 + 18% gst, moq 20 pcs, dispatch 2 din me, cod nahi hoga, shipping 60 extra…"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={parse} loading={parsing} disabled={!reply.trim()}>
                <ClipboardPaste className="h-4 w-4" /> Extract quote
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setReply(SAMPLE_REPLIES[sampleIdx % SAMPLE_REPLIES.length]);
                  setSampleIdx((i) => i + 1);
                }}
              >
                Use a sample reply
              </Button>
            </div>

            {quote && (
              <div className="rounded-xl border border-zinc-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">Extracted quote</span>
                  <SourceBadge source={quoteSource} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <NumField label="Unit price ₹" value={quote.unitPrice} onChange={(v) => setQ({ unitPrice: v })} />
                  <NumField label="GST %" value={quote.gstPercent} onChange={(v) => setQ({ gstPercent: v })} />
                  <NumField label="Shipping ₹/order" value={quote.shippingPerUnit} onChange={(v) => setQ({ shippingPerUnit: v })} />
                  <NumField label="MOQ" value={quote.moq} onChange={(v) => setQ({ moq: v })} />
                  <NumField label="Dispatch days" value={quote.dispatchDays} onChange={(v) => setQ({ dispatchDays: v })} />
                  <NumField label="Sample ₹" value={quote.samplePrice ?? 0} onChange={(v) => setQ({ samplePrice: v || undefined })} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  <Toggle label="Dropships to customer" value={quote.dropshipSupported} onChange={(v) => setQ({ dropshipSupported: v })} />
                  <Toggle label="COD" value={quote.codSupported} onChange={(v) => setQ({ codSupported: v })} />
                  <Toggle label="Blind packing" value={quote.blindShipping} onChange={(v) => setQ({ blindShipping: v })} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-zinc-600">
                  <div>
                    <b>Returns:</b> {quote.returnPolicy}
                  </div>
                  <div>
                    <b>Notes:</b> {quote.notes}
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
                  <span className="text-sm text-zinc-600">Landed cost per order</span>
                  <span className="text-lg font-semibold tabular-nums">{inr(quote.landedCost)}</span>
                </div>
                <Button
                  className="mt-4 w-full"
                  onClick={() => {
                    onPatch({
                      quote,
                      rawReply: reply,
                      stage: s.stage === "found" || s.stage === "contacted" ? "quoted" : s.stage,
                    });
                    onClose();
                  }}
                >
                  Save quote & compare
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" className={inputCls} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </Field>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-zinc-900" />
      {label}
    </label>
  );
}
