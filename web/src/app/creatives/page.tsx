"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Heart, MessageCircle, Send, Bookmark, Trash2, Sparkles, Check, Film } from "lucide-react";
import { Badge, Button, Card, Empty, PageHeader, SourceBadge, cx, inputCls } from "@/components/ui";
import { newId, postJSON, useWorkspace } from "@/lib/store";
import type { CreativeDraft, Language } from "@/lib/ads";
import type { Creative, Product } from "@/lib/types";

const GRADIENTS = [
  "from-fuchsia-500 via-rose-500 to-orange-400",
  "from-emerald-500 via-teal-500 to-sky-500",
  "from-indigo-600 via-violet-600 to-fuchsia-500",
  "from-amber-400 via-orange-500 to-red-500",
  "from-sky-500 via-blue-600 to-indigo-700",
];

function toCreatives(drafts: CreativeDraft[], productId: string): Creative[] {
  const now = Date.now();
  return drafts.map((d, i) => ({ ...d, id: newId("cr"), productId, createdAt: now + i }));
}

export default function CreativesPage() {
  const { ws, update, activeProduct } = useWorkspace();
  const [language, setLanguage] = useState<Language>("Hinglish");
  const [count, setCount] = useState(4);
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<CreativeDraft[]>([]);
  const [source, setSource] = useState<"claude" | "demo">();
  const [error, setError] = useState<string>();

  if (!activeProduct) {
    return (
      <>
        <PageHeader step="Step 3" title="Ad creatives" subtitle="Scroll-stopping hooks, ad copy and Reel scripts for Meta, in English, Hinglish or Hindi." />
        <Empty>
          No product yet. <Link href="/products" className="font-medium text-zinc-900 underline">Pick a product</Link> first, then come back to make creatives.
        </Empty>
      </>
    );
  }

  const saved = ws.creatives.filter((c) => c.productId === activeProduct.id);

  async function generate() {
    if (!activeProduct) return;
    setLoading(true);
    setError(undefined);
    try {
      const res = await postJSON<{ creatives: CreativeDraft[]; source: "claude" | "demo"; error?: string }>("/api/creatives", {
        product: activeProduct,
        language,
        count,
      });
      setDrafts(res.creatives);
      setSource(res.source);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function save(d: CreativeDraft, i: number) {
    if (!activeProduct) return;
    const cs = toCreatives([d], activeProduct.id);
    update((w) => ({ ...w, creatives: [...cs, ...w.creatives] }));
    setDrafts((ds) => ds.filter((_, j) => j !== i));
  }

  function saveAll() {
    if (!activeProduct) return;
    const cs = toCreatives(drafts, activeProduct.id);
    update((w) => ({ ...w, creatives: [...cs, ...w.creatives] }));
    setDrafts([]);
  }

  function remove(id: string) {
    update((w) => ({ ...w, creatives: w.creatives.filter((c) => c.id !== id) }));
  }

  return (
    <>
      <PageHeader
        step="Step 3"
        title="Ad creatives"
        subtitle={`Hooks, ad copy and Reel shot lists for ${activeProduct.name}. Most first-time teams burn their budget on one creative; test 3-4 different angles from day one.`}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="mb-1 text-xs font-medium text-zinc-600">Language</div>
            <div className="inline-flex rounded-lg border border-zinc-300 bg-white p-0.5">
              {(["Hinglish", "English", "Hindi"] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={cx("rounded-md px-3 py-1.5 text-sm", language === l ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">How many angles</span>
            <select className={cx(inputCls, "w-28")} value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={generate} loading={loading}>
            <Sparkles className="h-4 w-4" /> Generate creatives
          </Button>
          {drafts.length > 0 && (
            <Button variant="secondary" onClick={saveAll}>
              Save all {drafts.length}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <SourceBadge source={source} />
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-amber-700">AI unavailable, showing offline templates. ({error.slice(0, 140)})</p>}
      </Card>

      {drafts.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">New drafts</h2>
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {drafts.map((d, i) => (
              <CreativeCard key={i} c={d} product={activeProduct} idx={i} action={<Button onClick={() => save(d, i)}>Save</Button>} />
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold text-zinc-900">
        Saved creatives for {activeProduct.name} <span className="font-normal text-zinc-400">({saved.length})</span>
      </h2>
      {saved.length === 0 ? (
        <Empty>No saved creatives yet. Generate a batch above and save the ones you&apos;ll run.</Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          {saved.map((c, i) => (
            <CreativeCard
              key={c.id}
              c={c}
              product={activeProduct}
              idx={i}
              action={
                <Button variant="ghost" onClick={() => remove(c.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

function CreativeCard({ c, product, idx, action }: { c: CreativeDraft; product: Product; idx: number; action: React.ReactNode }) {
  const [copied, setCopied] = useState<string>();
  const handle = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16) || "yourstore";

  function copy(label: string, text: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(label);
    setTimeout(() => setCopied(undefined), 1200);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone="violet">{c.angle}</Badge>
          <Badge>{c.language}</Badge>
        </div>
        {action}
      </div>

      {/* Instagram feed-style mockup */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2px]">
            <div className="grid h-full w-full place-items-center rounded-full bg-white text-[10px] font-bold text-zinc-800">
              {product.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold text-zinc-900">{handle}.in</div>
            <div className="text-[11px] text-zinc-500">Sponsored</div>
          </div>
          <div className="ml-auto text-zinc-400">•••</div>
        </div>

        <div className={cx("relative aspect-square bg-gradient-to-br", GRADIENTS[idx % GRADIENTS.length])}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
          <div className="absolute inset-0 flex flex-col justify-between p-6">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-white/80">{product.category}</div>
            <div className="text-balance text-2xl font-extrabold leading-tight text-white drop-shadow-md md:text-[26px]">{c.hook}</div>
            <div className="flex items-end justify-between">
              <div className="rounded-lg bg-white/95 px-3 py-1.5 text-zinc-900 shadow">
                <div className="text-[10px] font-medium uppercase text-zinc-500">Only</div>
                <div className="text-xl font-extrabold">₹{product.sellingPrice.toLocaleString("en-IN")}</div>
              </div>
              <div className="rounded-full bg-zinc-900/80 px-3 py-1 text-[11px] font-semibold text-white">COD available · Free shipping</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-zinc-50 px-3 py-2.5">
          <div className="min-w-0">
            <div className="truncate text-[11px] uppercase text-zinc-500">{handle}.in</div>
            <div className="truncate text-sm font-semibold text-zinc-900">{c.headline}</div>
          </div>
          <span className="ml-3 shrink-0 rounded-md bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-900">{c.cta || "Shop now"}</span>
        </div>

        <div className="flex items-center gap-4 px-3 pt-2.5 text-zinc-800">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <Bookmark className="ml-auto h-5 w-5" />
        </div>
        <div className="whitespace-pre-line px-3 pb-3 pt-2 text-[13px] leading-snug text-zinc-800">
          <span className="font-semibold">{handle}.in </span>
          {c.primaryText}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-900">
          <Film className="h-3.5 w-3.5" /> Reel shot list
        </div>
        <ol className="space-y-1 text-xs text-zinc-600">
          {c.reelScript.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-4 shrink-0 text-zinc-400">{i + 1}.</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">Static visual: </span>
          {c.visualIdea}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyBtn label="Primary text" copied={copied} onClick={() => copy("Primary text", c.primaryText)} />
          <CopyBtn label="Headline" copied={copied} onClick={() => copy("Headline", c.headline)} />
          <CopyBtn label="Reel script" copied={copied} onClick={() => copy("Reel script", c.reelScript.join("\n"))} />
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ label, copied, onClick }: { label: string; copied?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-50">
      {copied === label ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />} {label}
    </button>
  );
}
