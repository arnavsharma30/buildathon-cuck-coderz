"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { Badge, Button, Card, Empty, Field, PageHeader, ScoreBar, SourceBadge, cx, inputCls } from "@/components/ui";
import { EconomicsPanel } from "@/components/EconomicsPanel";
import { BLANK_PRODUCT, ProductForm, type ProductDraft } from "@/components/ProductForm";
import { newId, postJSON, useWorkspace } from "@/lib/store";
import { inr, unitEconomics } from "@/lib/economics";
import { compositeScore, type ProductIdea } from "@/lib/products-demo";
import type { EconomicsSettings, Product, ProductStatus } from "@/lib/types";

const STATUSES: ProductStatus[] = ["idea", "shortlisted", "sourcing", "live", "dropped"];
const STATUS_TONE: Record<ProductStatus, "zinc" | "blue" | "amber" | "green" | "red"> = {
  idea: "zinc",
  shortlisted: "blue",
  sourcing: "amber",
  live: "green",
  dropped: "red",
};

function makeProduct(idea: ProductIdea): Product {
  return { ...idea, id: newId("prd"), status: "shortlisted", createdAt: Date.now() };
}

function productFromDraft(d: ProductDraft): Product {
  return { ...d, id: newId("prd"), createdAt: Date.now() };
}

interface ResearchResponse {
  products: ProductIdea[];
  source: "claude" | "demo";
  error?: string;
}

export default function ProductsPage() {
  const { ws, update, activeProduct, setActiveProduct } = useWorkspace();
  const [niche, setNiche] = useState("");
  const [budget, setBudget] = useState(25000);
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<ProductIdea[]>([]);
  const [source, setSource] = useState<"claude" | "demo">();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<{ mode: "add" } | { mode: "edit"; product: Product } | null>(null);

  async function research() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await postJSON<ResearchResponse>("/api/products/research", { niche, budget, audience });
      setIdeas(res.products);
      setSource(res.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function shortlist(idea: ProductIdea) {
    const existing = ws.products.find((p) => p.name === idea.name);
    if (existing) {
      setActiveProduct(existing.id);
      return;
    }
    const product = makeProduct(idea);
    update((w) => ({ ...w, products: [product, ...w.products], activeProductId: product.id }));
  }

  function patchProduct(id: string, patch: Partial<Product>) {
    update((w) => ({ ...w, products: w.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }

  function saveDraft(d: ProductDraft) {
    if (editing?.mode === "edit") {
      patchProduct(editing.product.id, d);
    } else {
      const product = productFromDraft(d);
      update((w) => ({ ...w, products: [product, ...w.products], activeProductId: product.id }));
    }
    setEditing(null);
  }

  function removeProduct(p: Product) {
    if (!confirm(`Delete ${p.name}? Its suppliers, creatives, ad sets and website stay in the workspace but lose their product.`)) return;
    update((w) => ({
      ...w,
      products: w.products.filter((x) => x.id !== p.id),
      activeProductId: w.activeProductId === p.id ? undefined : w.activeProductId,
    }));
  }

  function patchSettings(patch: Partial<EconomicsSettings>) {
    update((w) => ({ ...w, economics: { ...w.economics, ...patch } }));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        step="Step 1"
        title="Product research"
        subtitle="Find products that survive Indian COD reality: light, Reel-demonstrable, 3x+ markup and low RTO risk. Then check what you'd actually make per order before spending a rupee on ads."
        actions={
          <Button onClick={() => setEditing({ mode: "add" })}>
            <Plus className="h-4 w-4" /> Add product
          </Button>
        }
      />

      {editing && (
        <ProductForm
          key={editing.mode === "edit" ? editing.product.id : "new"}
          mode={editing.mode}
          initial={editing.mode === "edit" ? editing.product : BLANK_PRODUCT}
          settings={ws.economics}
          onSave={saveDraft}
          onClose={() => setEditing(null)}
        />
      )}

      <Card title="What should your team sell?" right={<SourceBadge source={source} />}>
        <form
          className="grid gap-3 md:grid-cols-[1fr_160px_1fr_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            research();
          }}
        >
          <Field label="Niche or interest">
            <input className={inputCls} value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="e.g. fitness, pets, festive gifting, car" />
          </Field>
          <Field label="Total ad budget (₹)">
            <input className={inputCls} type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
          </Field>
          <Field label="Audience (optional)">
            <input className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. hostel students, new moms in tier-2" />
          </Field>
          <Button type="submit" loading={loading} className="h-[38px]">
            <Sparkles className="h-4 w-4" /> Find winning products
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      {ideas.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ideas
            .map((idea) => ({ idea, score: compositeScore(idea.scores) }))
            .sort((a, b) => b.score - a.score)
            .map(({ idea, score }) => (
              <IdeaCard
                key={idea.name}
                idea={idea}
                score={score}
                settings={ws.economics}
                shortlisted={ws.products.some((p) => p.name === idea.name)}
                onShortlist={() => shortlist(idea)}
              />
            ))}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Unit economics &amp; RTO reality check</h2>
            <p className="text-sm text-zinc-500">
              {activeProduct ? (
                <>
                  For <b className="text-zinc-800">{activeProduct.name}</b>. Every number is per order <i>placed</i>, because RTO orders cost you twice.
                </>
              ) : (
                "Shortlist a product to see what you would really make per order."
              )}
            </p>
          </div>
        </div>
        {activeProduct ? (
          <EconomicsPanel
            product={activeProduct}
            settings={ws.economics}
            onProductChange={(patch) => patchProduct(activeProduct.id, patch)}
            onSettingsChange={patchSettings}
          />
        ) : (
          <Empty>No product shortlisted yet. Run research above and hit &quot;Shortlist&quot;.</Empty>
        )}
      </section>

      <Card
        title={`Your product catalogue (${ws.products.length})`}
        right={
          <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => setEditing({ mode: "add" })}>
            <Plus className="h-3.5 w-3.5" /> Add product
          </Button>
        }
      >
        {ws.products.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing here yet. Add a product you already have in mind, or shortlist one from research.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Price / cost</th>
                  <th className="py-2 pr-3 font-medium">Profit / order placed</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {ws.products.map((p) => {
                  const r = unitEconomics({ sellingPrice: p.sellingPrice, productCost: p.sourcingCost, shippingFwd: p.shippingCost }, ws.economics);
                  const isActive = activeProduct?.id === p.id;
                  return (
                    <tr key={p.id} className={cx("border-b border-zinc-100 last:border-0", isActive && "bg-emerald-50/50")}>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-3">
                          {p.images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-supplied URLs
                            <img src={p.images[0]} alt="" className="h-10 w-10 shrink-0 rounded-md bg-zinc-100 object-cover" />
                          ) : (
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-zinc-100 text-sm font-semibold text-zinc-400">
                              {p.name.slice(0, 1)}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-zinc-900">{p.name}</div>
                            <div className="text-xs text-zinc-500">
                              {p.category}
                              {p.variants?.length ? ` · ${p.variants.length} variants` : ""}
                              {p.sku ? ` · ${p.sku}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">{compositeScore(p.scores)}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-zinc-700">
                        {inr(p.sellingPrice)} / {inr(p.sourcingCost)}
                      </td>
                      <td className={cx("py-2.5 pr-3 font-medium tabular-nums", r.profitPerOrder < 0 ? "text-red-600" : "text-emerald-600")}>
                        {inr(r.profitPerOrder)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"
                          value={p.status}
                          onChange={(e) => patchProduct(p.id, { status: e.target.value as ProductStatus })}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>{" "}
                        <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-right">
                        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing({ mode: "edit", product: p })} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => removeProduct(p)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {isActive ? (
                          <Badge tone="green">
                            <Star className="h-3 w-3" /> Active
                          </Badge>
                        ) : (
                          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setActiveProduct(p.id)}>
                            Set active
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
    </div>
  );
}

function IdeaCard({
  idea,
  score,
  settings,
  shortlisted,
  onShortlist,
}: {
  idea: ProductIdea;
  score: number;
  settings: EconomicsSettings;
  shortlisted: boolean;
  onShortlist: () => void;
}) {
  const r = unitEconomics({ sellingPrice: idea.sellingPrice, productCost: idea.sourcingCost, shippingFwd: idea.shippingCost }, settings);
  const scoreTone = score >= 6.5 ? "bg-emerald-500" : score >= 5 ? "bg-amber-400" : "bg-red-500";
  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-zinc-500">{idea.category}</div>
          <h3 className="font-semibold leading-snug text-zinc-900">{idea.name}</h3>
        </div>
        <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-lg text-sm font-bold text-white", scoreTone)} title="DropOS score">
          {score}
        </div>
      </div>
      <p className="mt-2 text-sm text-zinc-600">{idea.why}</p>
      <p className="mt-1 text-xs text-zinc-500">
        <b>Who:</b> {idea.targetAudience}
      </p>

      <div className="mt-4 space-y-1.5">
        <ScoreBar label="Demand" value={idea.scores.demand} />
        <ScoreBar label="Margin" value={idea.scores.margin} />
        <ScoreBar label="Wow factor" value={idea.scores.wow} />
        <ScoreBar label="RTO risk" value={idea.scores.rtoRisk} invert />
        <ScoreBar label="Competition" value={idea.scores.competition} invert />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-center">
        <div>
          <div className="text-[11px] text-zinc-500">Sell / Cost</div>
          <div className="text-sm font-semibold tabular-nums">
            {inr(idea.sellingPrice)}
            <span className="font-normal text-zinc-400"> / {inr(idea.sourcingCost)}</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Naive margin</div>
          <div className="text-sm font-semibold tabular-nums text-zinc-500">{inr(r.naiveMargin)}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Real / order</div>
          <div className={cx("text-sm font-semibold tabular-nums", r.profitPerOrder < 0 ? "text-red-600" : "text-emerald-600")}>
            {inr(r.profitPerOrder)}
          </div>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-xs text-amber-800">
        {idea.risks.slice(0, 3).map((risk) => (
          <li key={risk}>⚠ {risk}</li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="truncate text-[11px] text-zinc-400" title={idea.indiamartQuery}>
          IndiaMART: “{idea.indiamartQuery}”
        </span>
        <Button variant={shortlisted ? "secondary" : "primary"} className="px-3 py-1.5 text-xs" onClick={onShortlist}>
          {shortlisted ? (
            <>
              <Check className="h-3.5 w-3.5" /> Shortlisted
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> Shortlist
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
